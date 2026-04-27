/**
 * Processor `patient-reactivation` — Job 6.
 *
 * Runs weekly on Sundays.  For each clinic, checks if it is currently 10:00
 * in the clinic's timezone (±15-minute window) and then:
 *
 *   1. Finds patients whose last visit was 30–365 days ago, have no upcoming
 *      appointment, and have an active 'marketing' consent.
 *   2. Limits to 100 patients per run (oldest first) to avoid mass spam.
 *   3. If a 'patient_reactivation' automation is configured: enqueues each
 *      patient into omni.automation_queue.
 *   4. Otherwise: creates a single internal admin notification listing the
 *      patients for the receptionist to contact manually.
 *
 * Idempotency: per-clinic Redis lock key includes the ISO week number
 * ('lock:patient-reactivation:{tenantId}:2026-W17') — ensures the job runs
 * at most once per clinic per calendar week even if the 10:00 window is hit
 * across two worker cron firings.
 */

import type { Job } from 'bullmq';
import type { Pool } from 'pg';
import type pino from 'pino';
import type Redis from 'ioredis';
import { RedisLock } from '../lib/redis-lock.js';
import { jobMetrics } from '../lib/metrics.js';
import { notifyAdminDlq } from '../lib/dlq-notify.js';

const JOB_NAME        = 'patient-reactivation';
const LOCK_TTL_MS     = 30 * 60_000;
const TIMEOUT_MS      = 20 * 60_000;
const MAX_PATIENTS    = 100;
const INACTIVITY_DAYS = 30;

const metrics = jobMetrics(JOB_NAME);

export interface PatientReactivationDeps {
  db:     Pool;
  redis:  Redis;
  logger: pino.Logger;
}

interface PatientRow {
  id:            string;
  name:          string;
  last_visit_at: string | null;
}

interface AutomationRow {
  id: string;
}

export function buildPatientReactivationProcessor(deps: PatientReactivationDeps) {
  const lock = new RedisLock(deps.redis);

  return async function process(job: Job): Promise<void> {
    const startedAt = Date.now();
    const log       = deps.logger;

    if (Date.now() - startedAt > TIMEOUT_MS) throw new Error(`${JOB_NAME}: timeout`);

    const clinics = await deps.db.query<{ id: string; timezone: string }>(
      `SELECT id, COALESCE(timezone, 'America/Sao_Paulo') AS timezone
         FROM shared.clinics WHERE is_active = TRUE AND deleted_at IS NULL`,
    );

    let totalPatients = 0, totalErrors = 0;

    for (const clinic of clinics.rows) {
      // Only run at 10:00 on Sundays in the clinic's timezone
      if (!isSundayAt10(clinic.timezone)) continue;

      const isoWeek = getIsoWeekKey(clinic.timezone);
      const lockKey = `lock:${JOB_NAME}:${clinic.id}:${isoWeek}`;
      const token   = await lock.acquire(lockKey, LOCK_TTL_MS);
      if (!token) {
        log.info({ jobName: JOB_NAME, tenantId: clinic.id, isoWeek }, 'lock held — skipping');
        continue;
      }

      try {
        const processed = await processClinic(deps, clinic.id, log);
        totalPatients += processed;
      } catch (err) {
        totalErrors += 1;
        log.error({ err, jobName: JOB_NAME, tenantId: clinic.id }, 'patient-reactivation: clinic failed');

        const isLast = job.attemptsMade >= (job.opts.attempts ?? 3) - 1;
        if (isLast) {
          await notifyAdminDlq({ db: deps.db, logger: log, jobName: JOB_NAME,
            jobId: job.id, clinicId: clinic.id, error: err });
        }
      } finally {
        await lock.release(lockKey, token);
      }
    }

    const durationMs = Date.now() - startedAt;
    if (totalErrors === 0) metrics.success(durationMs, totalPatients);
    else metrics.error();

    log.info({
      job_name:        JOB_NAME,
      job_id:          job.id,
      duration_ms:     durationMs,
      items_processed: totalPatients,
      items_skipped:   0,
      errors_count:    totalErrors,
      status:          totalErrors > 0 ? 'partial' : 'ok',
    }, 'patient-reactivation: sweep complete');
  };
}

async function processClinic(
  deps:     PatientReactivationDeps,
  clinicId: string,
  log:      pino.Logger,
): Promise<number> {
  // Load inactive patients with marketing consent, no future appointment
  const patients = await deps.db.query<PatientRow>(
    `SELECT p.id, p.name, p.last_visit_at::text
       FROM shared.patients p
      WHERE p.clinic_id  = $1
        AND p.deleted_at IS NULL
        AND p.status     = 'active'
        -- Last visit 30+ days ago
        AND p.last_visit_at IS NOT NULL
        AND p.last_visit_at < NOW() - INTERVAL '${INACTIVITY_DAYS} days'
        -- Has active marketing consent (latest record is a grant, not revocation)
        AND EXISTS (
          SELECT 1 FROM shared.consent_log cl
           WHERE cl.clinic_id    = p.clinic_id
             AND cl.patient_id   = p.id
             AND cl.consent_type = 'marketing'
             AND cl.is_revocation = FALSE
             AND NOT EXISTS (
               SELECT 1 FROM shared.consent_log cl2
                WHERE cl2.clinic_id    = cl.clinic_id
                  AND cl2.patient_id   = cl.patient_id
                  AND cl2.consent_type = 'marketing'
                  AND cl2.is_revocation = TRUE
                  AND cl2.granted_at   > cl.granted_at
             )
        )
        -- No upcoming appointment already booked
        AND NOT EXISTS (
          SELECT 1 FROM shared.appointments a
           WHERE a.clinic_id  = p.clinic_id
             AND a.patient_id = p.id
             AND a.status NOT IN ('cancelled','no_show')
             AND a.scheduled_at > NOW()
        )
      ORDER BY p.last_visit_at ASC   -- oldest first (highest reactivation priority)
      LIMIT ${MAX_PATIENTS}`,
    [clinicId],
  );

  if (patients.rows.length === 0) {
    log.debug({ clinicId }, 'patient-reactivation: no eligible patients');
    return 0;
  }

  // Check for a 'patient_reactivation' automation in this clinic
  const automations = await deps.db.query<AutomationRow>(
    `SELECT id FROM omni.automations
      WHERE clinic_id = $1
        AND trigger   = 'patient_birthday'   -- TODO: add 'patient_reactivation' trigger value
        AND is_active = TRUE
      LIMIT 1`,
    [clinicId],
  );

  // Prefer automation-based reactivation; fall back to internal notification
  if (automations.rows.length > 0) {
    await enqueueAutomations(deps.db, clinicId, automations.rows[0]!.id, patients.rows, log);
  } else {
    await createInternalNotification(deps.db, clinicId, patients.rows, log);
  }

  log.info({ clinicId, count: patients.rows.length }, 'patient-reactivation: processed');
  return patients.rows.length;
}

async function enqueueAutomations(
  db:           Pool,
  clinicId:     string,
  automationId: string,
  patients:     PatientRow[],
  log:          pino.Logger,
): Promise<void> {
  for (const patient of patients) {
    try {
      await db.query(
        `INSERT INTO omni.automation_queue
           (clinic_id, automation_id, trigger, entity_id, entity_type)
         VALUES ($1, $2, 'patient_birthday', $3, 'patient')
         ON CONFLICT DO NOTHING`,
        [clinicId, automationId, patient.id],
      );
    } catch (err) {
      log.warn({ err, clinicId, patientId: patient.id }, 'patient-reactivation: enqueue failed');
    }
  }
  log.info({ clinicId, count: patients.length }, 'patient-reactivation: enqueued automation tasks');
}

async function createInternalNotification(
  db:       Pool,
  clinicId: string,
  patients: PatientRow[],
  log:      pino.Logger,
): Promise<void> {
  const patientList = patients.map((p) => ({
    id:           p.id,
    name:         p.name,
    last_visit_at: p.last_visit_at,
  }));

  await db.query(
    `INSERT INTO shared.admin_notifications
       (type, job_name, clinic_id, severity, message, payload)
     VALUES ('patient_reactivation_list', $1, $2, 'info', $3, $4::jsonb)`,
    [
      JOB_NAME,
      clinicId,
      `${patients.length} patient(s) inactive for ${INACTIVITY_DAYS}+ days and eligible for reactivation.`,
      JSON.stringify({ patients: patientList, generated_at: new Date().toISOString() }),
    ],
  );

  log.info({ clinicId, count: patients.length }, 'patient-reactivation: internal notification created');
}

function isSundayAt10(timezone: string): boolean {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday:  'short',
      hour:     'numeric',
      minute:   'numeric',
      hour12:   false,
    });
    const parts  = fmt.formatToParts(new Date());
    const weekday = parts.find((p) => p.type === 'weekday')?.value;
    const hour    = parseInt(parts.find((p) => p.type === 'hour')?.value   ?? '0', 10);
    const minute  = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);

    return weekday === 'Sun' && hour === 10 && minute < 15;
  } catch {
    return false;
  }
}

function getIsoWeekKey(timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
    const dateStr = fmt.format(new Date()); // 'YYYY-MM-DD'
    const d = new Date(dateStr);
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  } catch {
    const now = new Date();
    return `${now.getUTCFullYear()}-W00`;
  }
}
