import { db } from '../db/client.js';
import { logger } from '../lib/logger.js';
import { emitToClinic, socketInternalEvents } from '../lib/socket.js';
import { sendMail } from '../lib/mailer.js';
import { eventBus } from '../events/event-bus.js';

/**
 * Critical alert handler — adverse reactions, expired lots detected.
 *
 * Flow:
 *  1. Domain event fires → persistAlert() writes to shared.critical_alerts
 *  2. emitAlert() sends `alert:critical` to `{clinicId}:general` room
 *  3. Client sends `alert:ack` → socketInternalEvents fires 'alert:acked'
 *  4. If no ack in 30s: re-emit (max 3 attempts)
 *  5. After 3 failed attempts: escalate via email to clinic admins
 */

export type CriticalAlertType = 'adverse_reaction' | 'expired_lot_detected';

interface AlertInput {
  clinicId: string;
  type: CriticalAlertType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

interface PersistedAlert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  created_at: Date;
}

async function persistAlert(input: AlertInput): Promise<PersistedAlert> {
  const result = await db.query<PersistedAlert>(
    `INSERT INTO shared.critical_alerts
       (clinic_id, type, title, message, severity, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, 'critical', $5, $6)
     RETURNING id, type, title, message, severity, created_at`,
    [
      input.clinicId,
      input.type,
      input.title,
      input.message,
      input.entityType ?? null,
      input.entityId ?? null,
    ],
  );
  return result.rows[0];
}

async function recordAck(alertId: string, userId: string): Promise<void> {
  await db.query(
    `UPDATE shared.critical_alerts
     SET ack_user_id = $2, ack_at = NOW()
     WHERE id = $1 AND ack_at IS NULL`,
    [alertId, userId],
  );
}

async function recordEmit(alertId: string): Promise<void> {
  await db.query(
    `UPDATE shared.critical_alerts
     SET emit_count = emit_count + 1, last_emitted_at = NOW()
     WHERE id = $1`,
    [alertId],
  );
}

async function escalateAlert(alertId: string, clinicId: string, alert: PersistedAlert): Promise<void> {
  await db.query(
    `UPDATE shared.critical_alerts SET escalated_at = NOW() WHERE id = $1`,
    [alertId],
  );

  // Fetch admin emails for this clinic
  const adminsResult = await db.query<{ email: string; name: string }>(
    `SELECT u.email, u.name
     FROM shared.users u
     WHERE u.clinic_id = $1 AND u.role IN ('admin', 'director') AND u.active = true
     LIMIT 10`,
    [clinicId],
  );

  for (const admin of adminsResult.rows) {
    try {
      await sendMail({
        to: admin.email,
        subject: `[ALERTA CRÍTICO] ${alert.title}`,
        html: '',
        text: [
          `Olá, ${admin.name}.`,
          '',
          `Um alerta crítico requer atenção imediata no DermaOS.`,
          '',
          `Tipo: ${alert.type}`,
          `Mensagem: ${alert.message}`,
          `Criado em: ${alert.created_at.toISOString()}`,
          '',
          `Acesse o sistema para reconhecer este alerta.`,
        ].join('\n'),
      });
    } catch (err) {
      logger.error({ err, email: admin.email, alertId }, 'Failed to send escalation email');
    }
  }

  logger.warn({ alertId, clinicId, recipientCount: adminsResult.rows.length }, 'Critical alert escalated via email');
}

// pending ack timers: alertId → timer
const pendingAcks = new Map<string, ReturnType<typeof setTimeout>>();

const MAX_RETRIES = 3;
const ACK_TIMEOUT_MS = 30_000;

function scheduleAckCheck(
  alertId: string,
  clinicId: string,
  alert: PersistedAlert,
  payload: Record<string, unknown>,
  attempt: number,
): void {
  if (attempt >= MAX_RETRIES) {
    escalateAlert(alertId, clinicId, alert).catch((err) =>
      logger.error({ err, alertId }, 'Failed to escalate unacked critical alert'),
    );
    return;
  }

  const timer = setTimeout(async () => {
    pendingAcks.delete(alertId);
    try {
      const result = await db.query<{ ack_at: Date | null }>(
        `SELECT ack_at FROM shared.critical_alerts WHERE id = $1`,
        [alertId],
      );
      if (result.rows[0]?.ack_at) return; // already acked

      logger.info({ alertId, clinicId, attempt: attempt + 1 }, 'Re-emitting unacked critical alert');
      await recordEmit(alertId);
      emitToClinic(clinicId, 'alert:critical', payload);
      scheduleAckCheck(alertId, clinicId, alert, payload, attempt + 1);
    } catch (err) {
      logger.error({ err, alertId }, 'Failed to re-emit critical alert');
    }
  }, ACK_TIMEOUT_MS);

  pendingAcks.set(alertId, timer);
}

export async function emitCriticalAlert(input: AlertInput): Promise<void> {
  let alert: PersistedAlert;
  try {
    alert = await persistAlert(input);
  } catch (err) {
    logger.error({ err, input }, 'Failed to persist critical alert');
    return;
  }

  await recordEmit(alert.id);

  const payload: Record<string, unknown> = {
    alert_id: alert.id,
    type: alert.type,
    title: alert.title,
    message: alert.message,
    severity: 'critical',
    requires_ack: true,
    created_at: alert.created_at,
  };

  logger.info(
    { alertId: alert.id, clinicId: input.clinicId, type: input.type, timestamp: new Date().toISOString() },
    'alert:critical emitted',
  );
  emitToClinic(input.clinicId, 'alert:critical', payload);
  scheduleAckCheck(alert.id, input.clinicId, alert, payload, 0);
}

export function initAlertsHandler(): void {
  // Ack received from socket gateway
  socketInternalEvents.on(
    'alert:acked',
    ({ alertId, userId, tenantId }: { alertId: string; userId: string; tenantId: string }) => {
      const timer = pendingAcks.get(alertId);
      if (timer) {
        clearTimeout(timer);
        pendingAcks.delete(alertId);
      }
      recordAck(alertId, userId).catch((err) =>
        logger.warn({ err, alertId, userId }, 'Failed to record alert ack'),
      );
    },
  );

  // Subscribe to domain events that trigger critical alerts
  eventBus.subscribe('stock.critical_alert', async (event) => {
    await emitCriticalAlert({
      clinicId: event.clinicId,
      type: 'expired_lot_detected',
      title: 'Estoque crítico',
      message: String(event.payload.message ?? 'Produto em nível crítico de estoque.'),
      entityType: 'product',
      entityId: String(event.payload.productId ?? ''),
    });
  });

  logger.info('Critical alerts handler initialized');
}
