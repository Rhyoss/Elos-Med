/**
 * Dashboard Service — endpoints contextuais por papel.
 *
 * Características:
 *  - RLS via withClinicContext para todas as queries.
 *  - Cache Redis com fallback gracioso para query direta.
 *  - Proteção contra divisão por zero (retorna null em vez de NaN/Infinity).
 *  - Sem exposição de valores monetários a roles que não têm permissão.
 *  - Saudações respeitam timezone da clínica.
 *  - Fila de espera nunca é cacheada (sempre real-time via Socket.io).
 */

import { TRPCError } from '@trpc/server';
import { withClinicContext, db } from '../../db/client.js';
import { decryptOptional } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';
import {
  hashRange,
  makeCacheKey,
  withCache,
} from './dashboard.cache.js';

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface DoctorDashboard {
  greeting:        { text: string; timeOfDay: 'morning' | 'afternoon' | 'evening'; doctorName: string };
  agenda:          AgendaItem[];
  nextPatient:     AgendaItem | null;
  pendingBiopsies: { count: number; items: BiopsyItem[] };
  protocolsToday:  ProtocolSessionItem[];
  noReturn30d:     NoReturnPatient[];
  monthStats:      { consultations: number; newPatients: number; procedures: number };
  generatedAt:     string;
}

export interface AgendaItem {
  id:             string;
  patientId:      string;
  patientName:    string;
  patientPhotoUrl: string | null;
  scheduledAt:    string;
  durationMin:    number;
  type:           string;
  status:         string;
  serviceName:    string | null;
  providerName?:  string;
  providerId?:    string;
  checkedInAt?:   string | null;
}

export interface BiopsyItem {
  id:           string;
  patientId:    string;
  patientName:  string;
  collectedAt:  string;
  type:         string;
  status:       string;
}

export interface ProtocolSessionItem {
  protocolId:      string;
  patientId:       string;
  patientName:     string;
  protocolName:    string;
  sessionN:        number;
  totalSessions:   number;
  scheduledAt:     string | null;
}

export interface NoReturnPatient {
  patientId:      string;
  patientName:    string;
  lastVisitAt:    string | null;
  daysSinceVisit: number;
}

export interface ReceptionDashboard {
  agenda:         AgendaItem[];
  alerts:         {
    pendingDebts:        number;
    pendingConfirmations: number;
    birthdaysToday:      number;
  };
  generatedAt:    string;
}

export interface AdminDashboard {
  range:    { start: string; end: string };
  kpis: {
    revenue:         KpiValue;     // null para roles sem permissão financeira
    occupancyRate:   KpiValue;
    avgTicket:       KpiValue;
    noShowRate:      KpiValue;
    newPatients:     KpiValue;
  };
  charts: {
    revenue30d:        Array<{ date: string; value: number | null }>;
    typeDistribution:  Array<{ type: string; count: number; percentage: number }>;
    occupancyByDoctor: Array<{ providerId: string; providerName: string; occupancyRate: number | null }>;
  };
  topServices: Array<{ id: string; name: string; count: number; revenue: number | null }>;
  alerts: {
    stockCritical:   number;
    invoicesOverdue: { count: number; totalAmount: number | null };
    biopsiesPending: number;
  };
  generatedAt:  string;
  cached:       boolean;
}

export interface KpiValue {
  value:    number | null;
  trendPct: number | null;     // percentual de variação vs período anterior
  unit?:    'currency' | 'percent' | 'count';
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const FINANCIAL_ROLES = new Set(['admin', 'owner', 'financial']);

export function canViewFinancials(role: string | null | undefined): boolean {
  if (!role) return false;
  return FINANCIAL_ROLES.has(role);
}

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

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseTargetDate(input: string | undefined, timezone: string): Date {
  if (input) return new Date(`${input}T12:00:00`);
  const now = new Date();
  // Para a query usaremos AT TIME ZONE no banco; para greeting usamos hora local da clínica via Intl.
  return now;
}

function timeOfDayInTimezone(date: Date, timezone: string): 'morning' | 'afternoon' | 'evening' {
  try {
    const formatter = new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, hour: '2-digit', hour12: false });
    const parts = formatter.formatToParts(date);
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  } catch {
    const h = date.getHours();
    return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  }
}

function greetingFor(timeOfDay: 'morning' | 'afternoon' | 'evening'): string {
  switch (timeOfDay) {
    case 'morning':   return 'Bom dia';
    case 'afternoon': return 'Boa tarde';
    case 'evening':   return 'Boa noite';
  }
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

async function ensureProviderInTenant(userId: string, clinicId: string): Promise<string> {
  const res = await db.query<{ id: string; name: string; role: string; is_active: boolean }>(
    `SELECT id, name, role, is_active
       FROM shared.users
      WHERE id = $1 AND clinic_id = $2`,
    [userId, clinicId],
  );
  const row = res.rows[0];
  if (!row || !row.is_active) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Profissional não encontrado nesta clínica' });
  }
  if (!['dermatologist', 'nurse'].includes(row.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Usuário não é um profissional de saúde ativo' });
  }
  return row.name;
}

/* ── Doctor Dashboard ────────────────────────────────────────────────────── */

export async function getDoctorDashboard(
  userId:   string,
  clinicId: string,
  dateInput: string | undefined,
): Promise<DoctorDashboard> {
  const timezone     = await fetchClinicTimezone(clinicId);
  const doctorName   = await ensureProviderInTenant(userId, clinicId);
  const targetDate   = parseTargetDate(dateInput, timezone);
  const targetIso    = dateInput ?? isoDay(targetDate);

  const cacheKey = makeCacheKey(['doctor', clinicId, userId, targetIso]);
  const { data } = await withCache<Omit<DoctorDashboard, 'greeting' | 'generatedAt'>>(
    cacheKey,
    300,
    async () => withClinicContext(clinicId, async (client) => {
      const dayStart = `${targetIso}T00:00:00`;
      const dayEnd   = `${targetIso}T23:59:59.999`;

      // Agenda do dia (provider específico)
      const agendaRes = await client.query<{
        id: string; patient_id: string; patient_name: string | null;
        patient_photo_url: string | null;
        scheduled_at: string; duration_min: number; type: string;
        status: string; status_history: Array<{ status: string; changed_at: string }>;
        service_name: string | null;
      }>(
        `SELECT a.id, a.patient_id, p.name AS patient_name, p.photo_url AS patient_photo_url,
                a.scheduled_at, a.duration_min, a.type, a.status, a.status_history,
                s.name AS service_name
           FROM shared.appointments a
           JOIN shared.patients p ON p.id = a.patient_id
           LEFT JOIN shared.services s ON s.id = a.service_id
          WHERE a.clinic_id   = $1
            AND a.provider_id = $2
            AND a.scheduled_at >= ($3::timestamp AT TIME ZONE $5)
            AND a.scheduled_at <  ($4::timestamp AT TIME ZONE $5)
          ORDER BY a.scheduled_at ASC`,
        [clinicId, userId, dayStart, dayEnd, timezone],
      );

      const agenda: AgendaItem[] = agendaRes.rows.map((r) => {
        const checkIn = r.status_history?.find((h) => h.status === 'waiting');
        return {
          id:              r.id,
          patientId:       r.patient_id,
          patientName:     decryptOptional(r.patient_name) ?? r.patient_name ?? 'Paciente',
          patientPhotoUrl: r.patient_photo_url,
          scheduledAt:     new Date(r.scheduled_at).toISOString(),
          durationMin:     r.duration_min,
          type:            r.type,
          status:          r.status,
          serviceName:     r.service_name,
          checkedInAt:     checkIn ? checkIn.changed_at : null,
        };
      });

      // Próximo paciente: status 'scheduled', 'confirmed' ou 'waiting' a partir de agora
      const now = new Date();
      const nextPatient =
        agenda.find(
          (a) =>
            new Date(a.scheduledAt) >= now &&
            ['scheduled', 'confirmed', 'waiting', 'in_progress'].includes(a.status),
        ) ?? null;

      // Biópsias pendentes do provider
      const biopsyRes = await client.query<{
        id: string; patient_id: string; patient_name: string | null;
        collected_at: string; type: string; status: string;
      }>(
        `SELECT b.id, b.patient_id, p.name AS patient_name,
                b.collected_at, b.type::text AS type, b.status::text AS status
           FROM clinical.biopsies b
           JOIN shared.patients p ON p.id = b.patient_id
          WHERE b.clinic_id    = $1
            AND b.performed_by = $2
            AND b.status NOT IN ('resultado_comunicado')
          ORDER BY b.collected_at ASC
          LIMIT 50`,
        [clinicId, userId],
      );
      const biopsies: BiopsyItem[] = biopsyRes.rows.map((r) => ({
        id:           r.id,
        patientId:    r.patient_id,
        patientName:  decryptOptional(r.patient_name) ?? r.patient_name ?? 'Paciente',
        collectedAt:  new Date(r.collected_at).toISOString(),
        type:         r.type,
        status:       r.status,
      }));

      // Protocolos hoje (sessões agendadas)
      const protoRes = await client.query<{
        protocol_id: string; protocol_name: string;
        patient_id: string; patient_name: string | null;
        session_n: number; total_sessions: number;
        scheduled_at: string | null;
      }>(
        `SELECT pr.id            AS protocol_id,
                pr.name          AS protocol_name,
                pr.patient_id,
                p.name           AS patient_name,
                (pr.sessions_done + 1) AS session_n,
                pr.total_sessions,
                a.scheduled_at
           FROM clinical.protocols pr
           JOIN shared.patients p ON p.id = pr.patient_id
           LEFT JOIN shared.appointments a
             ON a.protocol_id = pr.id
            AND a.scheduled_at >= ($2::timestamp AT TIME ZONE $4)
            AND a.scheduled_at <  ($3::timestamp AT TIME ZONE $4)
          WHERE pr.clinic_id   = $1
            AND pr.provider_id = $5
            AND pr.status      = 'ativo'
            AND a.id IS NOT NULL
          ORDER BY a.scheduled_at ASC NULLS LAST
          LIMIT 50`,
        [clinicId, dayStart, dayEnd, timezone, userId],
      );
      const protocolsToday: ProtocolSessionItem[] = protoRes.rows.map((r) => ({
        protocolId:    r.protocol_id,
        protocolName:  r.protocol_name,
        patientId:     r.patient_id,
        patientName:   decryptOptional(r.patient_name) ?? r.patient_name ?? 'Paciente',
        sessionN:      r.session_n,
        totalSessions: r.total_sessions,
        scheduledAt:   r.scheduled_at ? new Date(r.scheduled_at).toISOString() : null,
      }));

      // Sem retorno > 30 dias (provider específico) — limite 10
      const noReturnRes = await client.query<{
        patient_id: string; patient_name: string | null;
        last_visit_at: string | null; days: number;
      }>(
        `WITH last_seen AS (
           SELECT a.patient_id,
                  MAX(a.scheduled_at) AS last_visit_at
             FROM shared.appointments a
            WHERE a.clinic_id   = $1
              AND a.provider_id = $2
              AND a.status IN ('completed','no_show')
            GROUP BY a.patient_id
         ),
         future AS (
           SELECT DISTINCT a.patient_id
             FROM shared.appointments a
            WHERE a.clinic_id   = $1
              AND a.provider_id = $2
              AND a.scheduled_at > NOW()
              AND a.status IN ('scheduled','confirmed')
         )
         SELECT ls.patient_id,
                p.name AS patient_name,
                ls.last_visit_at,
                EXTRACT(DAY FROM NOW() - ls.last_visit_at)::int AS days
           FROM last_seen ls
           JOIN shared.patients p ON p.id = ls.patient_id
          WHERE ls.last_visit_at < NOW() - INTERVAL '30 days'
            AND ls.patient_id NOT IN (SELECT patient_id FROM future)
            AND p.deleted_at IS NULL
          ORDER BY ls.last_visit_at ASC
          LIMIT 10`,
        [clinicId, userId],
      );
      const noReturn30d: NoReturnPatient[] = noReturnRes.rows.map((r) => ({
        patientId:      r.patient_id,
        patientName:    decryptOptional(r.patient_name) ?? r.patient_name ?? 'Paciente',
        lastVisitAt:    r.last_visit_at ? new Date(r.last_visit_at).toISOString() : null,
        daysSinceVisit: r.days,
      }));

      // Stats do mês corrente (do médico)
      const statsRes = await client.query<{
        consultations: string; new_patients: string; procedures: string;
      }>(
        `WITH bounds AS (
           SELECT date_trunc('month', NOW() AT TIME ZONE $3) AS start_local
         )
         SELECT
           (SELECT COUNT(*) FROM shared.appointments a
              WHERE a.clinic_id   = $1
                AND a.provider_id = $2
                AND a.status      = 'completed'
                AND a.scheduled_at >= (SELECT start_local FROM bounds) AT TIME ZONE $3
           )::text AS consultations,
           (SELECT COUNT(DISTINCT p.id) FROM shared.patients p
              JOIN shared.appointments a ON a.patient_id = p.id
              WHERE a.clinic_id   = $1
                AND a.provider_id = $2
                AND p.created_at >= (SELECT start_local FROM bounds) AT TIME ZONE $3
                AND p.deleted_at IS NULL
           )::text AS new_patients,
           (SELECT COUNT(*) FROM clinical.protocol_sessions ps
              WHERE ps.clinic_id   = $1
                AND ps.performed_by = $2
                AND ps.performed_at >= (SELECT start_local FROM bounds) AT TIME ZONE $3
           )::text AS procedures`,
        [clinicId, userId, timezone],
      );
      const monthStats = {
        consultations: parseInt(statsRes.rows[0]?.consultations ?? '0', 10),
        newPatients:   parseInt(statsRes.rows[0]?.new_patients ?? '0', 10),
        procedures:    parseInt(statsRes.rows[0]?.procedures ?? '0', 10),
      };

      return {
        agenda,
        nextPatient,
        pendingBiopsies: { count: biopsies.length, items: biopsies.slice(0, 5) },
        protocolsToday,
        noReturn30d,
        monthStats,
      };
    }),
  );

  const tod = timeOfDayInTimezone(targetDate, timezone);
  const greetingText = (() => {
    const consultationsToday = data.agenda.filter((a) =>
      ['scheduled', 'confirmed', 'waiting', 'in_progress', 'completed'].includes(a.status),
    ).length;
    const firstName = doctorName.split(' ')[0] ?? doctorName;
    if (consultationsToday === 0) {
      return `${greetingFor(tod)}, Dr(a). ${firstName}. Você não tem consultas agendadas hoje.`;
    }
    return `${greetingFor(tod)}, Dr(a). ${firstName}. Você tem ${consultationsToday} consulta${
      consultationsToday > 1 ? 's' : ''
    } hoje.`;
  })();

  return {
    greeting: { text: greetingText, timeOfDay: tod, doctorName },
    ...data,
    generatedAt: new Date().toISOString(),
  };
}

/* ── Reception Dashboard ─────────────────────────────────────────────────── */

export async function getReceptionDashboard(
  clinicId: string,
  dateInput: string | undefined,
): Promise<ReceptionDashboard> {
  const timezone  = await fetchClinicTimezone(clinicId);
  const targetIso = dateInput ?? isoDay(new Date());

  const cacheKey = makeCacheKey(['reception', clinicId, targetIso]);
  const { data } = await withCache<{
    agenda: AgendaItem[];
    alerts: { pendingDebts: number; pendingConfirmations: number; birthdaysToday: number };
  }>(cacheKey, 60, async () =>
    withClinicContext(clinicId, async (client) => {
      const dayStart = `${targetIso}T00:00:00`;
      const dayEnd   = `${targetIso}T23:59:59.999`;
      const tomorrowIso = isoDay(new Date(new Date(`${targetIso}T12:00:00`).getTime() + 86_400_000));
      const tomorrowStart = `${tomorrowIso}T00:00:00`;
      const tomorrowEnd   = `${tomorrowIso}T23:59:59.999`;

      const agendaRes = await client.query<{
        id: string; patient_id: string; patient_name: string | null;
        patient_photo_url: string | null;
        scheduled_at: string; duration_min: number; type: string;
        status: string; service_name: string | null;
        provider_id: string; provider_name: string;
      }>(
        `SELECT a.id, a.patient_id, p.name AS patient_name, p.photo_url AS patient_photo_url,
                a.scheduled_at, a.duration_min, a.type, a.status,
                s.name AS service_name,
                a.provider_id, u.name AS provider_name
           FROM shared.appointments a
           JOIN shared.patients p ON p.id = a.patient_id
           JOIN shared.users    u ON u.id = a.provider_id
           LEFT JOIN shared.services s ON s.id = a.service_id
          WHERE a.clinic_id = $1
            AND a.scheduled_at >= ($2::timestamp AT TIME ZONE $4)
            AND a.scheduled_at <  ($3::timestamp AT TIME ZONE $4)
          ORDER BY a.scheduled_at ASC`,
        [clinicId, dayStart, dayEnd, timezone],
      );
      const agenda: AgendaItem[] = agendaRes.rows.map((r) => ({
        id:              r.id,
        patientId:       r.patient_id,
        patientName:     decryptOptional(r.patient_name) ?? r.patient_name ?? 'Paciente',
        patientPhotoUrl: r.patient_photo_url,
        scheduledAt:     new Date(r.scheduled_at).toISOString(),
        durationMin:     r.duration_min,
        type:            r.type,
        status:          r.status,
        serviceName:     r.service_name,
        providerId:      r.provider_id,
        providerName:    r.provider_name,
      }));

      // Débitos pendentes — pacientes com fatura amount_due > 0
      const debtRes = await client.query<{ count: string }>(
        `SELECT COUNT(DISTINCT i.patient_id)::text AS count
           FROM financial.invoices i
          WHERE i.clinic_id = $1
            AND i.amount_due > 0
            AND i.status NOT IN ('cancelada','estornada','rascunho')
            AND i.deleted_at IS NULL`,
        [clinicId],
      );

      // Confirmações pendentes amanhã
      const confirmRes = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM shared.appointments a
          WHERE a.clinic_id = $1
            AND a.scheduled_at >= ($2::timestamp AT TIME ZONE $4)
            AND a.scheduled_at <  ($3::timestamp AT TIME ZONE $4)
            AND a.status = 'scheduled'
            AND a.confirmed_at IS NULL`,
        [clinicId, tomorrowStart, tomorrowEnd, timezone],
      );

      // Aniversariantes de hoje (timezone aware)
      const birthRes = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM shared.patients p
          WHERE p.clinic_id = $1
            AND p.deleted_at IS NULL
            AND p.birth_date IS NOT NULL
            AND EXTRACT(MONTH FROM p.birth_date) = EXTRACT(MONTH FROM (NOW() AT TIME ZONE $2)::date)
            AND EXTRACT(DAY   FROM p.birth_date) = EXTRACT(DAY   FROM (NOW() AT TIME ZONE $2)::date)`,
        [clinicId, timezone],
      );

      return {
        agenda,
        alerts: {
          pendingDebts:         parseInt(debtRes.rows[0]?.count ?? '0', 10),
          pendingConfirmations: parseInt(confirmRes.rows[0]?.count ?? '0', 10),
          birthdaysToday:       parseInt(birthRes.rows[0]?.count ?? '0', 10),
        },
      };
    }),
  );

  return { ...data, generatedAt: new Date().toISOString() };
}

/* ── Admin Dashboard ─────────────────────────────────────────────────────── */

export async function getAdminDashboard(
  clinicId:    string,
  range:       { start: string; end: string },
  role:        string,
): Promise<AdminDashboard> {
  const timezone = await fetchClinicTimezone(clinicId);
  const includeFinancial = canViewFinancials(role);

  const startDate = new Date(`${range.start}T00:00:00Z`);
  const endDate   = new Date(`${range.end}T23:59:59.999Z`);
  const days      = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1);

  const cacheKey = makeCacheKey([
    'admin', clinicId, includeFinancial ? 'fin' : 'nofin', hashRange(range.start, range.end),
  ]);

  const { data, cached } = await withCache<Omit<AdminDashboard, 'cached' | 'generatedAt'>>(
    cacheKey,
    300,
    async () => withClinicContext(clinicId, async (client) => {
      const startStr = range.start;
      const endStr   = range.end;
      const prevEnd  = new Date(startDate.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - days * 86_400_000 + 1);
      const prevStartStr = prevStart.toISOString().slice(0, 10);
      const prevEndStr   = prevEnd.toISOString().slice(0, 10);

      // KPIs base + período anterior em paralelo
      const [appointmentsCurr, appointmentsPrev, patientsCurr, patientsPrev,
             revenueCurr, revenuePrev, payCountCurr, payCountPrev,
             revenueDaily, typeDist, occupancyByDoctor, topServices,
             stockAlertsRes, invoicesOverdueRes, biopsiesPendingRes] = await Promise.all([
        appointmentsAggregate(client, clinicId, startStr, endStr, timezone),
        appointmentsAggregate(client, clinicId, prevStartStr, prevEndStr, timezone),
        newPatientsCount(client, clinicId, startStr, endStr, timezone),
        newPatientsCount(client, clinicId, prevStartStr, prevEndStr, timezone),
        includeFinancial ? revenueAggregate(client, clinicId, startStr, endStr, timezone) : Promise.resolve({ total: null, paidCount: null }),
        includeFinancial ? revenueAggregate(client, clinicId, prevStartStr, prevEndStr, timezone) : Promise.resolve({ total: null, paidCount: null }),
        includeFinancial ? paidAppointmentsCount(client, clinicId, startStr, endStr, timezone) : Promise.resolve(null),
        includeFinancial ? paidAppointmentsCount(client, clinicId, prevStartStr, prevEndStr, timezone) : Promise.resolve(null),
        includeFinancial ? revenueDailySeries(client, clinicId, startStr, endStr, timezone) : Promise.resolve([]),
        appointmentTypeDistribution(client, clinicId, startStr, endStr, timezone),
        occupancyByDoctorAggregate(client, clinicId, startStr, endStr, timezone),
        topServicesAggregate(client, clinicId, startStr, endStr, timezone, includeFinancial),
        stockAlertsCount(client, clinicId),
        includeFinancial ? overdueInvoices(client, clinicId) : Promise.resolve({ count: 0, total: null }),
        biopsiesPendingCount(client, clinicId),
      ]);

      // Receita
      const revenueValue = includeFinancial ? revenueCurr.total : null;
      const revenuePrevValue = includeFinancial ? revenuePrev.total : null;
      const revenue: KpiValue = {
        value: revenueValue,
        trendPct: trend(revenueValue, revenuePrevValue),
        unit: 'currency',
      };

      // Ocupação
      const occupancyRate: KpiValue = {
        value:    safeRate(appointmentsCurr.scheduledSlots, appointmentsCurr.availableSlots),
        trendPct: trend(
          safeRate(appointmentsCurr.scheduledSlots, appointmentsCurr.availableSlots),
          safeRate(appointmentsPrev.scheduledSlots, appointmentsPrev.availableSlots),
        ),
        unit: 'percent',
      };

      // Ticket médio
      const avgTicketCurr = includeFinancial ? safeRate(revenueValue ?? 0, payCountCurr ?? 0) : null;
      const avgTicketPrev = includeFinancial ? safeRate(revenuePrevValue ?? 0, payCountPrev ?? 0) : null;
      const avgTicket: KpiValue = {
        value:    avgTicketCurr,
        trendPct: trend(avgTicketCurr, avgTicketPrev),
        unit:     'currency',
      };

      // No-show
      const noShowRateCurr = safeRate(appointmentsCurr.noShow, appointmentsCurr.total);
      const noShowRatePrev = safeRate(appointmentsPrev.noShow, appointmentsPrev.total);
      const noShowRate: KpiValue = {
        value:    noShowRateCurr,
        trendPct: trend(noShowRateCurr, noShowRatePrev),
        unit:     'percent',
      };

      // Novos pacientes
      const newPatients: KpiValue = {
        value:    patientsCurr,
        trendPct: trend(patientsCurr, patientsPrev),
        unit:     'count',
      };

      return {
        range:    { start: range.start, end: range.end },
        kpis:     { revenue, occupancyRate, avgTicket, noShowRate, newPatients },
        charts: {
          revenue30d:        revenueDaily,
          typeDistribution:  typeDist,
          occupancyByDoctor,
        },
        topServices,
        alerts: {
          stockCritical:   stockAlertsRes,
          invoicesOverdue: invoicesOverdueRes,
          biopsiesPending: biopsiesPendingRes,
        },
      };
    }),
  );

  return { ...data, cached, generatedAt: new Date().toISOString() };
}

/* ── Admin helpers ───────────────────────────────────────────────────────── */

interface ApptAgg {
  total:           number;
  scheduledSlots:  number;
  availableSlots:  number;
  noShow:          number;
}

async function appointmentsAggregate(
  client: import('pg').PoolClient,
  clinicId: string,
  startIso: string, endIso: string,
  tz: string,
): Promise<ApptAgg> {
  const res = await client.query<{ total: string; no_show: string; scheduled_slots: string; available_slots: string }>(
    `WITH range_slots AS (
       SELECT GREATEST(1,
         (EXTRACT(EPOCH FROM (
            ($2::date + INTERVAL '1 day') - $1::date
          )) / 60 / 30)::int * (
            SELECT GREATEST(1, COUNT(*) FILTER (WHERE u.role IN ('dermatologist','nurse')))
              FROM shared.users u
             WHERE u.clinic_id = $3 AND u.is_active = true
          ) * 8 -- aproximação de 8 slots de 30min por dia ativo
       ) AS available_slots
     ),
     scheduled AS (
       SELECT COUNT(*) AS scheduled_slots
         FROM shared.appointments a
        WHERE a.clinic_id = $3
          AND a.scheduled_at >= ($1::timestamp AT TIME ZONE $4)
          AND a.scheduled_at <  ($2::timestamp + INTERVAL '1 day') AT TIME ZONE $4
          AND a.status NOT IN ('cancelled','rescheduled')
     ),
     totals AS (
       SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status = 'no_show') AS no_show
         FROM shared.appointments
        WHERE clinic_id = $3
          AND scheduled_at >= ($1::timestamp AT TIME ZONE $4)
          AND scheduled_at <  ($2::timestamp + INTERVAL '1 day') AT TIME ZONE $4
     )
     SELECT t.total::text, t.no_show::text,
            s.scheduled_slots::text,
            r.available_slots::text
       FROM totals t, scheduled s, range_slots r`,
    [startIso, endIso, clinicId, tz],
  );
  const r = res.rows[0];
  return {
    total:           parseInt(r?.total ?? '0', 10),
    scheduledSlots:  parseInt(r?.scheduled_slots ?? '0', 10),
    availableSlots:  parseInt(r?.available_slots ?? '0', 10),
    noShow:          parseInt(r?.no_show ?? '0', 10),
  };
}

async function newPatientsCount(
  client: import('pg').PoolClient,
  clinicId: string, startIso: string, endIso: string, tz: string,
): Promise<number> {
  const res = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM shared.patients
      WHERE clinic_id  = $1
        AND deleted_at IS NULL
        AND created_at >= ($2::timestamp AT TIME ZONE $4)
        AND created_at <  ($3::timestamp + INTERVAL '1 day') AT TIME ZONE $4`,
    [clinicId, startIso, endIso, tz],
  );
  return parseInt(res.rows[0]?.count ?? '0', 10);
}

async function revenueAggregate(
  client: import('pg').PoolClient,
  clinicId: string, startIso: string, endIso: string, tz: string,
): Promise<{ total: number; paidCount: number }> {
  const res = await client.query<{ total: string | null; paid_count: string }>(
    `SELECT COALESCE(SUM(p.amount), 0)::text AS total,
            COUNT(*)::text                   AS paid_count
       FROM financial.payments p
      WHERE p.clinic_id = $1
        AND p.status    = 'aprovado'
        AND p.payment_type = 'pagamento'
        AND p.deleted_at IS NULL
        AND p.received_at >= ($2::timestamp AT TIME ZONE $4)
        AND p.received_at <  ($3::timestamp + INTERVAL '1 day') AT TIME ZONE $4`,
    [clinicId, startIso, endIso, tz],
  );
  return {
    total:     parseInt(res.rows[0]?.total ?? '0', 10),
    paidCount: parseInt(res.rows[0]?.paid_count ?? '0', 10),
  };
}

async function paidAppointmentsCount(
  client: import('pg').PoolClient,
  clinicId: string, startIso: string, endIso: string, tz: string,
): Promise<number> {
  const res = await client.query<{ count: string }>(
    `SELECT COUNT(DISTINCT i.appointment_id)::text AS count
       FROM financial.invoices i
      WHERE i.clinic_id = $1
        AND i.status    = 'paga'
        AND i.appointment_id IS NOT NULL
        AND i.paid_at >= ($2::timestamp AT TIME ZONE $4)
        AND i.paid_at <  ($3::timestamp + INTERVAL '1 day') AT TIME ZONE $4`,
    [clinicId, startIso, endIso, tz],
  );
  return parseInt(res.rows[0]?.count ?? '0', 10);
}

async function revenueDailySeries(
  client: import('pg').PoolClient,
  clinicId: string, startIso: string, endIso: string, tz: string,
): Promise<Array<{ date: string; value: number | null }>> {
  const res = await client.query<{ day: string; revenue: string | null }>(
    `WITH days AS (
       SELECT generate_series($1::date, $2::date, INTERVAL '1 day')::date AS day
     )
     SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
            COALESCE(SUM(p.amount), 0)::text AS revenue
       FROM days d
       LEFT JOIN financial.payments p
         ON DATE(p.received_at AT TIME ZONE $4) = d.day
        AND p.clinic_id    = $3
        AND p.status       = 'aprovado'
        AND p.payment_type = 'pagamento'
        AND p.deleted_at IS NULL
      GROUP BY d.day
      ORDER BY d.day ASC`,
    [startIso, endIso, clinicId, tz],
  );
  return res.rows.map((r) => ({
    date:  r.day,
    value: r.revenue !== null ? parseInt(r.revenue, 10) : null,
  }));
}

async function appointmentTypeDistribution(
  client: import('pg').PoolClient,
  clinicId: string, startIso: string, endIso: string, tz: string,
): Promise<Array<{ type: string; count: number; percentage: number }>> {
  const res = await client.query<{ type: string; count: string }>(
    `SELECT a.type, COUNT(*)::text AS count
       FROM shared.appointments a
      WHERE a.clinic_id = $1
        AND a.scheduled_at >= ($2::timestamp AT TIME ZONE $4)
        AND a.scheduled_at <  ($3::timestamp + INTERVAL '1 day') AT TIME ZONE $4
        AND a.status NOT IN ('cancelled','rescheduled')
      GROUP BY a.type
      ORDER BY COUNT(*) DESC`,
    [clinicId, startIso, endIso, tz],
  );
  const total = res.rows.reduce((acc, r) => acc + parseInt(r.count, 10), 0);
  return res.rows.map((r) => {
    const c = parseInt(r.count, 10);
    return {
      type:       r.type,
      count:      c,
      percentage: total > 0 ? Math.round((c / total) * 1000) / 10 : 0,
    };
  });
}

async function occupancyByDoctorAggregate(
  client: import('pg').PoolClient,
  clinicId: string, startIso: string, endIso: string, tz: string,
): Promise<Array<{ providerId: string; providerName: string; occupancyRate: number | null }>> {
  const res = await client.query<{
    provider_id: string; provider_name: string; scheduled: string; available: string;
  }>(
    `WITH scheduled AS (
       SELECT a.provider_id, COUNT(*) AS cnt
         FROM shared.appointments a
        WHERE a.clinic_id = $1
          AND a.scheduled_at >= ($2::timestamp AT TIME ZONE $4)
          AND a.scheduled_at <  ($3::timestamp + INTERVAL '1 day') AT TIME ZONE $4
          AND a.status NOT IN ('cancelled','rescheduled')
        GROUP BY a.provider_id
     )
     SELECT u.id            AS provider_id,
            u.name          AS provider_name,
            COALESCE(s.cnt, 0)::text AS scheduled,
            ((($3::date - $2::date)::int + 1) * 16)::text AS available
       FROM shared.users u
       LEFT JOIN scheduled s ON s.provider_id = u.id
      WHERE u.clinic_id = $1
        AND u.role IN ('dermatologist','nurse')
        AND u.is_active = true
      ORDER BY scheduled DESC`,
    [clinicId, startIso, endIso, tz],
  );
  return res.rows.map((r) => {
    const sch = parseInt(r.scheduled, 10);
    const avail = parseInt(r.available, 10);
    return {
      providerId:    r.provider_id,
      providerName:  r.provider_name,
      occupancyRate: safeRate(sch, avail),
    };
  });
}

async function topServicesAggregate(
  client: import('pg').PoolClient,
  clinicId: string, startIso: string, endIso: string, tz: string,
  includeRevenue: boolean,
): Promise<Array<{ id: string; name: string; count: number; revenue: number | null }>> {
  const res = await client.query<{ id: string; name: string; count: string; revenue: string | null }>(
    `SELECT s.id,
            s.name,
            COUNT(a.id)::text AS count,
            ${includeRevenue
              ? 'COALESCE(SUM(ii.total_price), 0)::text'
              : 'NULL::text'} AS revenue
       FROM shared.appointments a
       JOIN shared.services s ON s.id = a.service_id
       ${includeRevenue
          ? `LEFT JOIN financial.invoices i  ON i.appointment_id = a.id AND i.status = 'paga'
             LEFT JOIN financial.invoice_items ii ON ii.invoice_id = i.id`
          : ''}
      WHERE a.clinic_id = $1
        AND a.scheduled_at >= ($2::timestamp AT TIME ZONE $4)
        AND a.scheduled_at <  ($3::timestamp + INTERVAL '1 day') AT TIME ZONE $4
        AND a.status = 'completed'
      GROUP BY s.id, s.name
      ORDER BY COUNT(a.id) DESC
      LIMIT 5`,
    [clinicId, startIso, endIso, tz],
  );
  return res.rows.map((r) => ({
    id:     r.id,
    name:   r.name,
    count:  parseInt(r.count, 10),
    revenue: r.revenue !== null ? parseInt(r.revenue, 10) : null,
  }));
}

async function stockAlertsCount(
  client: import('pg').PoolClient,
  clinicId: string,
): Promise<number> {
  try {
    const res = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM supply.products p
        WHERE p.clinic_id = $1
          AND p.is_active = true
          AND p.min_stock > 0
          AND COALESCE((
            SELECT SUM(l.quantity_current)
              FROM supply.inventory_lots l
             WHERE l.product_id = p.id
               AND l.quantity_current > 0
               AND l.is_quarantined = false
          ), 0) < p.min_stock`,
      [clinicId],
    );
    return parseInt(res.rows[0]?.count ?? '0', 10);
  } catch (err) {
    logger.warn({ err }, 'stock alerts count failed');
    return 0;
  }
}

async function overdueInvoices(
  client: import('pg').PoolClient,
  clinicId: string,
): Promise<{ count: number; total: number | null }> {
  const res = await client.query<{ count: string; total: string }>(
    `SELECT COUNT(*)::text AS count, COALESCE(SUM(amount_due), 0)::text AS total
       FROM financial.invoices
      WHERE clinic_id = $1
        AND deleted_at IS NULL
        AND amount_due > 0
        AND due_date < CURRENT_DATE
        AND status NOT IN ('paga','cancelada','estornada','rascunho')`,
    [clinicId],
  );
  return {
    count: parseInt(res.rows[0]?.count ?? '0', 10),
    total: parseInt(res.rows[0]?.total ?? '0', 10),
  };
}

async function biopsiesPendingCount(
  client: import('pg').PoolClient,
  clinicId: string,
): Promise<number> {
  const res = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM clinical.biopsies
      WHERE clinic_id = $1
        AND status NOT IN ('resultado_comunicado')`,
    [clinicId],
  );
  return parseInt(res.rows[0]?.count ?? '0', 10);
}

/* ── Wait queue (real-time, no cache) ────────────────────────────────────── */

export interface WaitQueueRow {
  appointmentId:  string;
  patientId:      string;
  patientName:    string;
  patientPhotoUrl: string | null;
  scheduledAt:    string;
  checkedInAt:    string;
  waitingMinutes: number;
  providerId:     string;
  providerName:   string;
  serviceName:    string | null;
  status:         string;
}

export async function getReceptionWaitQueue(clinicId: string): Promise<WaitQueueRow[]> {
  return withClinicContext(clinicId, async (client) => {
    const res = await client.query<{
      id: string; patient_id: string; patient_name: string | null;
      patient_photo_url: string | null;
      scheduled_at: string;
      provider_id: string; provider_name: string;
      service_name: string | null;
      status: string;
      check_in_at: string | null;
    }>(
      `SELECT a.id, a.patient_id, p.name AS patient_name, p.photo_url AS patient_photo_url,
              a.scheduled_at,
              a.provider_id, u.name AS provider_name,
              s.name AS service_name,
              a.status,
              (
                SELECT MAX((h->>'changed_at')::timestamptz)
                  FROM jsonb_array_elements(a.status_history) AS h
                 WHERE h->>'status' = 'waiting'
              ) AS check_in_at
         FROM shared.appointments a
         JOIN shared.patients p ON p.id = a.patient_id
         JOIN shared.users    u ON u.id = a.provider_id
         LEFT JOIN shared.services s ON s.id = a.service_id
        WHERE a.clinic_id = $1
          AND a.status IN ('waiting','in_progress')
        ORDER BY check_in_at ASC NULLS LAST`,
      [clinicId],
    );
    const now = Date.now();
    return res.rows.map((r) => {
      const checkedAt = r.check_in_at ? new Date(r.check_in_at) : new Date(r.scheduled_at);
      const minutes   = Math.max(0, Math.floor((now - checkedAt.getTime()) / 60_000));
      return {
        appointmentId:   r.id,
        patientId:       r.patient_id,
        patientName:     decryptOptional(r.patient_name) ?? r.patient_name ?? 'Paciente',
        patientPhotoUrl: r.patient_photo_url,
        scheduledAt:     new Date(r.scheduled_at).toISOString(),
        checkedInAt:     checkedAt.toISOString(),
        waitingMinutes:  minutes,
        providerId:      r.provider_id,
        providerName:    r.provider_name,
        serviceName:     r.service_name,
        status:          r.status,
      };
    });
  });
}
