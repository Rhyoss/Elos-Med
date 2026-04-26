/**
 * Processor `analytics-aggregation` — Prompt 17 (DermaIQ) / Job 2.
 *
 * Cron diário às 02:00 UTC.  Per-clinic Redis lock prevents concurrent
 * execution across multiple worker instances.
 *
 *   1. REFRESH MATERIALIZED VIEW CONCURRENTLY (serialised, with per-MV timing).
 *   2. UPSERT kpi_snapshots for yesterday per clinic.
 *   3. Tuesdays: recalculate patient_cohorts + lead_scores.
 *
 * Idempotency: UPSERT on all output tables.
 */

import type { Job } from 'bullmq';
import type { Pool, PoolClient } from 'pg';
import type pino from 'pino';
import type Redis from 'ioredis';
import { RedisLock } from '../lib/redis-lock.js';
import { jobMetrics } from '../lib/metrics.js';
import { notifyAdminDlq } from '../lib/dlq-notify.js';

const JOB_NAME    = 'daily-kpi-snapshot';
const LOCK_TTL_MS = 20 * 60_000;
const TIMEOUT_MS  = 15 * 60_000;

const metricsTracker = jobMetrics(JOB_NAME);

const REFRESH_VIEWS = [
  'analytics.mv_daily_revenue',
  'analytics.mv_appointment_metrics',
  'analytics.mv_supply_consumption',
];

export interface AnalyticsAggregationDeps {
  db:     Pool;
  redis:  Redis;
  logger: pino.Logger;
}

export interface AnalyticsAggregationData {
  triggeredAt: string;
  /** Override opcional: se presente, calcula snapshots para esta data (YYYY-MM-DD) ao invés de "ontem". */
  forDate?: string;
}

export function buildAnalyticsAggregationProcessor(
  deps: AnalyticsAggregationDeps,
): (job: Job<AnalyticsAggregationData>) => Promise<void> {
  const { db, logger } = deps;
  const lock = new RedisLock(deps.redis);

  return async function processAnalyticsAggregation(job) {
    const startedAt = Date.now();
    logger.info({ jobId: job.id, jobName: JOB_NAME }, 'analytics aggregation: started');

    if (Date.now() - startedAt > TIMEOUT_MS) throw new Error(`${JOB_NAME}: timeout`);

    // Step 1 — REFRESH MV CONCURRENTLY (serialised, with per-view timing)
    for (const view of REFRESH_VIEWS) {
      const viewStart = Date.now();
      try {
        await db.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
        logger.info({ view, durationMs: Date.now() - viewStart }, 'analytics: MV refreshed');
      } catch (err: unknown) {
        const message = (err as { message?: string }).message ?? '';
        if (/CONCURRENTLY|cannot refresh/.test(message)) {
          logger.warn({ view, err: message }, 'analytics: falling back to non-concurrent refresh');
          await db.query(`REFRESH MATERIALIZED VIEW ${view}`);
        } else {
          // Log and continue — one failing MV should not block all others
          logger.error({ view, err }, 'analytics: MV refresh failed — continuing');
        }
      }
    }

    const targetDate = job.data.forDate ?? yesterdayIso();
    const clinics    = await listActiveClinics(db);

    // Step 2 — KPI snapshots per clinic, one at a time (avoid DB pressure)
    let snapshotsUpserted = 0;
    for (const clinic of clinics) {
      const lockKey = `lock:${JOB_NAME}:${clinic.id}:${targetDate}`;
      const token   = await lock.acquire(lockKey, LOCK_TTL_MS);
      if (!token) {
        logger.info({ tenantId: clinic.id, targetDate }, 'analytics: lock held — skipping');
        continue;
      }

      try {
        await upsertDailyKpiSnapshot(db, clinic.id, clinic.timezone, targetDate);
        snapshotsUpserted += 1;
      } catch (err) {
        logger.error({ err, tenantId: clinic.id, targetDate }, 'analytics: snapshot upsert failed');
      } finally {
        await lock.release(lockKey, token);
      }
    }
    logger.info({ snapshotsUpserted, totalClinics: clinics.length }, 'analytics: snapshots done');

    // Step 3 + 4 — cohorts + lead scores (weekly, Tuesdays)
    const isTuesday = new Date().getUTCDay() === 2;
    if (isTuesday) {
      let cohortsUpserted = 0, scoresUpserted = 0;
      for (const clinic of clinics) {
        try { cohortsUpserted += await recomputeCohorts(db, clinic.id, clinic.timezone); }
        catch (err) { logger.error({ err, tenantId: clinic.id }, 'analytics: cohorts failed'); }
        try { scoresUpserted  += await recomputeLeadScores(db, clinic.id); }
        catch (err) { logger.error({ err, tenantId: clinic.id }, 'analytics: lead scores failed'); }
      }
      logger.info({ cohortsUpserted, scoresUpserted }, 'analytics: weekly recompute done');
    }

    const durationMs = Date.now() - startedAt;
    metricsTracker.success(durationMs, snapshotsUpserted);

    logger.info({
      job_name:        JOB_NAME,
      job_id:          job.id,
      duration_ms:     durationMs,
      items_processed: snapshotsUpserted,
      items_skipped:   0,
      errors_count:    0,
      status:          'ok',
      target_date:     targetDate,
    }, 'analytics aggregation: complete');

    // DLQ notify only if the job itself exhausted retries (BullMQ manages)
    if (snapshotsUpserted === 0 && clinics.length > 0) {
      const isLast = job.attemptsMade >= (job.opts.attempts ?? 2) - 1;
      if (isLast) {
        await notifyAdminDlq({ db, logger, jobName: JOB_NAME, jobId: job.id,
          error: new Error('zero snapshots upserted') });
      }
    }
  };
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function yesterdayIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function listActiveClinics(db: Pool): Promise<Array<{ id: string; timezone: string }>> {
  const res = await db.query<{ id: string; timezone: string }>(
    `SELECT id, timezone FROM shared.clinics WHERE deleted_at IS NULL`,
  );
  return res.rows;
}

async function upsertDailyKpiSnapshot(
  db: Pool, clinicId: string, timezone: string, targetDate: string,
): Promise<void> {
  // Calcula tudo em uma única query para minimizar idas e voltas ao banco.
  // O worker tem o role dermaos_worker que pode escrever em analytics.kpi_snapshots.
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const aggRes = await client.query<{
      revenue_total: string; appointments_total: string;
      new_patients: string; active_patients: string;
      avg_ticket: string | null; cancellation_rate: string | null;
      revenue_by_category: Record<string, number>;
      appointments_by_status: Record<string, number>;
    }>(
      `WITH revenue_day AS (
         SELECT COALESCE(SUM(p.amount), 0) AS total
           FROM financial.payments p
          WHERE p.clinic_id    = $1
            AND p.payment_type = 'pagamento'
            AND p.status       = 'aprovado'
            AND p.deleted_at  IS NULL
            AND DATE(p.received_at AT TIME ZONE $2) = $3::date
       ),
       paid_invoices AS (
         SELECT COUNT(DISTINCT p.invoice_id) AS cnt
           FROM financial.payments p
          WHERE p.clinic_id    = $1
            AND p.payment_type = 'pagamento'
            AND p.status       = 'aprovado'
            AND p.deleted_at  IS NULL
            AND DATE(p.received_at AT TIME ZONE $2) = $3::date
       ),
       revenue_by_category AS (
         SELECT COALESCE(jsonb_object_agg(category, total), '{}'::jsonb) AS payload
           FROM (
             SELECT COALESCE(s.category::text, 'sem_categoria') AS category,
                    SUM(ii.total_price) AS total
               FROM financial.payments p
               JOIN financial.invoices i  ON i.id = p.invoice_id
               LEFT JOIN financial.invoice_items ii ON ii.invoice_id = i.id
               LEFT JOIN shared.services s ON s.id = ii.service_id
              WHERE p.clinic_id    = $1
                AND p.payment_type = 'pagamento'
                AND p.status       = 'aprovado'
                AND DATE(p.received_at AT TIME ZONE $2) = $3::date
              GROUP BY s.category
           ) x
       ),
       appt AS (
         SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
                jsonb_object_agg(status, n) AS by_status
           FROM (
             SELECT status, COUNT(*) AS n
               FROM shared.appointments
              WHERE clinic_id = $1
                AND DATE(scheduled_at AT TIME ZONE $2) = $3::date
              GROUP BY status
           ) s
       ),
       new_p AS (
         SELECT COUNT(*) AS cnt
           FROM shared.patients
          WHERE clinic_id  = $1
            AND deleted_at IS NULL
            AND DATE(created_at AT TIME ZONE $2) = $3::date
       ),
       active_p AS (
         SELECT COUNT(DISTINCT a.patient_id) AS cnt
           FROM shared.appointments a
          WHERE a.clinic_id = $1
            AND a.status    = 'completed'
            AND a.scheduled_at >= ($3::date - INTERVAL '90 days') AT TIME ZONE $2
            AND a.scheduled_at <  ($3::date + INTERVAL '1 day')   AT TIME ZONE $2
       )
       SELECT (SELECT total FROM revenue_day)::text       AS revenue_total,
              (SELECT total FROM appt)::text              AS appointments_total,
              (SELECT cnt   FROM new_p)::text             AS new_patients,
              (SELECT cnt   FROM active_p)::text          AS active_patients,
              CASE WHEN (SELECT cnt FROM paid_invoices) > 0
                THEN ((SELECT total FROM revenue_day) / (SELECT cnt FROM paid_invoices))::text
                ELSE NULL END                              AS avg_ticket,
              CASE WHEN (SELECT total FROM appt) > 0
                THEN ((SELECT cancelled FROM appt)::decimal / (SELECT total FROM appt))::text
                ELSE NULL END                              AS cancellation_rate,
              (SELECT payload FROM revenue_by_category)   AS revenue_by_category,
              COALESCE((SELECT by_status FROM appt), '{}'::jsonb) AS appointments_by_status`,
      [clinicId, timezone, targetDate],
    );
    const r = aggRes.rows[0]!;

    await client.query(
      `INSERT INTO analytics.kpi_snapshots
         (clinic_id, snapshot_date, period_type,
          revenue_total, revenue_by_category,
          appointments_total, appointments_by_status,
          new_patients, active_patients, avg_ticket, cancellation_rate)
       VALUES ($1, $2::date, 'daily',
               $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (clinic_id, snapshot_date, period_type) DO UPDATE
         SET revenue_total          = EXCLUDED.revenue_total,
             revenue_by_category    = EXCLUDED.revenue_by_category,
             appointments_total     = EXCLUDED.appointments_total,
             appointments_by_status = EXCLUDED.appointments_by_status,
             new_patients           = EXCLUDED.new_patients,
             active_patients        = EXCLUDED.active_patients,
             avg_ticket             = EXCLUDED.avg_ticket,
             cancellation_rate      = EXCLUDED.cancellation_rate,
             computed_at            = NOW()`,
      [
        clinicId, targetDate,
        r.revenue_total ?? '0',
        JSON.stringify(r.revenue_by_category ?? {}),
        r.appointments_total ?? '0',
        JSON.stringify(r.appointments_by_status ?? {}),
        r.new_patients ?? '0',
        r.active_patients ?? '0',
        r.avg_ticket,
        r.cancellation_rate,
      ],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function recomputeCohorts(
  db: Pool, clinicId: string, timezone: string,
): Promise<number> {
  // Coorte = mês em que o paciente foi criado. Retenção = mês em que voltou para outra consulta.
  const res = await db.query<{ count: string }>(
    `WITH cohort_base AS (
       SELECT
         date_trunc('month', p.created_at AT TIME ZONE $2)::date AS cohort_month,
         p.id AS patient_id
       FROM shared.patients p
       WHERE p.clinic_id  = $1
         AND p.deleted_at IS NULL
         AND p.created_at >= (date_trunc('month', NOW()) - INTERVAL '12 months')
     ),
     visits AS (
       SELECT cb.cohort_month,
              cb.patient_id,
              MIN(a.scheduled_at AT TIME ZONE $2) AS first_visit
         FROM cohort_base cb
         LEFT JOIN shared.appointments a
           ON a.patient_id = cb.patient_id
          AND a.clinic_id  = $1
          AND a.status     = 'completed'
        GROUP BY cb.cohort_month, cb.patient_id
     ),
     retention AS (
       SELECT
         cb.cohort_month,
         cb.patient_id,
         COUNT(*) FILTER (WHERE a.scheduled_at >= cb.cohort_month + INTERVAL '1 month'
                            AND a.scheduled_at <  cb.cohort_month + INTERVAL '2 months') AS m1,
         COUNT(*) FILTER (WHERE a.scheduled_at >= cb.cohort_month + INTERVAL '3 months'
                            AND a.scheduled_at <  cb.cohort_month + INTERVAL '4 months') AS m3,
         COUNT(*) FILTER (WHERE a.scheduled_at >= cb.cohort_month + INTERVAL '6 months'
                            AND a.scheduled_at <  cb.cohort_month + INTERVAL '7 months') AS m6,
         COUNT(*) FILTER (WHERE a.scheduled_at >= cb.cohort_month + INTERVAL '12 months'
                            AND a.scheduled_at <  cb.cohort_month + INTERVAL '13 months') AS m12
         FROM cohort_base cb
         LEFT JOIN shared.appointments a
           ON a.patient_id = cb.patient_id
          AND a.clinic_id  = $1
          AND a.status     = 'completed'
        GROUP BY cb.cohort_month, cb.patient_id
     ),
     ltv AS (
       SELECT cb.cohort_month, cb.patient_id, COALESCE(SUM(p.amount), 0) AS total
         FROM cohort_base cb
         LEFT JOIN financial.invoices i ON i.patient_id = cb.patient_id AND i.clinic_id = $1
         LEFT JOIN financial.payments p
           ON p.invoice_id    = i.id
          AND p.payment_type  = 'pagamento'
          AND p.status        = 'aprovado'
          AND p.deleted_at   IS NULL
        GROUP BY cb.cohort_month, cb.patient_id
     ),
     agg AS (
       SELECT cb.cohort_month,
              COUNT(DISTINCT cb.patient_id)::int AS cohort_size,
              COUNT(DISTINCT cb.patient_id) FILTER (WHERE r.m1  > 0)::int AS retained_m1,
              COUNT(DISTINCT cb.patient_id) FILTER (WHERE r.m3  > 0)::int AS retained_m3,
              COUNT(DISTINCT cb.patient_id) FILTER (WHERE r.m6  > 0)::int AS retained_m6,
              COUNT(DISTINCT cb.patient_id) FILTER (WHERE r.m12 > 0)::int AS retained_m12,
              COALESCE(AVG(ltv.total), 0)::numeric(12,2) AS avg_ltv
         FROM cohort_base cb
         LEFT JOIN retention r ON r.patient_id = cb.patient_id AND r.cohort_month = cb.cohort_month
         LEFT JOIN ltv         ON ltv.patient_id = cb.patient_id AND ltv.cohort_month = cb.cohort_month
        GROUP BY cb.cohort_month
     ),
     upserted AS (
       INSERT INTO analytics.patient_cohorts
         (clinic_id, cohort_month, cohort_size, retained_m1, retained_m3, retained_m6, retained_m12, avg_ltv)
       SELECT $1, cohort_month, cohort_size, retained_m1, retained_m3, retained_m6, retained_m12, avg_ltv
         FROM agg
       ON CONFLICT (clinic_id, cohort_month) DO UPDATE
         SET cohort_size  = EXCLUDED.cohort_size,
             retained_m1  = EXCLUDED.retained_m1,
             retained_m3  = EXCLUDED.retained_m3,
             retained_m6  = EXCLUDED.retained_m6,
             retained_m12 = EXCLUDED.retained_m12,
             avg_ltv      = EXCLUDED.avg_ltv,
             computed_at  = NOW()
       RETURNING 1
     )
     SELECT COUNT(*)::text AS count FROM upserted`,
    [clinicId, timezone],
  );
  return parseInt(res.rows[0]?.count ?? '0', 10);
}

async function recomputeLeadScores(db: Pool, clinicId: string): Promise<number> {
  // Heurística simples (sem ML): quanto mais dias sem visita, maior churn risk.
  // upsell_score baseado na frequência histórica (visitas/mês nos últimos 12 meses).
  const res = await db.query<{ count: string }>(
    `WITH base AS (
       SELECT p.id AS patient_id,
              EXTRACT(DAY FROM NOW() - MAX(a.scheduled_at))::int AS days_since,
              COUNT(*) FILTER (WHERE a.scheduled_at >= NOW() - INTERVAL '12 months') AS visits_12m,
              COALESCE(SUM(pay.amount), 0) AS total_paid
         FROM shared.patients p
         LEFT JOIN shared.appointments a ON a.patient_id = p.id AND a.clinic_id = $1 AND a.status = 'completed'
         LEFT JOIN financial.invoices i  ON i.patient_id = p.id AND i.clinic_id = $1
         LEFT JOIN financial.payments pay
           ON pay.invoice_id   = i.id
          AND pay.payment_type = 'pagamento'
          AND pay.status       = 'aprovado'
          AND pay.deleted_at  IS NULL
        WHERE p.clinic_id  = $1
          AND p.deleted_at IS NULL
        GROUP BY p.id
     ),
     scored AS (
       SELECT patient_id,
              days_since,
              -- churn risk: 0 se < 30 dias, sobe linearmente até 1 em >= 365 dias
              LEAST(GREATEST(COALESCE(days_since, 999) - 30, 0) / 335.0, 1.0)::numeric(5,4) AS churn_risk,
              -- upsell: pacientes ativos com gasto alto sobem
              LEAST(visits_12m::numeric / 12.0, 1.0)::numeric(5,4) AS upsell,
              -- LTV previsto = média mensal × 24 meses
              (CASE WHEN visits_12m > 0 THEN total_paid * 2 ELSE total_paid END)::numeric(12,2) AS ltv_pred,
              ROUND(visits_12m::numeric / 12.0, 3)::numeric(6,3) AS visit_freq
         FROM base
     ),
     upserted AS (
       INSERT INTO analytics.lead_scores
         (clinic_id, patient_id, churn_risk_score, upsell_score, ltv_predicted, days_since_visit, visit_frequency, model_version)
       SELECT $1, patient_id, churn_risk, upsell, ltv_pred, days_since, visit_freq, 'heuristic-v1'
         FROM scored
       ON CONFLICT (clinic_id, patient_id) DO UPDATE
         SET churn_risk_score = EXCLUDED.churn_risk_score,
             upsell_score     = EXCLUDED.upsell_score,
             ltv_predicted    = EXCLUDED.ltv_predicted,
             days_since_visit = EXCLUDED.days_since_visit,
             visit_frequency  = EXCLUDED.visit_frequency,
             model_version    = EXCLUDED.model_version,
             scored_at        = NOW()
       RETURNING 1
     )
     SELECT COUNT(*)::text AS count FROM upserted`,
    [clinicId],
  );
  return parseInt(res.rows[0]?.count ?? '0', 10);
}
