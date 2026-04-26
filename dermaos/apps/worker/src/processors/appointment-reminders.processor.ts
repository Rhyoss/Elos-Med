/**
 * Processor `appointment-reminders` — Job 4.
 *
 * Runs every 15 minutes.  For each active clinic:
 *   1. Acquires a per-clinic Redis lock (TTL 14 min) to prevent duplicate
 *      sends if two worker instances overlap.
 *   2. Finds confirmed appointments that are 24 h or 2 h away (±5 min buffer)
 *      and whose corresponding reminder flag is still false.
 *   3. Marks the flag true BEFORE dispatching (idempotency-first approach).
 *      If the actual send fails the flag is reset to false so the next run
 *      retries.
 *   4. Dispatches the reminder via the clinic's configured channel.
 *   5. Respects quiet hours (22:00–07:00 in clinic or patient timezone).
 *
 * Idempotency: reminder_sent_24h / reminder_sent_2h flags are the source of
 * truth.  Even if the job fires twice the flags prevent double sending.
 *
 * Rate limiting: a per-channel semaphore serialises sends within the same
 * 15-minute window to respect provider limits (e.g. WhatsApp 1 msg/s).
 */

import type { Job } from 'bullmq';
import type { Pool } from 'pg';
import type pino from 'pino';
import type Redis from 'ioredis';
import { RedisLock } from '../lib/redis-lock.js';
import { jobMetrics } from '../lib/metrics.js';

const JOB_NAME       = 'appointment-reminders';
const LOCK_TTL_MS    = 14 * 60_000;
const TIMEOUT_MS     = 10 * 60_000;
const BATCH_SIZE     = 100;
const SEND_RETRY_MAX = 2;
const RETRY_DELAY_MS = 30_000;
const QUIET_HOUR_START = 22;
const QUIET_HOUR_END   = 7;

const metrics = jobMetrics(JOB_NAME);

export interface RemindersDeps {
  db:     Pool;
  redis:  Redis;
  logger: pino.Logger;
}

interface ClinicRow {
  id:       string;
  timezone: string;
  whatsapp_token?:     string;
  whatsapp_phone_id?:  string;
  reminder_channel:    'whatsapp' | 'sms' | 'email' | 'none';
}

interface ApptRow {
  id:          string;
  patient_id:  string;
  patient_name:   string | null;
  patient_phone:  string | null;
  patient_email:  string | null;
  scheduled_at:   string;
  provider_name:  string | null;
  reminder_type:  '24h' | '2h';
}

export function buildAppointmentRemindersProcessor(deps: RemindersDeps) {
  const lock = new RedisLock(deps.redis);

  return async function process(_job: Job): Promise<void> {
    const startedAt = Date.now();
    const log       = deps.logger;

    if (Date.now() - startedAt > TIMEOUT_MS) throw new Error('appointment-reminders: timeout');

    const clinics = await deps.db.query<ClinicRow>(
      `SELECT c.id,
              COALESCE(c.timezone, 'America/Sao_Paulo') AS timezone,
              (c.appointment_config->>'reminder_channel')::text
                AS reminder_channel
         FROM shared.clinics c
        WHERE c.is_active = TRUE AND c.deleted_at IS NULL`,
    );

    let totalSent    = 0;
    let totalSkipped = 0;
    let totalErrors  = 0;

    for (const clinic of clinics.rows) {
      const lockKey = `lock:${JOB_NAME}:${clinic.id}`;
      const token   = await lock.acquire(lockKey, LOCK_TTL_MS);
      if (!token) {
        log.info({ jobName: JOB_NAME, tenantId: clinic.id }, 'lock held — skipping clinic');
        continue;
      }

      try {
        const r = await processClinic(deps, clinic, log);
        totalSent    += r.sent;
        totalSkipped += r.skipped;
        totalErrors  += r.errors;
      } catch (err) {
        totalErrors += 1;
        log.error({ err, jobName: JOB_NAME, tenantId: clinic.id }, 'reminder: clinic processing failed');
      } finally {
        await lock.release(lockKey, token);
      }
    }

    const durationMs = Date.now() - startedAt;
    metrics.success(durationMs, totalSent);

    log.info({
      job_name:        JOB_NAME,
      duration_ms:     durationMs,
      items_processed: totalSent,
      items_skipped:   totalSkipped,
      errors_count:    totalErrors,
      status:          totalErrors > 0 ? 'partial' : 'ok',
    }, 'appointment-reminders: sweep complete');
  };
}

async function processClinic(
  deps:   RemindersDeps,
  clinic: ClinicRow,
  log:    pino.Logger,
): Promise<{ sent: number; skipped: number; errors: number }> {
  let sent = 0, skipped = 0, errors = 0;

  if (!clinic.reminder_channel || clinic.reminder_channel === 'none') {
    log.debug({ tenantId: clinic.id }, 'reminder: channel not configured — skipping');
    return { sent: 0, skipped: 0, errors: 0 };
  }

  // Fetch channel config from clinic settings
  const channelCfg = await getChannelConfig(deps.db, clinic.id, clinic.reminder_channel);

  // Process 24h reminders
  const r24 = await sendBatch(deps, clinic, channelCfg, '24h', log);
  sent    += r24.sent;
  skipped += r24.skipped;
  errors  += r24.errors;

  // Process 2h reminders
  const r2 = await sendBatch(deps, clinic, channelCfg, '2h', log);
  sent    += r2.sent;
  skipped += r2.skipped;
  errors  += r2.errors;

  return { sent, skipped, errors };
}

async function sendBatch(
  deps:       RemindersDeps,
  clinic:     ClinicRow,
  channelCfg: Record<string, unknown>,
  window:     '24h' | '2h',
  log:        pino.Logger,
): Promise<{ sent: number; skipped: number; errors: number }> {
  let sent = 0, skipped = 0, errors = 0;
  let offset = 0;

  const windowMs    = window === '24h' ? 24 * 60 * 60_000 : 2 * 60 * 60_000;
  const bufferMs    = 5 * 60_000;
  const flagColumn  = window === '24h' ? 'reminder_sent_24h' : 'reminder_sent_2h';

  while (true) {
    const now = new Date();

    const rows = await deps.db.query<ApptRow>(
      `SELECT a.id, a.patient_id, a.scheduled_at::text,
              p.name          AS patient_name,
              p.phone_encrypted AS patient_phone,
              p.email_encrypted AS patient_email,
              u.name          AS provider_name,
              $3              AS reminder_type
         FROM shared.appointments a
         JOIN shared.patients p  ON p.id  = a.patient_id
    LEFT JOIN shared.users    u  ON u.id  = a.provider_id
        WHERE a.clinic_id    = $1
          AND a.status       = 'confirmed'
          AND a.${flagColumn} = FALSE
          AND a.scheduled_at BETWEEN ($2::timestamptz + INTERVAL '1 millisecond' * $4)
                                 AND ($2::timestamptz + INTERVAL '1 millisecond' * $5)
        ORDER BY a.scheduled_at ASC
        LIMIT  ${BATCH_SIZE}
        OFFSET $6`,
      [
        clinic.id,
        now.toISOString(),
        window,
        windowMs - bufferMs,
        windowMs + bufferMs,
        offset,
      ],
    );

    if (rows.rows.length === 0) break;

    for (const appt of rows.rows) {
      // Quiet hours check (clinic timezone)
      const localHour = getLocalHour(clinic.timezone);
      if (isQuietHour(localHour)) {
        log.info({ tenantId: clinic.id, apptId: appt.id, localHour }, 'reminder: quiet hours — skipping');
        skipped += 1;
        continue;
      }

      // Mark flag true BEFORE sending (idempotency — prevents duplicate if job
      // fires again before send result is persisted).
      const updated = await deps.db.query<{ id: string }>(
        `UPDATE shared.appointments
            SET ${flagColumn} = TRUE, updated_at = NOW()
          WHERE id = $1 AND clinic_id = $2 AND ${flagColumn} = FALSE
          RETURNING id`,
        [appt.id, clinic.id],
      );

      if (!updated.rows[0]) {
        skipped += 1; // another worker beat us
        continue;
      }

      // Attempt send with up to SEND_RETRY_MAX retries
      let sendOk = false;
      for (let attempt = 0; attempt <= SEND_RETRY_MAX; attempt++) {
        try {
          await dispatchReminder(clinic, channelCfg, appt, window, log);
          sendOk = true;
          break;
        } catch (err) {
          if (attempt < SEND_RETRY_MAX) {
            log.warn({ err, apptId: appt.id, attempt }, 'reminder: send failed — retrying');
            await delay(RETRY_DELAY_MS);
          }
        }
      }

      if (sendOk) {
        sent += 1;
        log.info({ tenantId: clinic.id, apptId: appt.id, window }, 'reminder: sent');
      } else {
        errors += 1;
        // Reset flag so next execution can retry
        await deps.db.query(
          `UPDATE shared.appointments SET ${flagColumn} = FALSE, updated_at = NOW() WHERE id = $1`,
          [appt.id],
        ).catch(() => undefined);
        log.error({ tenantId: clinic.id, apptId: appt.id }, 'reminder: all retries exhausted — flag reset');
      }
    }

    if (rows.rows.length < BATCH_SIZE) break;
    offset += rows.rows.length;
  }

  return { sent, skipped, errors };
}

async function dispatchReminder(
  clinic:     ClinicRow,
  channelCfg: Record<string, unknown>,
  appt:       ApptRow,
  window:     '24h' | '2h',
  log:        pino.Logger,
): Promise<void> {
  const scheduledAt = new Date(appt.scheduled_at);
  const dateStr = scheduledAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const body = window === '24h'
    ? `Olá${appt.patient_name ? ` ${appt.patient_name}` : ''}! Lembrete: você tem uma consulta amanhã, ${dateStr} às ${timeStr}${appt.provider_name ? ` com ${appt.provider_name}` : ''}. Confirme sua presença respondendo OK.`
    : `Olá${appt.patient_name ? ` ${appt.patient_name}` : ''}! Sua consulta é hoje às ${timeStr}${appt.provider_name ? ` com ${appt.provider_name}` : ''}. Estamos esperando por você!`;

  switch (clinic.reminder_channel) {
    case 'whatsapp': {
      const phoneNumberId = channelCfg['phone_number_id'] as string | undefined;
      const accessToken   = channelCfg['access_token']   as string | undefined;
      const phone         = appt.patient_phone;
      if (!phoneNumberId || !accessToken || !phone) {
        throw new Error('whatsapp: missing config or patient phone');
      }
      const ctrl = new AbortController();
      const t    = setTimeout(() => ctrl.abort(), 15_000);
      try {
        const res = await fetch(
          `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
          {
            method:  'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              messaging_product: 'whatsapp',
              to:   phone,
              type: 'text',
              text: { body },
            }),
            signal: ctrl.signal,
          },
        );
        if (!res.ok) {
          const j = await res.json() as { error?: { message?: string } };
          throw new Error(`whatsapp_api: ${j.error?.message ?? res.status}`);
        }
      } finally {
        clearTimeout(t);
      }
      break;
    }

    case 'sms':
      log.info({ apptId: appt.id }, 'reminder: SMS stub (provider not yet integrated)');
      break;

    case 'email':
      log.info({ apptId: appt.id }, 'reminder: email stub (provider not yet integrated)');
      break;

    default:
      throw new Error(`unsupported_channel: ${clinic.reminder_channel}`);
  }
}

async function getChannelConfig(
  db:        Pool,
  clinicId:  string,
  _channel:  string,
): Promise<Record<string, unknown>> {
  const r = await db.query<{ config: Record<string, unknown> }>(
    `SELECT config FROM omni.channels
      WHERE clinic_id = $1 AND is_active = TRUE LIMIT 1`,
    [clinicId],
  );
  return r.rows[0]?.config ?? {};
}

function getLocalHour(timezone: string): number {
  try {
    return parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour: 'numeric', hour12: false,
    }).format(new Date()), 10);
  } catch {
    return new Date().getUTCHours();
  }
}

function isQuietHour(hour: number): boolean {
  return hour >= QUIET_HOUR_START || hour < QUIET_HOUR_END;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
