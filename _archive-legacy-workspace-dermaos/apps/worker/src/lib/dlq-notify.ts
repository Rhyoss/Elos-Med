/**
 * DLQ admin notification helper.
 *
 * Called after a job exhausts all BullMQ retry attempts.  Inserts a row into
 * shared.admin_notifications so the admin UI can surface the failure and
 * trigger alerting (e.g. email/Slack via a separate notification handler).
 */

import type { Pool } from 'pg';
import type pino from 'pino';

export async function notifyAdminDlq(opts: {
  db:        Pool;
  logger:    pino.Logger;
  jobName:   string;
  jobId:     string | undefined;
  clinicId?: string;
  error:     unknown;
  payload?:  Record<string, unknown>;
}): Promise<void> {
  const { db, logger, jobName, jobId, clinicId, error, payload } = opts;
  const message =
    error instanceof Error ? error.message : String(error);

  try {
    await db.query(
      `INSERT INTO shared.admin_notifications
         (type, job_name, job_id, clinic_id, severity, message, payload)
       VALUES ('dlq_job_failed', $1, $2, $3, 'error', $4, $5::jsonb)`,
      [
        jobName,
        jobId ?? null,
        clinicId ?? null,
        `Job moved to DLQ after max retries: ${message}`,
        JSON.stringify({ jobName, jobId, clinicId, error: message, ...(payload ?? {}) }),
      ],
    );
    logger.warn({ jobName, jobId, clinicId, message }, 'dlq: admin notification inserted');
  } catch (insertErr) {
    logger.error({ insertErr, jobName }, 'dlq: failed to insert admin notification');
  }
}
