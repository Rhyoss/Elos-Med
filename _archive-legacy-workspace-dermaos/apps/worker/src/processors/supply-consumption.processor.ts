/**
 * Processor `supply-consumption` — Prompt 14.
 *
 * Consome o kit vinculado ao procedimento de um encounter ou protocol_session.
 *
 * Idempotência tripla:
 *   1. BullMQ jobId = encounter:<id> ou session:<id> (dedup na fila)
 *   2. UNIQUE (clinic_id, idempotency_key) em procedure_consumption_log
 *   3. SELECT FOR UPDATE no log row antes de rodar a lógica principal
 *
 * Transação única (BEGIN/COMMIT via withClinicContext):
 *   - Lock do kit (FOR SHARE)
 *   - Para cada item: FOR UPDATE nos lotes, UPDATE qty_current,
 *     INSERT em inventory_movements (saida/procedimento),
 *     INSERT em patient_lot_traces.
 *   - INSERT em procedure_consumption_log com UNIQUE key.
 *   - Se algum item fica sem estoque: INSERT em consumption_pending_items
 *     e emite `stock.consumption_incomplete`.
 *
 * Qualquer erro → ROLLBACK completo (nenhum consumo parcial silencioso).
 * Falta de estoque NÃO é erro: é tratada como consumo parcial.
 */

import type { Job } from 'bullmq';
import type { Pool } from 'pg';
import type Redis from 'ioredis';
import type pino from 'pino';
import type { SupplyConsumptionJob } from '../../../api/src/jobs/queues.js';

interface Deps {
  db:     Pool;
  redis:  Redis;
  logger: pino.Logger;
}

const CLINIC_CTX_SQL = `SET LOCAL app.current_clinic_id = $1`;

async function withClinicTx<T>(
  db: Pool,
  clinicId: string,
  fn: (client: any) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(CLINIC_CTX_SQL, [clinicId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export function buildSupplyConsumptionProcessor(deps: Deps) {
  const { db, redis, logger } = deps;

  return async (job: Job<SupplyConsumptionJob>) => {
    const data = job.data;
    const log = logger.child({
      queue: 'supply-consumption', jobId: job.id,
      clinicId: data.clinicId, encounterId: data.encounterId, sessionId: data.protocolSessionId,
    });

    const idempotencyKey = data.encounterId
      ? `encounter:${data.encounterId}`
      : `session:${data.protocolSessionId}`;

    if (!data.serviceId) {
      log.info('No service_id provided — skipping consumption');
      return { skipped: true, reason: 'no_service' };
    }

    try {
      const result = await withClinicTx(db, data.clinicId, async (client) => {
        // Idempotência: lock do log row. Se já existe, no-op.
        const existing = await client.query(
          `SELECT id, status FROM supply.procedure_consumption_log
            WHERE clinic_id = $1 AND idempotency_key = $2
              FOR UPDATE`,
          [data.clinicId, idempotencyKey],
        );
        if (existing.rows[0]) {
          return { alreadyProcessed: true, status: existing.rows[0].status, logId: existing.rows[0].id };
        }

        // Busca kit ativo para o tipo de procedimento
        const kitR = await client.query(
          `SELECT id, name FROM supply.kit_templates
            WHERE clinic_id = $1 AND procedure_type_id = $2
              AND status = 'active' AND deleted_at IS NULL
            LIMIT 1
              FOR SHARE`,
          [data.clinicId, data.serviceId],
        );
        if (!kitR.rows[0]) {
          // Nenhum kit vinculado — grava log como skipped para registrar a tentativa
          const skipR = await client.query(
            `INSERT INTO supply.procedure_consumption_log
               (clinic_id, encounter_id, protocol_session_id, kit_template_id,
                source, status, items_consumed, items_pending,
                performed_by, performed_at, idempotency_key, notes)
             VALUES ($1, $2, $3, NULL, $4, 'skipped', 0, 0,
                     $5, $6, $7, 'Nenhum kit vinculado ao procedimento')
             RETURNING id`,
            [
              data.clinicId, data.encounterId ?? null, data.protocolSessionId ?? null,
              data.source, data.performedBy ?? null,
              data.triggeredAt, idempotencyKey,
            ],
          );
          return { skipped: true, status: 'skipped', logId: skipR.rows[0].id };
        }

        const kit = kitR.rows[0];

        // Carrega patient_id quando só veio sessionId
        let patientId = data.patientId;
        if (!patientId && data.protocolSessionId) {
          const r = await client.query(
            `SELECT pr.patient_id
               FROM clinical.protocol_sessions ps
               JOIN clinical.protocols pr ON pr.id = ps.protocol_id
              WHERE ps.id = $1 LIMIT 1`,
            [data.protocolSessionId],
          );
          patientId = r.rows[0]?.patient_id;
        }
        if (!patientId) {
          throw new Error('patient_id indisponível — cancelando consumo');
        }

        // Carrega itens do kit
        const itemsR = await client.query(
          `SELECT ki.product_id, p.name AS product_name, p.unit AS product_unit,
                  ki.quantity, ki.is_optional
             FROM supply.kit_items ki
             JOIN supply.products p ON p.id = ki.product_id
            WHERE ki.kit_template_id = $1 AND ki.clinic_id = $2
            ORDER BY ki.display_order ASC`,
          [kit.id, data.clinicId],
        );

        const missingItems: Array<{ productId: string; productName: string; quantityMissing: number }> = [];
        const pendingInserts: Array<{ productId: string; qtyMissing: number; qtyRequired: number }> = [];
        let itemsConsumed = 0;
        let itemsPending  = 0;

        for (const it of itemsR.rows) {
          const required = Number(it.quantity);

          // FEFO com FOR UPDATE
          const lots = await client.query(
            `SELECT id, product_id, storage_location_id, lot_number,
                    quantity_current, unit_cost, status, expiry_date, received_at
               FROM supply.inventory_lots
              WHERE clinic_id = $1 AND product_id = $2
                AND status = 'active' AND quantity_current > 0
                AND deleted_at IS NULL
              ORDER BY expiry_date ASC NULLS LAST, received_at ASC
                FOR UPDATE`,
            [data.clinicId, it.product_id],
          );

          let remaining = required;
          let consumedQty = 0;
          for (const lot of lots.rows) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, Number(lot.quantity_current));

            const qtyBeforeR = await client.query(
              `SELECT COALESCE(SUM(quantity_current), 0)::numeric AS qty
                 FROM supply.inventory_lots
                WHERE clinic_id = $1 AND product_id = $2
                  AND status = 'active' AND deleted_at IS NULL`,
              [data.clinicId, it.product_id],
            );
            const qtyBefore = Number(qtyBeforeR.rows[0]?.qty ?? 0);

            await client.query(
              `UPDATE supply.inventory_lots
                  SET quantity_current = quantity_current - $2, updated_at = NOW()
                WHERE id = $1`,
              [lot.id, take],
            );

            // Marca como consumed se zerou
            await client.query(
              `UPDATE supply.inventory_lots
                  SET status = 'consumed', updated_at = NOW()
                WHERE id = $1 AND quantity_current = 0 AND status = 'active'`,
              [lot.id],
            );

            const qtyAfter = qtyBefore - take;

            await client.query(
              `INSERT INTO supply.inventory_movements
                 (clinic_id, product_id, lot_id,
                  type, reason, reference_type, reference_id,
                  quantity, quantity_before, quantity_after, unit_cost,
                  from_storage_location_id, encounter_id,
                  notes, performed_by)
               VALUES ($1, $2, $3,
                       'saida'::supply.movement_type,
                       'procedimento'::supply.movement_reason,
                       CASE WHEN $4::uuid IS NOT NULL THEN 'appointment'::supply.movement_reference_type
                            WHEN $5::uuid IS NOT NULL THEN 'protocol_session'::supply.movement_reference_type
                            ELSE 'manual'::supply.movement_reference_type END,
                       COALESCE($4, $5),
                       $6, $7, $8, $9,
                       $10, $4,
                       'Consumo automático por kit', $11)`,
              [
                data.clinicId, it.product_id, lot.id,
                data.encounterId ?? null, data.protocolSessionId ?? null,
                take, qtyBefore, qtyAfter, lot.unit_cost ?? null,
                lot.storage_location_id ?? null, data.performedBy ?? null,
              ],
            );

            await client.query(
              `INSERT INTO supply.patient_lot_traces
                 (clinic_id, patient_id, lot_id, product_id, kit_template_id,
                  encounter_id, protocol_session_id,
                  quantity_used, applied_by, applied_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [
                data.clinicId, patientId, lot.id, it.product_id, kit.id,
                data.encounterId ?? null, data.protocolSessionId ?? null,
                take, data.performedBy ?? null, data.triggeredAt,
              ],
            );

            consumedQty += take;
            remaining   -= take;
          }

          if (consumedQty > 0) itemsConsumed += 1;
          if (remaining > 0) {
            if (!it.is_optional) {
              itemsPending += 1;
              missingItems.push({
                productId:       it.product_id,
                productName:     it.product_name,
                quantityMissing: remaining,
              });
            }
            pendingInserts.push({
              productId:   it.product_id,
              qtyMissing:  remaining,
              qtyRequired: required,
            });
          }
        }

        const status = itemsPending > 0 ? 'partial' : (itemsConsumed > 0 ? 'completed' : 'skipped');

        const logR = await client.query(
          `INSERT INTO supply.procedure_consumption_log
             (clinic_id, encounter_id, protocol_session_id, kit_template_id,
              source, status, items_consumed, items_pending,
              performed_by, performed_at, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            data.clinicId, data.encounterId ?? null, data.protocolSessionId ?? null, kit.id,
            data.source, status, itemsConsumed, itemsPending,
            data.performedBy ?? null, data.triggeredAt, idempotencyKey,
          ],
        );
        const logId = logR.rows[0].id;

        for (const pi of pendingInserts) {
          await client.query(
            `INSERT INTO supply.consumption_pending_items
               (clinic_id, consumption_log_id, product_id, quantity_missing, quantity_required)
             VALUES ($1, $2, $3, $4, $5)`,
            [data.clinicId, logId, pi.productId, pi.qtyMissing, pi.qtyRequired],
          );
        }

        // Audit event (mesma transação — se falha depois, tudo rola back)
        await client.query(
          `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
           VALUES ($1, 'supply_consumption', $2, 'consumption.recorded', $3, $4)`,
          [
            data.clinicId, logId,
            JSON.stringify({
              kitId: kit.id, kitName: kit.name, patientId,
              encounterId: data.encounterId ?? null, status,
              itemsConsumed, itemsPending, source: data.source,
            }),
            JSON.stringify({ user_id: data.performedBy ?? null, triggered_from: 'worker' }),
          ],
        );

        return {
          alreadyProcessed: false,
          logId, status, itemsConsumed, itemsPending,
          kitId:   kit.id,
          kitName: kit.name,
          missingItems,
        };
      });

      // Emite eventos via Redis pub/sub APÓS o commit (evitamos ruído em caso de rollback)
      if (!result.alreadyProcessed && 'missingItems' in result) {
        const missing = result.missingItems ?? [];
        if (missing.length > 0) {
          await redis.publish('supply:realtime', JSON.stringify({
            clinicId: data.clinicId,
            event:    'stock.consumption_incomplete',
            payload: {
              kitId:       result.kitId,
              kitName:     result.kitName,
              encounterId: data.encounterId ?? null,
              patientId:   data.patientId,
              missingItems: missing,
            },
          }));
        }
        await redis.publish('supply:realtime', JSON.stringify({
          clinicId: data.clinicId,
          event:    'supply.consumption_recorded',
          payload: {
            consumptionLogId: result.logId,
            kitId:            result.kitId,
            status:           result.status,
            patientId:        data.patientId,
            encounterId:      data.encounterId ?? null,
          },
        }));
      }

      log.info({ result }, 'Consumption processed');
      return result;
    } catch (err) {
      log.error({ err }, 'Consumption processor failed — will retry per BullMQ attempts config');
      throw err;
    }
  };
}
