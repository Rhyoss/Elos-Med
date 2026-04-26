/**
 * Processor `monthly-cohort-analysis` — Job 3.
 *
 * Runs on the first day of each month at 03:00 UTC.
 * Calculates patient cohort metrics for the previous calendar month:
 *   - Cohort size (patients whose first visit was in that month)
 *   - Retention at 1, 3, 6, 12 months
 *   - Average LTV per cohort
 *   - CAC by acquisition channel (null when no marketing cost data available)
 *
 * Idempotency: UPSERT on (clinic_id, cohort_month) — running the job multiple
 * times for the same month safely overwrites with recalculated values, which
 * is intentional since historical data can be retroactively corrected.
 *
 * Lock: 'lock:monthly-cohort:{tenantId}:{YYYY-MM}' with TTL 1h prevents two
 * instances from recalculating the same month concurrently.
 */

import type { Job } from 'bullmq';
import type { Pool } from 'pg';
import type pino from 'pino';
import type Redis from 'ioredis';
import { RedisLock } from '../lib/redis-lock.js';
import { jobMetrics } from '../lib/metrics.js';
import { notifyAdminDlq } from '../lib/dlq-notify.js';

const JOB_NAME    = 'monthly-cohort-analysis';
const LOCK_TTL_MS = 60 * 60_000;    // 1 hour
const TIMEOUT_MS  = 45 * 60_000;    // 45 minutes

const metrics = jobMetrics(JOB_NAME);

export interface MonthlyCohortDeps {
  db:     Pool;
  redis:  Redis;
  logger: pino.Logger;
}

export interface MonthlyCohortData {
  triggeredAt: string;
  /** Override: ISO date within the target month, e.g. '2026-03-01'.  Defaults to last month. */
  forMonth?: string;
}

export function buildMonthlyCohortProcessor(deps: MonthlyCohortDeps) {
  const lock = new RedisLock(deps.redis);

  return async function process(job: Job<MonthlyCohortData>): Promise<void> {
    const startedAt = Date.now();
    const log       = deps.logger;

    // Determine the cohort month: first day of the previous calendar month
    const cohortFirstDay = firstDayOfPreviousMonth(job.data.forMonth);
    const yearMonth      = cohortFirstDay.slice(0, 7); // 'YYYY-MM'

    if (Date.now() - startedAt > TIMEOUT_MS) throw new Error(`${JOB_NAME}: timeout`);

    const clinics = await deps.db.query<{ id: string; timezone: string }>(
      `SELECT id, COALESCE(timezone, 'America/Sao_Paulo') AS timezone
         FROM shared.clinics WHERE is_active = TRUE AND deleted_at IS NULL`,
    );

    let totalUpserted = 0, totalErrors = 0;

    for (const clinic of clinics.rows) {
      const lockKey = `lock:${JOB_NAME}:${clinic.id}:${yearMonth}`;
      const token   = await lock.acquire(lockKey, LOCK_TTL_MS);
      if (!token) {
        log.info({ jobName: JOB_NAME, tenantId: clinic.id, yearMonth }, 'lock held — skipping');
        continue;
      }

      try {
        await computeCohort(deps.db, clinic.id, clinic.timezone, cohortFirstDay, log);
        totalUpserted += 1;
        log.info({ tenantId: clinic.id, cohortFirstDay }, 'monthly-cohort: upserted');
      } catch (err) {
        totalErrors += 1;
        log.error({ err, jobName: JOB_NAME, tenantId: clinic.id, cohortFirstDay }, 'monthly-cohort: failed');

        // DLQ notification only after this job's own retry budget is exhausted
        const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 3) - 1;
        if (isLastAttempt) {
          await notifyAdminDlq({
            db: deps.db, logger: log, jobName: JOB_NAME,
            jobId: job.id, clinicId: clinic.id, error: err,
            payload: { cohortFirstDay },
          });
        }
      } finally {
        await lock.release(lockKey, token);
      }
    }

    const durationMs = Date.now() - startedAt;
    if (totalErrors === 0) metrics.success(durationMs, totalUpserted);
    else metrics.error();

    log.info({
      job_name:        JOB_NAME,
      job_id:          job.id,
      duration_ms:     durationMs,
      items_processed: totalUpserted,
      items_skipped:   0,
      errors_count:    totalErrors,
      status:          totalErrors > 0 ? 'partial' : 'ok',
      cohort_month:    yearMonth,
    }, 'monthly-cohort: run complete');
  };
}

async function computeCohort(
  db:             Pool,
  clinicId:       string,
  timezone:       string,
  cohortFirstDay: string,   // 'YYYY-MM-DD', first day of the target month
  log:            pino.Logger,
): Promise<void> {
  // Cohort = all patients whose first visit (first completed appointment) fell
  // within cohortFirstDay to the last day of that month.
  //
  // Retention metrics are calculated for the cohort as a whole:
  //   retained_m1  = patients who had any completed appt in the following month
  //   retained_m3  = …in the month 3 months after cohort month
  //   retained_m6  = …6 months after
  //   retained_m12 = …12 months after
  //
  // avg_ltv = average total payments by cohort members up to today.
  //
  // CAC: not stored here — requires marketing cost data not yet modelled.

  const r = await db.query<{ upserted: string }>(
    `WITH cohort_patients AS (
       -- Patients who made their first completed visit in the cohort month
       SELECT DISTINCT p.id AS patient_id
         FROM shared.patients p
         JOIN shared.appointments a
           ON a.patient_id = p.id AND a.clinic_id = $1 AND a.status = 'completed'
        WHERE p.clinic_id  = $1
          AND p.deleted_at IS NULL
          AND DATE(p.created_at AT TIME ZONE $2) >= $3::date
          AND DATE(p.created_at AT TIME ZONE $2) <  ($3::date + INTERVAL '1 month')
     ),
     retention AS (
       SELECT cp.patient_id,
         COUNT(*) FILTER (
           WHERE a.status = 'completed'
             AND DATE(a.scheduled_at AT TIME ZONE $2) >= ($3::date + INTERVAL '1 month')
             AND DATE(a.scheduled_at AT TIME ZONE $2) <  ($3::date + INTERVAL '2 months')
         ) AS m1,
         COUNT(*) FILTER (
           WHERE a.status = 'completed'
             AND DATE(a.scheduled_at AT TIME ZONE $2) >= ($3::date + INTERVAL '3 months')
             AND DATE(a.scheduled_at AT TIME ZONE $2) <  ($3::date + INTERVAL '4 months')
         ) AS m3,
         COUNT(*) FILTER (
           WHERE a.status = 'completed'
             AND DATE(a.scheduled_at AT TIME ZONE $2) >= ($3::date + INTERVAL '6 months')
             AND DATE(a.scheduled_at AT TIME ZONE $2) <  ($3::date + INTERVAL '7 months')
         ) AS m6,
         COUNT(*) FILTER (
           WHERE a.status = 'completed'
             AND DATE(a.scheduled_at AT TIME ZONE $2) >= ($3::date + INTERVAL '12 months')
             AND DATE(a.scheduled_at AT TIME ZONE $2) <  ($3::date + INTERVAL '13 months')
         ) AS m12
         FROM cohort_patients cp
    LEFT JOIN shared.appointments a
           ON a.patient_id = cp.patient_id AND a.clinic_id = $1
        GROUP BY cp.patient_id
     ),
     ltv AS (
       SELECT cp.patient_id,
              COALESCE(SUM(py.amount), 0) AS total_paid
         FROM cohort_patients cp
    LEFT JOIN financial.invoices inv ON inv.patient_id = cp.patient_id AND inv.clinic_id = $1
    LEFT JOIN financial.payments py
           ON py.invoice_id   = inv.id
          AND py.payment_type = 'pagamento'
          AND py.status       = 'aprovado'
          AND py.deleted_at  IS NULL
        GROUP BY cp.patient_id
     ),
     agg AS (
       SELECT
         COUNT(DISTINCT cp.patient_id)::int                                         AS cohort_size,
         COUNT(DISTINCT cp.patient_id) FILTER (WHERE r.m1  > 0)::int               AS retained_m1,
         COUNT(DISTINCT cp.patient_id) FILTER (WHERE r.m3  > 0)::int               AS retained_m3,
         COUNT(DISTINCT cp.patient_id) FILTER (WHERE r.m6  > 0)::int               AS retained_m6,
         COUNT(DISTINCT cp.patient_id) FILTER (WHERE r.m12 > 0)::int               AS retained_m12,
         COALESCE(AVG(ltv.total_paid), 0)::numeric(12,2)                            AS avg_ltv
         FROM cohort_patients cp
    LEFT JOIN retention r ON r.patient_id = cp.patient_id
    LEFT JOIN ltv         ON ltv.patient_id = cp.patient_id
     ),
     upserted AS (
       INSERT INTO analytics.patient_cohorts
         (clinic_id, cohort_month, cohort_size,
          retained_m1, retained_m3, retained_m6, retained_m12, avg_ltv)
       SELECT $1, $3::date, cohort_size,
              retained_m1, retained_m3, retained_m6, retained_m12, avg_ltv
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
     SELECT COUNT(*)::text AS upserted FROM upserted`,
    [clinicId, timezone, cohortFirstDay],
  );

  log.debug({ clinicId, cohortFirstDay, upserted: r.rows[0]?.upserted }, 'monthly-cohort: upsert complete');
}

function firstDayOfPreviousMonth(override?: string): string {
  if (override) {
    const d = new Date(override);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }
  const now = new Date();
  const y   = now.getUTCFullYear();
  const m   = now.getUTCMonth(); // 0-based — this is the previous month when run on the 1st
  const prev = m === 0 ? new Date(y - 1, 11, 1) : new Date(y, m - 1, 1);
  return prev.toISOString().slice(0, 10);
}
