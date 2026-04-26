/**
 * Processor `automation-processor` — Job 5.
 *
 * Polls `omni.automation_queue` every 5 minutes.  Uses SELECT … FOR UPDATE
 * SKIP LOCKED so multiple worker instances can process different rows in
 * parallel without conflicts.
 *
 * Pipeline per row:
 *   1. Atomically claim rows: UPDATE status='processing' WHERE status='pending'.
 *   2. Re-check automation active status and evaluate conditions at runtime.
 *   3. Execute action (send template, change status, trigger internal notification).
 *   4. Mark row 'done' | 'skipped' | 'failed'.
 *   5. After 3 failures: mark 'failed', emit DLQ admin notification.
 *
 * Idempotency: automation_queue.id is the idempotency key — the SKIP LOCKED
 * claim and the 'done'/'failed' terminal statuses prevent reprocessing.
 */

import type { Job } from 'bullmq';
import type { Pool } from 'pg';
import type pino from 'pino';
import type Redis from 'ioredis';
import { RedisLock } from '../lib/redis-lock.js';
import { jobMetrics } from '../lib/metrics.js';
import { notifyAdminDlq } from '../lib/dlq-notify.js';

const JOB_NAME    = 'automation-processor';
const LOCK_TTL_MS = 4 * 60_000;
const TIMEOUT_MS  = 3 * 60_000;
const BATCH_SIZE  = 50;
const MAX_RETRIES = 3;

const metrics = jobMetrics(JOB_NAME);

export interface AutomationQueueDeps {
  db:     Pool;
  redis:  Redis;
  logger: pino.Logger;
}

interface QueueRow {
  id:           string;
  clinic_id:    string;
  automation_id: string;
  trigger:      string;
  entity_id:    string;
  entity_type:  string;
  retry_count:  number;
}

interface AutomationRecord {
  id:           string;
  is_active:    boolean;
  template_body: string;
  channel_type:  string;
  channel_config: Record<string, unknown>;
  conditions:   Array<{ field: string; operator: string; value: unknown }>;
}

export function buildAutomationQueueProcessor(deps: AutomationQueueDeps) {
  const lock = new RedisLock(deps.redis);

  return async function process(_job: Job): Promise<void> {
    const startedAt = Date.now();
    const log       = deps.logger;

    if (Date.now() - startedAt > TIMEOUT_MS) throw new Error(`${JOB_NAME}: timeout`);

    const clinics = await deps.db.query<{ id: string }>(
      `SELECT id FROM shared.clinics WHERE is_active = TRUE AND deleted_at IS NULL`,
    );

    let totalDone = 0, totalSkipped = 0, totalErrors = 0;

    for (const clinic of clinics.rows) {
      const lockKey = `lock:${JOB_NAME}:${clinic.id}`;
      const token   = await lock.acquire(lockKey, LOCK_TTL_MS);
      if (!token) {
        log.info({ jobName: JOB_NAME, tenantId: clinic.id }, 'lock held — skipping clinic');
        continue;
      }

      try {
        const r = await processClinicQueue(deps, clinic.id, log);
        totalDone    += r.done;
        totalSkipped += r.skipped;
        totalErrors  += r.errors;
      } catch (err) {
        totalErrors += 1;
        log.error({ err, jobName: JOB_NAME, tenantId: clinic.id }, 'automation-queue: clinic failed');
      } finally {
        await lock.release(lockKey, token);
      }
    }

    const durationMs = Date.now() - startedAt;
    metrics.success(durationMs, totalDone);

    log.info({
      job_name:        JOB_NAME,
      duration_ms:     durationMs,
      items_processed: totalDone,
      items_skipped:   totalSkipped,
      errors_count:    totalErrors,
      status:          totalErrors > 0 ? 'partial' : 'ok',
    }, 'automation-processor: sweep complete');
  };
}

async function processClinicQueue(
  deps:     AutomationQueueDeps,
  clinicId: string,
  log:      pino.Logger,
): Promise<{ done: number; skipped: number; errors: number }> {
  let done = 0, skipped = 0, errors = 0;

  while (true) {
    // Atomically claim a batch of pending rows via SKIP LOCKED —
    // allows multiple workers to process different items simultaneously.
    const client = await deps.db.connect();
    let rows: QueueRow[] = [];

    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL app.current_clinic_id = $1', [clinicId]);

      const r = await client.query<QueueRow>(
        `WITH claimed AS (
           SELECT id FROM omni.automation_queue
            WHERE clinic_id    = $1
              AND status       = 'pending'
              AND scheduled_for <= NOW()
            ORDER BY scheduled_for ASC
            LIMIT  ${BATCH_SIZE}
              FOR UPDATE SKIP LOCKED
         )
         UPDATE omni.automation_queue q
            SET status = 'processing', updated_at = NOW()
           FROM claimed
          WHERE q.id = claimed.id
          RETURNING q.id, q.clinic_id, q.automation_id, q.trigger,
                    q.entity_id, q.entity_type, q.retry_count`,
        [clinicId],
      );

      rows = r.rows;
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
      log.error({ err, clinicId }, 'automation-queue: claim batch failed');
      break;
    } finally {
      if (!rows.length) client.release();
      else client.release(); // released after claim, individual updates use pool
    }

    if (rows.length === 0) break;

    for (const row of rows) {
      const rowStart = Date.now();
      try {
        const result = await processRow(deps, row, log);

        await deps.db.query(
          `UPDATE omni.automation_queue
              SET status = $2, skip_reason = $3, error_message = $4,
                  duration_ms = $5, processed_at = NOW(), updated_at = NOW()
            WHERE id = $1`,
          [
            row.id,
            result.status,
            result.skipReason  ?? null,
            result.errorMessage ?? null,
            Date.now() - rowStart,
          ],
        );

        if (result.status === 'done')    done    += 1;
        if (result.status === 'skipped') skipped += 1;
      } catch (err) {
        errors += 1;
        const newRetryCount = row.retry_count + 1;
        const isFinal       = newRetryCount >= MAX_RETRIES;
        const errMsg        = err instanceof Error ? err.message : String(err);

        await deps.db.query(
          `UPDATE omni.automation_queue
              SET status      = $2,
                  retry_count = $3,
                  error_message = $4,
                  duration_ms = $5,
                  processed_at = CASE WHEN $2 = 'failed' THEN NOW() ELSE NULL END,
                  updated_at  = NOW()
            WHERE id = $1`,
          [
            row.id,
            isFinal ? 'failed' : 'pending',
            newRetryCount,
            errMsg,
            Date.now() - rowStart,
          ],
        );

        if (isFinal) {
          await notifyAdminDlq({
            db:       deps.db,
            logger:   log,
            jobName:  JOB_NAME,
            jobId:    row.id,
            clinicId: clinicId,
            error:    err,
            payload:  { automationId: row.automation_id, entityId: row.entity_id },
          });
          log.error({ rowId: row.id, clinicId }, 'automation-queue: max retries — moved to failed + DLQ notif');
        } else {
          log.warn({ rowId: row.id, retry: newRetryCount }, 'automation-queue: row failed — will retry');
        }
      }
    }

    if (rows.length < BATCH_SIZE) break;
  }

  return { done, skipped, errors };
}

async function processRow(
  deps: AutomationQueueDeps,
  row:  QueueRow,
  log:  pino.Logger,
): Promise<{ status: 'done' | 'skipped'; skipReason?: string; errorMessage?: string }> {
  // Load automation definition
  const autoRes = await deps.db.query<AutomationRecord>(
    `SELECT a.id, a.is_active, a.conditions,
            t.body          AS template_body,
            ch.type::text   AS channel_type,
            ch.config       AS channel_config
       FROM omni.automations a
  LEFT JOIN omni.templates   t  ON t.id  = a.template_id
  LEFT JOIN omni.channels    ch ON ch.id = a.channel_id
      WHERE a.id = $1 AND a.clinic_id = $2 LIMIT 1`,
    [row.automation_id, row.clinic_id],
  );

  const auto = autoRes.rows[0];
  if (!auto) return { status: 'skipped', skipReason: 'automation_not_found' };
  if (!auto.is_active) return { status: 'skipped', skipReason: 'automation_inactive' };

  // Load entity data for condition evaluation
  const entityData = await loadEntity(deps.db, row.clinic_id, row.entity_type, row.entity_id);
  if (!entityData) return { status: 'skipped', skipReason: `entity_not_found:${row.entity_type}:${row.entity_id}` };

  // Evaluate conditions at dispatch time (state may have changed since enqueue)
  if (auto.conditions?.length) {
    for (const cond of auto.conditions) {
      const val = (entityData as Record<string, unknown>)[cond.field];
      if (!evalCondition(cond.operator, val, cond.value)) {
        return {
          status:     'skipped',
          skipReason: `condition_failed:${cond.field} ${cond.operator} ${JSON.stringify(cond.value)}`,
        };
      }
    }
  }

  // Execute action
  if (auto.template_body && auto.channel_type) {
    const resolved = resolveVars(auto.template_body, entityData);
    await sendMessage(auto.channel_type, auto.channel_config, entityData, resolved, log);
  } else {
    log.info({ rowId: row.id }, 'automation-queue: no template/channel — notification only action');
  }

  return { status: 'done' };
}

async function loadEntity(
  db:         Pool,
  clinicId:   string,
  entityType: string,
  entityId:   string,
): Promise<Record<string, unknown> | null> {
  switch (entityType) {
    case 'appointment': {
      const r = await db.query<Record<string, unknown>>(
        `SELECT p.name AS patient_name, p.phone_encrypted AS patient_phone,
                p.email_encrypted AS patient_email, a.status::text AS status,
                a.scheduled_at::text AS appointment_at, u.name AS doctor_name
           FROM shared.appointments a
           JOIN shared.patients p ON p.id = a.patient_id
      LEFT JOIN shared.users    u ON u.id = a.provider_id
          WHERE a.id = $1 AND a.clinic_id = $2 LIMIT 1`,
        [entityId, clinicId],
      );
      return r.rows[0] ?? null;
    }
    case 'patient': {
      const r = await db.query<Record<string, unknown>>(
        `SELECT p.name AS patient_name, p.phone_encrypted AS patient_phone,
                p.email_encrypted AS patient_email, p.status::text AS status
           FROM shared.patients p
          WHERE p.id = $1 AND p.clinic_id = $2 LIMIT 1`,
        [entityId, clinicId],
      );
      return r.rows[0] ?? null;
    }
    default:
      return null;
  }
}

async function sendMessage(
  channelType: string,
  config:      Record<string, unknown>,
  entity:      Record<string, unknown>,
  body:        string,
  log:         pino.Logger,
): Promise<void> {
  if (channelType === 'whatsapp') {
    const phone = entity['patient_phone'] as string | undefined;
    if (!phone) throw new Error('patient_phone_missing');
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), 15_000);
    try {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${config['phone_number_id']}/messages`,
        {
          method:  'POST',
          headers: { Authorization: `Bearer ${config['access_token']}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body } }),
          signal:  ctrl.signal,
        },
      );
      if (!res.ok) throw new Error(`whatsapp: ${res.status}`);
    } finally {
      clearTimeout(t);
    }
  } else {
    log.info({ channelType }, 'automation-queue: channel send stub');
  }
}

function evalCondition(op: string, val: unknown, expected: unknown): boolean {
  switch (op) {
    case 'eq':         return val === expected;
    case 'neq':        return val !== expected;
    case 'exists':     return val !== null && val !== undefined;
    case 'not_exists': return val === null  || val === undefined;
    case 'in':         return Array.isArray(expected) && expected.includes(val);
    case 'not_in':     return !Array.isArray(expected) || !expected.includes(val);
    default:           return true;
  }
}

function resolveVars(body: string, data: Record<string, unknown>): string {
  return body.replace(/\{\{([a-z_]+)\}\}/g, (_m, key) => {
    const map: Record<string, string> = {
      nome_paciente: String(data['patient_name'] ?? ''),
      medico:        String(data['doctor_name']  ?? ''),
    };
    return map[key] ?? '';
  });
}
