import { db } from '../db/client.js';
import { logger } from '../lib/logger.js';
import { emitToUser } from '../lib/socket.js';
import { socketInternalEvents } from '../lib/socket.js';

/**
 * Notification delivery handler.
 *
 * Flow:
 *  1. persist() writes to shared.notifications (DB-first guarantees delivery even if client is offline)
 *  2. emit() sends `notification` event to `user:{userId}` room
 *  3. Client sends `notification:ack` → socket.ts fires socketInternalEvents('notification:acked')
 *  4. If no ack in 30s: re-emit (max 3 total attempts)
 */

export type NotificationType =
  | 'biopsy_result'
  | 'stock_critical'
  | 'lead_high_score'
  | 'purchase_approval'
  | 'appointment_reminder'
  | 'general';

export interface NotificationInput {
  clinicId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  priority?: 'low' | 'normal' | 'high';
  extra?: Record<string, unknown>;
}

interface PersistedNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  priority: string;
  created_at: Date;
}

async function persistNotification(input: NotificationInput): Promise<PersistedNotification> {
  const result = await db.query<PersistedNotification>(
    `INSERT INTO shared.notifications
       (clinic_id, user_id, type, title, message, entity_type, entity_id, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, type, title, message, entity_type, entity_id, priority, created_at`,
    [
      input.clinicId,
      input.userId,
      input.type,
      input.title,
      input.message,
      input.entityType ?? null,
      input.entityId ?? null,
      input.priority ?? 'normal',
    ],
  );
  return result.rows[0];
}

async function markDelivered(notificationId: string): Promise<void> {
  await db.query(
    `UPDATE shared.notifications SET delivered_at = NOW() WHERE id = $1 AND delivered_at IS NULL`,
    [notificationId],
  );
}

function buildPayload(n: PersistedNotification): Record<string, unknown> {
  return {
    notification_id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    entity_type: n.entity_type,
    entity_id: n.entity_id,
    priority: n.priority,
    created_at: n.created_at,
  };
}

const MAX_RETRIES = 3;
const ACK_TIMEOUT_MS = 30_000;

function scheduleAckCheck(
  notificationId: string,
  userId: string,
  payload: Record<string, unknown>,
  attempt: number,
): void {
  if (attempt >= MAX_RETRIES) return;

  const timer = setTimeout(async () => {
    pendingAcks.delete(notificationId);
    // Check if still undelivered
    try {
      const result = await db.query<{ delivered_at: Date | null }>(
        `SELECT delivered_at FROM shared.notifications WHERE id = $1`,
        [notificationId],
      );
      if (result.rows[0]?.delivered_at) return; // already acked
      logger.info({ notificationId, userId, attempt: attempt + 1 }, 'Re-emitting unacked notification');
      emitToUser(userId, 'notification', payload);
      scheduleAckCheck(notificationId, userId, payload, attempt + 1);
    } catch (err) {
      logger.error({ err, notificationId }, 'Failed to check notification ack status');
    }
  }, ACK_TIMEOUT_MS);

  pendingAcks.set(notificationId, timer);
}

const pendingAcks = new Map<string, ReturnType<typeof setTimeout>>();

export async function sendNotification(input: NotificationInput): Promise<void> {
  let notification: PersistedNotification;
  try {
    notification = await persistNotification(input);
  } catch (err) {
    logger.error({ err, input }, 'Failed to persist notification');
    return;
  }

  const payload = buildPayload(notification);

  emitToUser(input.userId, 'notification', payload);

  // Set up ack tracking
  scheduleAckCheck(notification.id, input.userId, payload, 0);
}

export function initNotificationsHandler(): void {
  socketInternalEvents.on(
    'notification:acked',
    ({ notificationId, userId }: { notificationId: string; userId: string }) => {
      // Cancel pending retry timer
      const timer = pendingAcks.get(notificationId);
      if (timer) {
        clearTimeout(timer);
        pendingAcks.delete(notificationId);
      }
      // Mark delivered in DB (fire-and-forget, non-critical)
      markDelivered(notificationId).catch((err) =>
        logger.warn({ err, notificationId, userId }, 'Failed to mark notification delivered'),
      );
    },
  );
  logger.info('Notifications real-time handler initialized');
}
