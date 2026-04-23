import { eventBus } from '../event-bus.js';
import { db } from '../../db/client.js';
import { logger } from '../../lib/logger.js';

/**
 * Ao concluir encontro, debita os insumos do kit do estoque
 * e registra rastreabilidade por paciente (ANVISA).
 */
export function registerEncounterStockHandler(): void {
  eventBus.subscribe('encounter.completed', async (event) => {
    const { encounterId, patientId, kitId, providerId } = event.payload as {
      encounterId: string;
      patientId: string;
      kitId?: string;
      providerId: string;
    };

    if (!kitId) return;

    const clinicId = event.clinicId;

    // Busca itens do kit
    const itemsRes = await db.query<{
      product_id: string; quantity: number; unit: string;
      product_name: string; requires_cold_chain: boolean;
    }>(
      `SELECT ki.product_id, ki.quantity, ki.unit,
              p.name AS product_name, p.requires_cold_chain
       FROM supply.kit_items ki
       JOIN supply.products p ON p.id = ki.product_id
       WHERE ki.kit_id = $1 AND ki.is_optional = FALSE`,
      [kitId],
    );

    for (const item of itemsRes.rows) {
      // FEFO: consome os lotes com expiração mais próxima primeiro
      const lotsRes = await db.query<{
        id: string; lot_number: string; quantity_current: number;
        expiration_date: string | null; cost_price: number;
      }>(
        `SELECT id, lot_number, quantity_current, expiration_date, cost_price
         FROM supply.inventory_lots
         WHERE clinic_id = $1 AND product_id = $2
           AND quantity_current > 0
           AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
         ORDER BY expiration_date ASC NULLS LAST, created_at ASC
         FOR UPDATE SKIP LOCKED`,
        [clinicId, item.product_id],
      );

      let remaining = item.quantity;

      for (const lot of lotsRes.rows) {
        if (remaining <= 0) break;

        const consumed = Math.min(remaining, lot.quantity_current);

        // Debita do lote
        await db.query(
          `UPDATE supply.inventory_lots
           SET quantity_current = quantity_current - $1
           WHERE id = $2`,
          [consumed, lot.id],
        );

        // Registra movimentação
        const movRes = await db.query<{ id: string }>(
          `INSERT INTO supply.inventory_movements
             (clinic_id, product_id, lot_id, type, quantity, unit,
              reason, reference_type, reference_id, cost_unit, performed_by, performed_at)
           VALUES ($1, $2, $3, 'saida', $4, $5, $6, 'encounter', $7, $8, $9, NOW())
           RETURNING id`,
          [
            clinicId, item.product_id, lot.id,
            consumed, item.unit,
            `Kit aplicado em atendimento ${encounterId}`,
            encounterId,
            lot.cost_price ?? 0,
            providerId,
          ],
        );

        // Rastreabilidade ANVISA — patient_lot_traces
        await db.query(
          `INSERT INTO supply.patient_lot_traces
             (clinic_id, patient_id, product_id, lot_id, encounter_id,
              quantity_used, unit, movement_id, traced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            clinicId, patientId, item.product_id, lot.id,
            encounterId, consumed, item.unit, movRes.rows[0]!.id,
          ],
        );

        remaining -= consumed;
      }

      if (remaining > 0) {
        logger.warn(
          { productId: item.product_id, shortfall: remaining, encounterId, clinicId },
          'encounter-stock: insufficient stock to fulfill kit — partial debit',
        );
      }
    }

    logger.info({ encounterId, kitId, clinicId }, 'encounter-stock: inventory debited for encounter');
  });
}
