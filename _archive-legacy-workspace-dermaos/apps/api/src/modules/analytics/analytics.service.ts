/**
 * DermaIQ Analytics Service — KPIs, jornadas, supply, omni e financeiro avançado.
 *
 * Características:
 *  - RLS via withClinicContext em TODAS as queries.
 *  - Materialized views (analytics.mv_*) para receita/agenda/consumo, sempre filtradas por clinic_id.
 *  - Tabelas analytics.* (kpi_snapshots, patient_cohorts, supply_forecasts, lead_scores) populadas pelo worker.
 *  - Cache Redis com prefixo "dashboard:analytics:..." (300s) compartilhado com a invalidação por evento.
 *  - Divisão por zero retorna null.
 *  - Comparação vs período anterior do mesmo comprimento.
 */

import type { PoolClient } from 'pg';
import { withClinicContext, db } from '../../db/client.js';
import { decryptOptional } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';
import {
  hashRange,
  makeCacheKey,
  withCache,
} from '../dashboard/dashboard.cache.js';

/* ── Helpers compartilhados ──────────────────────────────────────────────── */

function safeRate(numerator: number, denominator: number): number | null {
  if (!denominator || denominator === 0) return null;
  const r = numerator / denominator;
  if (!Number.isFinite(r)) return null;
  return r;
}

function trend(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  const t = ((current - previous) / Math.abs(previous)) * 100;
  if (!Number.isFinite(t)) return null;
  return Math.round(t * 10) / 10;
}

function rangeDays(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  return Math.max(1, Math.floor((e.getTime() - s.getTime()) / 86_400_000) + 1);
}

function previousRange(start: string, end: string): { start: string; end: string } {
  const days = rangeDays(start, end);
  const sDate = new Date(`${start}T00:00:00Z`);
  const prevEnd   = new Date(sDate.getTime() - 86_400_000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86_400_000);
  return {
    start: prevStart.toISOString().slice(0, 10),
    end:   prevEnd.toISOString().slice(0, 10),
  };
}

async function fetchClinicTimezone(clinicId: string): Promise<string> {
  try {
    const res = await db.query<{ timezone: string }>(
      `SELECT timezone FROM shared.clinics WHERE id = $1`,
      [clinicId],
    );
    return res.rows[0]?.timezone ?? 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

interface KpiValue {
  value:    number | null;
  trendPct: number | null;
  unit?:    'currency' | 'percent' | 'count' | 'days';
}

/* ── 1) Overview Analytics ───────────────────────────────────────────────── */

export interface OverviewAnalytics {
  range:   { start: string; end: string };
  cached:  boolean;
  generatedAt: string;
  kpis: {
    revenue:        KpiValue;
    appointments:   KpiValue;
    newPatients:    KpiValue;
    activePatients: KpiValue;
    avgTicket:      KpiValue;
    cancellationRate: KpiValue;
    npsScore:       KpiValue;
  };
  series: {
    revenueDaily:      Array<{ date: string; value: number }>;
    appointmentsDaily: Array<{ date: string; total: number; completed: number; noShow: number; cancelled: number }>;
    newPatientsDaily:  Array<{ date: string; value: number }>;
  };
  snapshotCoverage: {
    snapshotsFound: number;
    snapshotsExpected: number;
    /** Indica se o worker já popularizou kpi_snapshots para o período pedido. */
    complete: boolean;
  };
}

export async function getOverview(
  clinicId: string,
  range: { start: string; end: string },
): Promise<OverviewAnalytics> {
  const timezone = await fetchClinicTimezone(clinicId);
  const cacheKey = makeCacheKey([
    'analytics', clinicId, 'overview', hashRange(range.start, range.end),
  ]);

  const { data, cached } = await withCache<Omit<OverviewAnalytics, 'cached' | 'generatedAt'>>(
    cacheKey, 300,
    async () => withClinicContext(clinicId, async (client) => {
      const prev = previousRange(range.start, range.end);
      const expectedDays = rangeDays(range.start, range.end);

      const [
        snapshotsCurr, snapshotsPrev,
        revenueDailyMv, appointmentsDailyMv, newPatientsDaily,
      ] = await Promise.all([
        readKpiSnapshots(client, clinicId, range.start, range.end),
        readKpiSnapshots(client, clinicId, prev.start, prev.end),
        readRevenueSeries(client, clinicId, range.start, range.end),
        readAppointmentSeries(client, clinicId, range.start, range.end, timezone),
        readNewPatientsSeries(client, clinicId, range.start, range.end, timezone),
      ]);

      const aggCurr = aggregateSnapshots(snapshotsCurr);
      const aggPrev = aggregateSnapshots(snapshotsPrev);

      // Fallback: se snapshots cobrem < 50% dos dias, calcula via materialized views.
      const useFallback = aggCurr.daysCovered < expectedDays / 2;
      const liveRevenue = revenueDailyMv.reduce((acc, d) => acc + d.value, 0);
      const liveAppointments = appointmentsDailyMv.reduce(
        (acc, d) => ({
          total:     acc.total + d.total,
          completed: acc.completed + d.completed,
          noShow:    acc.noShow + d.noShow,
          cancelled: acc.cancelled + d.cancelled,
        }),
        { total: 0, completed: 0, noShow: 0, cancelled: 0 },
      );
      const liveNewPatients = newPatientsDaily.reduce((acc, d) => acc + d.value, 0);

      const kpis = {
        revenue: {
          value:    useFallback ? liveRevenue : aggCurr.revenue,
          trendPct: trend(useFallback ? liveRevenue : aggCurr.revenue, aggPrev.revenue),
          unit:     'currency' as const,
        },
        appointments: {
          value:    useFallback ? liveAppointments.total : aggCurr.appointments,
          trendPct: trend(useFallback ? liveAppointments.total : aggCurr.appointments, aggPrev.appointments),
          unit:     'count' as const,
        },
        newPatients: {
          value:    useFallback ? liveNewPatients : aggCurr.newPatients,
          trendPct: trend(useFallback ? liveNewPatients : aggCurr.newPatients, aggPrev.newPatients),
          unit:     'count' as const,
        },
        activePatients: {
          value:    aggCurr.activePatients,
          trendPct: trend(aggCurr.activePatients, aggPrev.activePatients),
          unit:     'count' as const,
        },
        avgTicket: {
          value:    aggCurr.avgTicket,
          trendPct: trend(aggCurr.avgTicket, aggPrev.avgTicket),
          unit:     'currency' as const,
        },
        cancellationRate: {
          value:    aggCurr.cancellationRate,
          trendPct: trend(aggCurr.cancellationRate, aggPrev.cancellationRate),
          unit:     'percent' as const,
        },
        npsScore: {
          value:    aggCurr.npsScore,
          trendPct: trend(aggCurr.npsScore, aggPrev.npsScore),
          unit:     'count' as const,
        },
      };

      return {
        range,
        kpis,
        series: {
          revenueDaily:      revenueDailyMv,
          appointmentsDaily: appointmentsDailyMv,
          newPatientsDaily,
        },
        snapshotCoverage: {
          snapshotsFound:    aggCurr.daysCovered,
          snapshotsExpected: expectedDays,
          complete:          aggCurr.daysCovered >= expectedDays,
        },
      };
    }),
  );

  return { ...data, cached, generatedAt: new Date().toISOString() };
}

interface KpiSnapshotRow {
  snapshot_date:        string;
  revenue_total:        string;
  appointments_total:   string;
  new_patients:         string;
  active_patients:      string;
  nps_score:            string | null;
  avg_ticket:           string | null;
  cancellation_rate:    string | null;
  appointments_by_status: Record<string, number> | null;
}

async function readKpiSnapshots(
  client: PoolClient, clinicId: string, start: string, end: string,
): Promise<KpiSnapshotRow[]> {
  const res = await client.query<KpiSnapshotRow>(
    `SELECT snapshot_date::text,
            revenue_total::text,
            appointments_total::text,
            new_patients::text,
            active_patients::text,
            nps_score::text,
            avg_ticket::text,
            cancellation_rate::text,
            appointments_by_status
       FROM analytics.kpi_snapshots
      WHERE clinic_id     = $1
        AND period_type   = 'daily'
        AND snapshot_date BETWEEN $2::date AND $3::date
      ORDER BY snapshot_date ASC`,
    [clinicId, start, end],
  );
  return res.rows;
}

interface SnapshotsAgg {
  daysCovered:      number;
  revenue:          number;
  appointments:     number;
  newPatients:      number;
  activePatients:   number;  // média móvel (último valor diário)
  avgTicket:        number | null;
  cancellationRate: number | null;
  npsScore:         number | null;
}

function aggregateSnapshots(rows: KpiSnapshotRow[]): SnapshotsAgg {
  if (rows.length === 0) {
    return {
      daysCovered: 0, revenue: 0, appointments: 0, newPatients: 0,
      activePatients: 0, avgTicket: null, cancellationRate: null, npsScore: null,
    };
  }
  let revenue = 0, appointments = 0, newPatients = 0;
  let cancelTotal = 0, cancelDays = 0;
  let npsTotal = 0, npsDays = 0;
  let ticketTotal = 0, ticketDays = 0;
  let lastActive = 0;
  for (const r of rows) {
    revenue      += parseFloat(r.revenue_total ?? '0');
    appointments += parseInt(r.appointments_total ?? '0', 10);
    newPatients  += parseInt(r.new_patients ?? '0', 10);
    lastActive    = parseInt(r.active_patients ?? '0', 10) || lastActive;
    if (r.cancellation_rate !== null) { cancelTotal += parseFloat(r.cancellation_rate); cancelDays++; }
    if (r.nps_score         !== null) { npsTotal    += parseFloat(r.nps_score);          npsDays++; }
    if (r.avg_ticket        !== null) { ticketTotal += parseFloat(r.avg_ticket);         ticketDays++; }
  }
  return {
    daysCovered:      rows.length,
    revenue,
    appointments,
    newPatients,
    activePatients:   lastActive,
    avgTicket:        ticketDays > 0 ? ticketTotal / ticketDays : null,
    cancellationRate: cancelDays > 0 ? cancelTotal / cancelDays : null,
    npsScore:         npsDays    > 0 ? npsTotal    / npsDays    : null,
  };
}

async function readRevenueSeries(
  client: PoolClient, clinicId: string, start: string, end: string,
): Promise<Array<{ date: string; value: number }>> {
  const res = await client.query<{ day: string; revenue: string }>(
    `WITH days AS (
       SELECT generate_series($1::date, $2::date, INTERVAL '1 day')::date AS day
     )
     SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
            COALESCE(mv.revenue, 0)::text AS revenue
       FROM days d
       LEFT JOIN analytics.mv_daily_revenue mv
         ON mv.clinic_id = $3 AND mv.day = d.day
      ORDER BY d.day ASC`,
    [start, end, clinicId],
  );
  return res.rows.map((r) => ({ date: r.day, value: parseFloat(r.revenue) }));
}

async function readAppointmentSeries(
  client: PoolClient, clinicId: string, start: string, end: string, _tz: string,
): Promise<Array<{ date: string; total: number; completed: number; noShow: number; cancelled: number }>> {
  const res = await client.query<{
    day: string; total: string; completed: string; no_show: string; cancelled: string;
  }>(
    `WITH days AS (
       SELECT generate_series($1::date, $2::date, INTERVAL '1 day')::date AS day
     )
     SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
            COALESCE(mv.total, 0)::text     AS total,
            COALESCE(mv.completed, 0)::text AS completed,
            COALESCE(mv.no_show, 0)::text   AS no_show,
            COALESCE(mv.cancelled, 0)::text AS cancelled
       FROM days d
       LEFT JOIN analytics.mv_appointment_metrics mv
         ON mv.clinic_id = $3 AND mv.day = d.day
      ORDER BY d.day ASC`,
    [start, end, clinicId],
  );
  return res.rows.map((r) => ({
    date:      r.day,
    total:     parseInt(r.total, 10),
    completed: parseInt(r.completed, 10),
    noShow:    parseInt(r.no_show, 10),
    cancelled: parseInt(r.cancelled, 10),
  }));
}

async function readNewPatientsSeries(
  client: PoolClient, clinicId: string, start: string, end: string, tz: string,
): Promise<Array<{ date: string; value: number }>> {
  const res = await client.query<{ day: string; count: string }>(
    `WITH days AS (
       SELECT generate_series($1::date, $2::date, INTERVAL '1 day')::date AS day
     )
     SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
            COUNT(p.id)::text AS count
       FROM days d
       LEFT JOIN shared.patients p
         ON DATE(p.created_at AT TIME ZONE $4) = d.day
        AND p.clinic_id  = $3
        AND p.deleted_at IS NULL
      GROUP BY d.day
      ORDER BY d.day ASC`,
    [start, end, clinicId, tz],
  );
  return res.rows.map((r) => ({ date: r.day, value: parseInt(r.count, 10) }));
}

/* ── 2) Patient Journey ──────────────────────────────────────────────────── */

export interface PatientJourneyAnalytics {
  range: { start: string; end: string };
  cached: boolean;
  generatedAt: string;
  funnel: {
    leads:           number;   // pacientes criados no período
    firstAppointment: number;
    completed:       number;
    returned:        number;
  };
  conversionRates: {
    leadToFirst:     number | null;
    firstToCompleted: number | null;
    completedToReturn: number | null;
  };
  cohorts: Array<{
    cohortMonth: string;
    cohortSize:  number;
    retainedM1:  number;
    retainedM3:  number;
    retainedM6:  number;
    retainedM12: number;
    retentionM1: number | null;
    retentionM3: number | null;
    retentionM6: number | null;
    retentionM12: number | null;
    avgLtv:      number;
  }>;
  topChurnRisk: Array<{
    patientId:   string;
    patientName: string;
    churnRisk:   number;
    daysSinceVisit: number | null;
    ltvPredicted: number;
  }>;
  topUpsell: Array<{
    patientId:   string;
    patientName: string;
    upsellScore: number;
    ltvPredicted: number;
  }>;
}

export async function getPatientJourney(
  clinicId: string,
  range: { start: string; end: string; cohortMonths: number },
): Promise<PatientJourneyAnalytics> {
  const timezone = await fetchClinicTimezone(clinicId);
  const cacheKey = makeCacheKey([
    'analytics', clinicId, 'journey', hashRange(range.start, range.end), `c${range.cohortMonths}`,
  ]);

  const { data, cached } = await withCache<Omit<PatientJourneyAnalytics, 'cached' | 'generatedAt'>>(
    cacheKey, 300,
    async () => withClinicContext(clinicId, async (client) => {
      const [funnel, cohortsRows, churnRows, upsellRows] = await Promise.all([
        readFunnel(client, clinicId, range.start, range.end, timezone),
        readCohorts(client, clinicId, range.cohortMonths),
        readTopChurn(client, clinicId, 10),
        readTopUpsell(client, clinicId, 10),
      ]);

      return {
        range: { start: range.start, end: range.end },
        funnel,
        conversionRates: {
          leadToFirst:       safeRate(funnel.firstAppointment, funnel.leads),
          firstToCompleted:  safeRate(funnel.completed, funnel.firstAppointment),
          completedToReturn: safeRate(funnel.returned, funnel.completed),
        },
        cohorts: cohortsRows.map((c) => ({
          cohortMonth: c.cohort_month,
          cohortSize:  c.cohort_size,
          retainedM1:  c.retained_m1,
          retainedM3:  c.retained_m3,
          retainedM6:  c.retained_m6,
          retainedM12: c.retained_m12,
          retentionM1:  safeRate(c.retained_m1,  c.cohort_size),
          retentionM3:  safeRate(c.retained_m3,  c.cohort_size),
          retentionM6:  safeRate(c.retained_m6,  c.cohort_size),
          retentionM12: safeRate(c.retained_m12, c.cohort_size),
          avgLtv:      c.avg_ltv,
        })),
        topChurnRisk: churnRows,
        topUpsell:    upsellRows,
      };
    }),
  );

  return { ...data, cached, generatedAt: new Date().toISOString() };
}

async function readFunnel(
  client: PoolClient, clinicId: string, start: string, end: string, tz: string,
): Promise<{ leads: number; firstAppointment: number; completed: number; returned: number }> {
  const res = await client.query<{ leads: string; first_appt: string; completed: string; returned: string }>(
    `WITH leads AS (
       SELECT id, created_at
         FROM shared.patients
        WHERE clinic_id  = $1
          AND deleted_at IS NULL
          AND created_at >= ($2::timestamp AT TIME ZONE $4)
          AND created_at <  ($3::timestamp + INTERVAL '1 day') AT TIME ZONE $4
     ),
     first_appt AS (
       SELECT DISTINCT a.patient_id
         FROM shared.appointments a
         JOIN leads l ON l.id = a.patient_id
        WHERE a.clinic_id  = $1
     ),
     completed_appt AS (
       SELECT DISTINCT a.patient_id
         FROM shared.appointments a
         JOIN leads l ON l.id = a.patient_id
        WHERE a.clinic_id  = $1
          AND a.status     = 'completed'
     ),
     returned AS (
       SELECT a.patient_id
         FROM shared.appointments a
         JOIN leads l ON l.id = a.patient_id
        WHERE a.clinic_id  = $1
          AND a.status     = 'completed'
        GROUP BY a.patient_id
       HAVING COUNT(*) >= 2
     )
     SELECT (SELECT COUNT(*) FROM leads)::text         AS leads,
            (SELECT COUNT(*) FROM first_appt)::text    AS first_appt,
            (SELECT COUNT(*) FROM completed_appt)::text AS completed,
            (SELECT COUNT(*) FROM returned)::text      AS returned`,
    [clinicId, start, end, tz],
  );
  const r = res.rows[0];
  return {
    leads:            parseInt(r?.leads ?? '0', 10),
    firstAppointment: parseInt(r?.first_appt ?? '0', 10),
    completed:        parseInt(r?.completed ?? '0', 10),
    returned:         parseInt(r?.returned ?? '0', 10),
  };
}

async function readCohorts(
  client: PoolClient, clinicId: string, months: number,
): Promise<Array<{
  cohort_month: string; cohort_size: number;
  retained_m1: number; retained_m3: number; retained_m6: number; retained_m12: number;
  avg_ltv: number;
}>> {
  const res = await client.query<{
    cohort_month: string; cohort_size: string;
    retained_m1: string; retained_m3: string; retained_m6: string; retained_m12: string;
    avg_ltv: string;
  }>(
    `SELECT to_char(cohort_month, 'YYYY-MM-DD') AS cohort_month,
            cohort_size::text, retained_m1::text, retained_m3::text,
            retained_m6::text, retained_m12::text, avg_ltv::text
       FROM analytics.patient_cohorts
      WHERE clinic_id    = $1
        AND cohort_month >= (date_trunc('month', NOW()) - ($2 || ' months')::interval)::date
      ORDER BY cohort_month DESC`,
    [clinicId, months.toString()],
  );
  return res.rows.map((r) => ({
    cohort_month: r.cohort_month,
    cohort_size:  parseInt(r.cohort_size, 10),
    retained_m1:  parseInt(r.retained_m1, 10),
    retained_m3:  parseInt(r.retained_m3, 10),
    retained_m6:  parseInt(r.retained_m6, 10),
    retained_m12: parseInt(r.retained_m12, 10),
    avg_ltv:      parseFloat(r.avg_ltv),
  }));
}

async function readTopChurn(
  client: PoolClient, clinicId: string, limit: number,
): Promise<Array<{ patientId: string; patientName: string; churnRisk: number; daysSinceVisit: number | null; ltvPredicted: number }>> {
  const res = await client.query<{
    patient_id: string; patient_name: string | null;
    churn_risk: string; days_since_visit: number | null; ltv_predicted: string;
  }>(
    `SELECT ls.patient_id,
            p.name AS patient_name,
            ls.churn_risk_score::text AS churn_risk,
            ls.days_since_visit,
            ls.ltv_predicted::text AS ltv_predicted
       FROM analytics.lead_scores ls
       JOIN shared.patients p ON p.id = ls.patient_id
      WHERE ls.clinic_id   = $1
        AND p.deleted_at  IS NULL
      ORDER BY ls.churn_risk_score DESC
      LIMIT $2`,
    [clinicId, limit],
  );
  return res.rows.map((r) => ({
    patientId:      r.patient_id,
    patientName:    decryptOptional(r.patient_name) ?? r.patient_name ?? 'Paciente',
    churnRisk:      parseFloat(r.churn_risk),
    daysSinceVisit: r.days_since_visit,
    ltvPredicted:   parseFloat(r.ltv_predicted),
  }));
}

async function readTopUpsell(
  client: PoolClient, clinicId: string, limit: number,
): Promise<Array<{ patientId: string; patientName: string; upsellScore: number; ltvPredicted: number }>> {
  const res = await client.query<{
    patient_id: string; patient_name: string | null;
    upsell_score: string; ltv_predicted: string;
  }>(
    `SELECT ls.patient_id,
            p.name AS patient_name,
            ls.upsell_score::text AS upsell_score,
            ls.ltv_predicted::text AS ltv_predicted
       FROM analytics.lead_scores ls
       JOIN shared.patients p ON p.id = ls.patient_id
      WHERE ls.clinic_id  = $1
        AND p.deleted_at IS NULL
      ORDER BY ls.upsell_score DESC
      LIMIT $2`,
    [clinicId, limit],
  );
  return res.rows.map((r) => ({
    patientId:    r.patient_id,
    patientName:  decryptOptional(r.patient_name) ?? r.patient_name ?? 'Paciente',
    upsellScore:  parseFloat(r.upsell_score),
    ltvPredicted: parseFloat(r.ltv_predicted),
  }));
}

/* ── 3) Supply Intelligence ──────────────────────────────────────────────── */

export interface SupplyIntelligence {
  range: { start: string; end: string };
  cached: boolean;
  generatedAt: string;
  topConsumed: Array<{
    productId:   string;
    productName: string;
    quantity:    number;
    movements:   number;
  }>;
  forecasts: Array<{
    productId:           string;
    productName:         string;
    predictedConsumption: number;
    predictedReorderDate: string | null;
    confidenceScore:     number | null;
    daysOfStock:         number | null;
  }>;
  abcAnalysis: {
    a: number;
    b: number;
    c: number;
    items: Array<{ productId: string; productName: string; classification: 'A' | 'B' | 'C'; share: number }>;
  };
}

export async function getSupplyIntelligence(
  clinicId: string,
  range: { start: string; end: string; topN: number },
): Promise<SupplyIntelligence> {
  const cacheKey = makeCacheKey([
    'analytics', clinicId, 'supply', hashRange(range.start, range.end), `n${range.topN}`,
  ]);

  const { data, cached } = await withCache<Omit<SupplyIntelligence, 'cached' | 'generatedAt'>>(
    cacheKey, 300,
    async () => withClinicContext(clinicId, async (client) => {
      const [topConsumed, forecasts, abc] = await Promise.all([
        readTopConsumed(client, clinicId, range.start, range.end, range.topN),
        readForecasts(client, clinicId),
        readAbcAnalysis(client, clinicId, range.start, range.end),
      ]);
      return { range: { start: range.start, end: range.end }, topConsumed, forecasts, abcAnalysis: abc };
    }),
  );

  return { ...data, cached, generatedAt: new Date().toISOString() };
}

async function readTopConsumed(
  client: PoolClient, clinicId: string, start: string, end: string, limit: number,
): Promise<Array<{ productId: string; productName: string; quantity: number; movements: number }>> {
  const res = await client.query<{ product_id: string; product_name: string; quantity: string; movements: string }>(
    `SELECT mv.product_id,
            p.name AS product_name,
            SUM(mv.quantity_consumed)::text AS quantity,
            SUM(mv.movement_count)::text    AS movements
       FROM analytics.mv_supply_consumption mv
       JOIN supply.products p ON p.id = mv.product_id
      WHERE mv.clinic_id = $1
        AND mv.day BETWEEN $2::date AND $3::date
      GROUP BY mv.product_id, p.name
      ORDER BY SUM(mv.quantity_consumed) DESC
      LIMIT $4`,
    [clinicId, start, end, limit],
  );
  return res.rows.map((r) => ({
    productId:   r.product_id,
    productName: r.product_name,
    quantity:    parseFloat(r.quantity),
    movements:   parseInt(r.movements, 10),
  }));
}

async function readForecasts(
  client: PoolClient, clinicId: string,
): Promise<Array<{
  productId: string; productName: string;
  predictedConsumption: number; predictedReorderDate: string | null;
  confidenceScore: number | null; daysOfStock: number | null;
}>> {
  // Pega o forecast mais recente por produto + dias de estoque atual.
  const res = await client.query<{
    product_id: string; product_name: string;
    predicted_consumption: string; predicted_reorder_date: string | null;
    confidence_score: string | null;
    qty_total: string; daily_consumption: string | null;
  }>(
    `WITH latest AS (
       SELECT DISTINCT ON (product_id) product_id, predicted_consumption,
              predicted_reorder_date, confidence_score
         FROM analytics.supply_forecasts
        WHERE clinic_id = $1
        ORDER BY product_id, forecast_date DESC
     ),
     stock AS (
       SELECT p.id AS product_id,
              p.name AS product_name,
              COALESCE(SUM(l.quantity_current), 0) AS qty_total
         FROM supply.products p
         LEFT JOIN supply.inventory_lots l
           ON l.product_id = p.id
          AND l.quantity_current > 0
          AND l.is_quarantined = false
        WHERE p.clinic_id = $1
          AND p.is_active = true
        GROUP BY p.id, p.name
     ),
     last30 AS (
       SELECT product_id,
              COALESCE(SUM(quantity_consumed), 0) / 30.0 AS daily_consumption
         FROM analytics.mv_supply_consumption
        WHERE clinic_id = $1
          AND day >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY product_id
     )
     SELECT s.product_id, s.product_name,
            COALESCE(l.predicted_consumption, 0)::text  AS predicted_consumption,
            to_char(l.predicted_reorder_date, 'YYYY-MM-DD') AS predicted_reorder_date,
            l.confidence_score::text AS confidence_score,
            s.qty_total::text         AS qty_total,
            l30.daily_consumption::text AS daily_consumption
       FROM stock s
       LEFT JOIN latest l   ON l.product_id  = s.product_id
       LEFT JOIN last30 l30 ON l30.product_id = s.product_id
      ORDER BY s.product_name ASC`,
    [clinicId],
  );
  return res.rows.map((r) => {
    const daily   = r.daily_consumption ? parseFloat(r.daily_consumption) : 0;
    const qty     = parseFloat(r.qty_total);
    const days    = daily > 0 ? Math.floor(qty / daily) : null;
    return {
      productId:            r.product_id,
      productName:          r.product_name,
      predictedConsumption: parseFloat(r.predicted_consumption),
      predictedReorderDate: r.predicted_reorder_date,
      confidenceScore:      r.confidence_score ? parseFloat(r.confidence_score) : null,
      daysOfStock:          days,
    };
  });
}

async function readAbcAnalysis(
  client: PoolClient, clinicId: string, start: string, end: string,
): Promise<{ a: number; b: number; c: number; items: Array<{ productId: string; productName: string; classification: 'A' | 'B' | 'C'; share: number }> }> {
  const res = await client.query<{ product_id: string; product_name: string; quantity: string }>(
    `SELECT mv.product_id, p.name AS product_name, SUM(mv.quantity_consumed)::text AS quantity
       FROM analytics.mv_supply_consumption mv
       JOIN supply.products p ON p.id = mv.product_id
      WHERE mv.clinic_id = $1
        AND mv.day BETWEEN $2::date AND $3::date
      GROUP BY mv.product_id, p.name
      ORDER BY SUM(mv.quantity_consumed) DESC`,
    [clinicId, start, end],
  );
  const rows = res.rows.map((r) => ({
    productId:   r.product_id,
    productName: r.product_name,
    quantity:    parseFloat(r.quantity),
  }));
  const total = rows.reduce((acc, r) => acc + r.quantity, 0);
  let cumulative = 0;
  let aCount = 0, bCount = 0, cCount = 0;
  const items = rows.map((r) => {
    const share = total > 0 ? r.quantity / total : 0;
    cumulative += share;
    let classification: 'A' | 'B' | 'C';
    if (cumulative <= 0.8) { classification = 'A'; aCount++; }
    else if (cumulative <= 0.95) { classification = 'B'; bCount++; }
    else { classification = 'C'; cCount++; }
    return { productId: r.productId, productName: r.productName, classification, share };
  });
  return { a: aCount, b: bCount, c: cCount, items };
}

/* ── 4) Omni Performance ─────────────────────────────────────────────────── */

export interface OmniPerformance {
  range: { start: string; end: string };
  cached: boolean;
  generatedAt: string;
  byChannel: Array<{
    channel:        string;
    inbound:        number;
    outbound:       number;
    automated:      number;
    avgResponseSec: number | null;
  }>;
  funnel: {
    contacted:   number;
    responded:   number;
    scheduled:   number;
    completed:   number;
  };
  totalConversations: number;
  totalAutomations:   number;
  avgResponseSec:     number | null;
}

export async function getOmniPerformance(
  clinicId: string,
  range: { start: string; end: string },
): Promise<OmniPerformance> {
  const timezone = await fetchClinicTimezone(clinicId);
  const cacheKey = makeCacheKey([
    'analytics', clinicId, 'omni', hashRange(range.start, range.end),
  ]);

  const { data, cached } = await withCache<Omit<OmniPerformance, 'cached' | 'generatedAt'>>(
    cacheKey, 300,
    async () => withClinicContext(clinicId, async (client) => {
      const [byChannel, funnel] = await Promise.all([
        readChannelMetrics(client, clinicId, range.start, range.end, timezone),
        readOmniFunnel(client, clinicId, range.start, range.end, timezone),
      ]);

      const totalConversations = byChannel.reduce((acc, c) => acc + c.inbound + c.outbound, 0);
      const totalAutomations   = byChannel.reduce((acc, c) => acc + c.automated, 0);
      const respChannels = byChannel.filter((c) => c.avgResponseSec !== null);
      const avgResponseSec = respChannels.length > 0
        ? respChannels.reduce((acc, c) => acc + (c.avgResponseSec ?? 0), 0) / respChannels.length
        : null;

      return {
        range: { start: range.start, end: range.end },
        byChannel,
        funnel,
        totalConversations,
        totalAutomations,
        avgResponseSec,
      };
    }),
  );

  return { ...data, cached, generatedAt: new Date().toISOString() };
}

async function readChannelMetrics(
  client: PoolClient, clinicId: string, start: string, end: string, tz: string,
): Promise<Array<{ channel: string; inbound: number; outbound: number; automated: number; avgResponseSec: number | null }>> {
  // Tabela omni.messages tem direction ('inbound'|'outbound') e channel.
  // Detecta tabelas existentes graciosamente — se omni não existir, retorna vazio.
  try {
    const res = await client.query<{
      channel: string; inbound: string; outbound: string; automated: string; avg_resp: string | null;
    }>(
      `WITH msgs AS (
         SELECT m.channel, m.direction, m.created_at, m.metadata,
                COALESCE((m.metadata->>'sent_by_aurora')::boolean, false) AS automated
           FROM omni.messages m
          WHERE m.clinic_id = $1
            AND m.created_at >= ($2::timestamp AT TIME ZONE $4)
            AND m.created_at <  ($3::timestamp + INTERVAL '1 day') AT TIME ZONE $4
       ),
       resp AS (
         SELECT m.channel,
                AVG(EXTRACT(EPOCH FROM (
                  LEAD(m.created_at) OVER (PARTITION BY m.conversation_id ORDER BY m.created_at) - m.created_at
                )))::numeric AS avg_resp
           FROM omni.messages m
          WHERE m.clinic_id = $1
            AND m.created_at >= ($2::timestamp AT TIME ZONE $4)
            AND m.created_at <  ($3::timestamp + INTERVAL '1 day') AT TIME ZONE $4
            AND m.direction = 'inbound'
          GROUP BY m.channel
       )
       SELECT msgs.channel,
              COUNT(*) FILTER (WHERE msgs.direction = 'inbound')::text  AS inbound,
              COUNT(*) FILTER (WHERE msgs.direction = 'outbound')::text AS outbound,
              COUNT(*) FILTER (WHERE msgs.automated)::text              AS automated,
              resp.avg_resp::text                                       AS avg_resp
         FROM msgs
         LEFT JOIN resp ON resp.channel = msgs.channel
        GROUP BY msgs.channel, resp.avg_resp
        ORDER BY COUNT(*) DESC`,
      [clinicId, start, end, tz],
    );
    return res.rows.map((r) => ({
      channel:        r.channel,
      inbound:        parseInt(r.inbound, 10),
      outbound:       parseInt(r.outbound, 10),
      automated:      parseInt(r.automated, 10),
      avgResponseSec: r.avg_resp ? Math.round(parseFloat(r.avg_resp)) : null,
    }));
  } catch (err) {
    logger.warn({ err }, 'omni channel metrics failed — returning empty');
    return [];
  }
}

async function readOmniFunnel(
  client: PoolClient, clinicId: string, start: string, end: string, tz: string,
): Promise<{ contacted: number; responded: number; scheduled: number; completed: number }> {
  try {
    const res = await client.query<{ contacted: string; responded: string; scheduled: string; completed: string }>(
      `WITH window_msgs AS (
         SELECT DISTINCT conversation_id
           FROM omni.messages
          WHERE clinic_id  = $1
            AND created_at >= ($2::timestamp AT TIME ZONE $4)
            AND created_at <  ($3::timestamp + INTERVAL '1 day') AT TIME ZONE $4
       ),
       responded AS (
         SELECT m.conversation_id
           FROM omni.messages m
           JOIN window_msgs w ON w.conversation_id = m.conversation_id
          WHERE m.direction = 'outbound'
          GROUP BY m.conversation_id
       ),
       scheduled AS (
         SELECT DISTINCT a.id
           FROM shared.appointments a
           JOIN omni.conversations c ON c.patient_id = a.patient_id
           JOIN window_msgs w ON w.conversation_id = c.id
          WHERE a.clinic_id  = $1
            AND a.created_at >= ($2::timestamp AT TIME ZONE $4)
            AND a.created_at <  ($3::timestamp + INTERVAL '1 day') AT TIME ZONE $4
       ),
       completed AS (
         SELECT DISTINCT a.id
           FROM shared.appointments a
           JOIN omni.conversations c ON c.patient_id = a.patient_id
           JOIN window_msgs w ON w.conversation_id = c.id
          WHERE a.clinic_id = $1
            AND a.status    = 'completed'
            AND a.scheduled_at >= ($2::timestamp AT TIME ZONE $4)
            AND a.scheduled_at <  ($3::timestamp + INTERVAL '1 day') AT TIME ZONE $4
       )
       SELECT (SELECT COUNT(*) FROM window_msgs)::text AS contacted,
              (SELECT COUNT(*) FROM responded)::text   AS responded,
              (SELECT COUNT(*) FROM scheduled)::text   AS scheduled,
              (SELECT COUNT(*) FROM completed)::text   AS completed`,
      [clinicId, start, end, tz],
    );
    const r = res.rows[0];
    return {
      contacted: parseInt(r?.contacted ?? '0', 10),
      responded: parseInt(r?.responded ?? '0', 10),
      scheduled: parseInt(r?.scheduled ?? '0', 10),
      completed: parseInt(r?.completed ?? '0', 10),
    };
  } catch (err) {
    logger.warn({ err }, 'omni funnel failed');
    return { contacted: 0, responded: 0, scheduled: 0, completed: 0 };
  }
}

/* ── 5) Financial Advanced ───────────────────────────────────────────────── */

export interface FinancialAdvanced {
  range: { start: string; end: string };
  cached: boolean;
  generatedAt: string;
  kpis: {
    revenue:     KpiValue;
    netRevenue:  KpiValue;
    refunds:     KpiValue;
    avgTicket:   KpiValue;
    paidInvoices: KpiValue;
    overdueAmount: KpiValue;
  };
  byMethod: Array<{ method: string; amount: number; count: number; share: number }>;
  agingBuckets: {
    current: number;
    d0_30:   number;
    d31_60:  number;
    d61_90:  number;
    d90Plus: number;
  };
  topServices: Array<{ id: string; name: string; revenue: number; count: number }>;
  byProvider:  Array<{ providerId: string; providerName: string; revenue: number; commission: number | null }>;
}

export async function getFinancialAdvanced(
  clinicId: string,
  range: { start: string; end: string },
): Promise<FinancialAdvanced> {
  const timezone = await fetchClinicTimezone(clinicId);
  const cacheKey = makeCacheKey([
    'analytics', clinicId, 'financial', hashRange(range.start, range.end),
  ]);

  const { data, cached } = await withCache<Omit<FinancialAdvanced, 'cached' | 'generatedAt'>>(
    cacheKey, 300,
    async () => withClinicContext(clinicId, async (client) => {
      const prev = previousRange(range.start, range.end);

      const [
        kpisCurr, kpisPrev,
        byMethod, agingBuckets, topServicesFin, byProvider,
      ] = await Promise.all([
        readFinancialKpis(client, clinicId, range.start, range.end, timezone),
        readFinancialKpis(client, clinicId, prev.start, prev.end, timezone),
        readPaymentsByMethod(client, clinicId, range.start, range.end, timezone),
        readAgingBuckets(client, clinicId),
        readTopServicesFinancial(client, clinicId, range.start, range.end, timezone),
        readRevenueByProvider(client, clinicId, range.start, range.end, timezone),
      ]);

      const kpis = {
        revenue: {
          value: kpisCurr.revenue,
          trendPct: trend(kpisCurr.revenue, kpisPrev.revenue),
          unit: 'currency' as const,
        },
        netRevenue: {
          value: kpisCurr.netRevenue,
          trendPct: trend(kpisCurr.netRevenue, kpisPrev.netRevenue),
          unit: 'currency' as const,
        },
        refunds: {
          value: kpisCurr.refunds,
          trendPct: trend(kpisCurr.refunds, kpisPrev.refunds),
          unit: 'currency' as const,
        },
        avgTicket: {
          value: kpisCurr.avgTicket,
          trendPct: trend(kpisCurr.avgTicket, kpisPrev.avgTicket),
          unit: 'currency' as const,
        },
        paidInvoices: {
          value: kpisCurr.paidInvoices,
          trendPct: trend(kpisCurr.paidInvoices, kpisPrev.paidInvoices),
          unit: 'count' as const,
        },
        overdueAmount: {
          value: kpisCurr.overdueAmount,
          trendPct: null,
          unit: 'currency' as const,
        },
      };

      return {
        range: { start: range.start, end: range.end },
        kpis, byMethod, agingBuckets,
        topServices: topServicesFin,
        byProvider,
      };
    }),
  );

  return { ...data, cached, generatedAt: new Date().toISOString() };
}

interface FinKpis {
  revenue: number;
  netRevenue: number;
  refunds: number;
  avgTicket: number | null;
  paidInvoices: number;
  overdueAmount: number;
}

async function readFinancialKpis(
  client: PoolClient, clinicId: string, start: string, end: string, tz: string,
): Promise<FinKpis> {
  const res = await client.query<{
    revenue: string; refunds: string; paid_count: string; overdue: string;
  }>(
    `SELECT
       COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'pagamento' AND p.status = 'aprovado'), 0)::text AS revenue,
       COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'estorno'   AND p.status = 'aprovado'), 0)::text AS refunds,
       COALESCE(COUNT(DISTINCT p.invoice_id) FILTER (WHERE p.payment_type = 'pagamento' AND p.status = 'aprovado'), 0)::text AS paid_count,
       (SELECT COALESCE(SUM(amount_due), 0)::text
          FROM financial.invoices
         WHERE clinic_id   = $1
           AND deleted_at IS NULL
           AND amount_due  > 0
           AND due_date    < CURRENT_DATE
           AND status NOT IN ('paga','cancelada','estornada','rascunho')
       ) AS overdue
       FROM financial.payments p
      WHERE p.clinic_id   = $1
        AND p.deleted_at IS NULL
        AND p.received_at >= ($2::timestamp AT TIME ZONE $4)
        AND p.received_at <  ($3::timestamp + INTERVAL '1 day') AT TIME ZONE $4`,
    [clinicId, start, end, tz],
  );
  const r = res.rows[0];
  const revenue = parseFloat(r?.revenue ?? '0');
  const refunds = parseFloat(r?.refunds ?? '0');
  const paid    = parseInt(r?.paid_count ?? '0', 10);
  return {
    revenue,
    netRevenue:    revenue - refunds,
    refunds,
    avgTicket:     paid > 0 ? revenue / paid : null,
    paidInvoices:  paid,
    overdueAmount: parseFloat(r?.overdue ?? '0'),
  };
}

async function readPaymentsByMethod(
  client: PoolClient, clinicId: string, start: string, end: string, tz: string,
): Promise<Array<{ method: string; amount: number; count: number; share: number }>> {
  const res = await client.query<{ method: string; amount: string; count: string }>(
    `SELECT p.payment_method::text AS method,
            COALESCE(SUM(p.amount), 0)::text AS amount,
            COUNT(*)::text                   AS count
       FROM financial.payments p
      WHERE p.clinic_id    = $1
        AND p.payment_type = 'pagamento'
        AND p.status       = 'aprovado'
        AND p.deleted_at  IS NULL
        AND p.received_at >= ($2::timestamp AT TIME ZONE $4)
        AND p.received_at <  ($3::timestamp + INTERVAL '1 day') AT TIME ZONE $4
      GROUP BY p.payment_method
      ORDER BY SUM(p.amount) DESC`,
    [clinicId, start, end, tz],
  );
  const rows = res.rows.map((r) => ({
    method: r.method,
    amount: parseFloat(r.amount),
    count:  parseInt(r.count, 10),
  }));
  const total = rows.reduce((acc, r) => acc + r.amount, 0);
  return rows.map((r) => ({ ...r, share: total > 0 ? r.amount / total : 0 }));
}

async function readAgingBuckets(
  client: PoolClient, clinicId: string,
): Promise<{ current: number; d0_30: number; d31_60: number; d61_90: number; d90Plus: number }> {
  const res = await client.query<{
    current: string; d0_30: string; d31_60: string; d61_90: string; d90_plus: string;
  }>(
    `SELECT
       COALESCE(SUM(amount_due) FILTER (WHERE due_date >= CURRENT_DATE), 0)::text AS current,
       COALESCE(SUM(amount_due) FILTER (WHERE due_date <  CURRENT_DATE
                 AND due_date >= CURRENT_DATE - INTERVAL '30 days'), 0)::text AS d0_30,
       COALESCE(SUM(amount_due) FILTER (WHERE due_date <  CURRENT_DATE - INTERVAL '30 days'
                 AND due_date >= CURRENT_DATE - INTERVAL '60 days'), 0)::text AS d31_60,
       COALESCE(SUM(amount_due) FILTER (WHERE due_date <  CURRENT_DATE - INTERVAL '60 days'
                 AND due_date >= CURRENT_DATE - INTERVAL '90 days'), 0)::text AS d61_90,
       COALESCE(SUM(amount_due) FILTER (WHERE due_date <  CURRENT_DATE - INTERVAL '90 days'), 0)::text AS d90_plus
       FROM financial.invoices
      WHERE clinic_id  = $1
        AND deleted_at IS NULL
        AND amount_due > 0
        AND status NOT IN ('paga','cancelada','estornada','rascunho')`,
    [clinicId],
  );
  const r = res.rows[0];
  return {
    current: parseFloat(r?.current ?? '0'),
    d0_30:   parseFloat(r?.d0_30 ?? '0'),
    d31_60:  parseFloat(r?.d31_60 ?? '0'),
    d61_90:  parseFloat(r?.d61_90 ?? '0'),
    d90Plus: parseFloat(r?.d90_plus ?? '0'),
  };
}

async function readTopServicesFinancial(
  client: PoolClient, clinicId: string, start: string, end: string, tz: string,
): Promise<Array<{ id: string; name: string; revenue: number; count: number }>> {
  const res = await client.query<{ id: string; name: string; revenue: string; count: string }>(
    `SELECT s.id, s.name,
            COALESCE(SUM(ii.total_price), 0)::text AS revenue,
            COUNT(DISTINCT a.id)::text             AS count
       FROM shared.appointments a
       JOIN shared.services s ON s.id = a.service_id
       LEFT JOIN financial.invoices i ON i.appointment_id = a.id AND i.status = 'paga'
       LEFT JOIN financial.invoice_items ii ON ii.invoice_id = i.id
      WHERE a.clinic_id    = $1
        AND a.scheduled_at >= ($2::timestamp AT TIME ZONE $4)
        AND a.scheduled_at <  ($3::timestamp + INTERVAL '1 day') AT TIME ZONE $4
        AND a.status       = 'completed'
      GROUP BY s.id, s.name
      ORDER BY SUM(ii.total_price) DESC NULLS LAST
      LIMIT 10`,
    [clinicId, start, end, tz],
  );
  return res.rows.map((r) => ({
    id:      r.id,
    name:    r.name,
    revenue: parseFloat(r.revenue),
    count:   parseInt(r.count, 10),
  }));
}

async function readRevenueByProvider(
  client: PoolClient, clinicId: string, start: string, end: string, tz: string,
): Promise<Array<{ providerId: string; providerName: string; revenue: number; commission: number | null }>> {
  const res = await client.query<{
    provider_id: string; provider_name: string; revenue: string;
  }>(
    `SELECT a.provider_id,
            u.name AS provider_name,
            COALESCE(SUM(ii.total_price), 0)::text AS revenue
       FROM shared.appointments a
       JOIN shared.users u ON u.id = a.provider_id
       LEFT JOIN financial.invoices i ON i.appointment_id = a.id AND i.status = 'paga'
       LEFT JOIN financial.invoice_items ii ON ii.invoice_id = i.id
      WHERE a.clinic_id    = $1
        AND a.scheduled_at >= ($2::timestamp AT TIME ZONE $4)
        AND a.scheduled_at <  ($3::timestamp + INTERVAL '1 day') AT TIME ZONE $4
        AND a.status       = 'completed'
      GROUP BY a.provider_id, u.name
      ORDER BY SUM(ii.total_price) DESC NULLS LAST
      LIMIT 20`,
    [clinicId, start, end, tz],
  );
  return res.rows.map((r) => ({
    providerId:   r.provider_id,
    providerName: r.provider_name,
    revenue:      parseFloat(r.revenue),
    commission:   null, // commission % vive em users/contracts — fica null por enquanto
  }));
}
