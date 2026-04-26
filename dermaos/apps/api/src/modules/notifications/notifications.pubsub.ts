import { eventBus } from '../../events/event-bus.js';
import { logger } from '../../lib/logger.js';
import { sendNotification } from '../../realtime/notifications.handler.js';
import { db } from '../../db/client.js';

/**
 * Subscribes to domain events that generate user notifications.
 * Each subscription maps an event to one or more target users.
 *
 * Payload rule: NEVER include PHI. Only IDs + entity references.
 * Client fetches full data via API when user clicks the notification.
 */

async function getUsersByRole(
  clinicId: string,
  roles: string[],
): Promise<{ id: string }[]> {
  const result = await db.query<{ id: string }>(
    `SELECT id FROM shared.users
     WHERE clinic_id = $1 AND role = ANY($2::text[]) AND active = true`,
    [clinicId, roles],
  );
  return result.rows;
}

async function getEncounterProvider(encounterId: string): Promise<string | null> {
  const result = await db.query<{ provider_id: string }>(
    `SELECT provider_id FROM clinical.encounters WHERE id = $1`,
    [encounterId],
  );
  return result.rows[0]?.provider_id ?? null;
}

export function subscribeNotificationEvents(): void {
  // ── Biopsy result → notify responsible doctor ─────────────────────────────
  eventBus.subscribe('biopsy.result_received', async (event) => {
    const encounterId = String(event.payload.encounterId ?? event.aggregateId);
    const providerId = await getEncounterProvider(encounterId);
    if (!providerId) return;

    await sendNotification({
      clinicId: event.clinicId,
      userId: providerId,
      type: 'biopsy_result',
      title: 'Resultado de biópsia disponível',
      message: 'Um resultado de biópsia está aguardando revisão.',
      entityType: 'encounter',
      entityId: encounterId,
      priority: 'high',
    });
  });

  // ── Stock critical → notify admins ────────────────────────────────────────
  eventBus.subscribe('stock.critical_alert', async (event) => {
    const admins = await getUsersByRole(event.clinicId, ['admin', 'director']);
    const productId = String(event.payload.productId ?? event.aggregateId);
    const productName = String(event.payload.productName ?? 'Produto');

    await Promise.all(
      admins.map((u) =>
        sendNotification({
          clinicId: event.clinicId,
          userId: u.id,
          type: 'stock_critical',
          title: 'Estoque em nível crítico',
          message: `${productName} atingiu nível crítico de estoque.`,
          entityType: 'product',
          entityId: productId,
          priority: 'high',
        }),
      ),
    );
  });

  // ── Lead high score → notify receptionists ────────────────────────────────
  eventBus.subscribe('lead.score_changed', async (event) => {
    const score = Number(event.payload.score ?? 0);
    if (score < 80) return; // only notify on high-score leads

    const receptionists = await getUsersByRole(event.clinicId, ['receptionist', 'admin']);
    const contactId = String(event.payload.contactId ?? event.aggregateId);

    await Promise.all(
      receptionists.map((u) =>
        sendNotification({
          clinicId: event.clinicId,
          userId: u.id,
          type: 'lead_high_score',
          title: 'Lead com pontuação alta',
          message: `Lead atingiu pontuação ${score} — oportunidade de conversão.`,
          entityType: 'contact',
          entityId: contactId,
          priority: 'normal',
        }),
      ),
    );
  });

  // ── Purchase order pending approval → notify admins ───────────────────────
  eventBus.subscribe('purchase_order.requested', async (event) => {
    const admins = await getUsersByRole(event.clinicId, ['admin', 'director']);
    const poId = String(event.payload.purchaseOrderId ?? event.aggregateId);

    await Promise.all(
      admins.map((u) =>
        sendNotification({
          clinicId: event.clinicId,
          userId: u.id,
          type: 'purchase_approval',
          title: 'Pedido de compra aguarda aprovação',
          message: 'Um novo pedido de compra requer sua aprovação.',
          entityType: 'purchase_order',
          entityId: poId,
          priority: 'normal',
        }),
      ),
    );
  });

  logger.info('Notification domain event subscriptions active');
}
