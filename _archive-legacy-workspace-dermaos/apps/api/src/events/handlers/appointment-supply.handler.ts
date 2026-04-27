import { eventBus } from '../event-bus.js';
import { db } from '../../db/client.js';
import { logger } from '../../lib/logger.js';

const LOW_STOCK_THRESHOLD = 0.2; // 20% do estoque mínimo = alerta crítico

/**
 * Ao agendar consulta, verifica disponibilidade de kit/insumos vinculados.
 * Emite stock.low_alert se algum item estiver abaixo do ponto de reposição.
 */
export function registerAppointmentSupplyHandler(): void {
  eventBus.subscribe('appointment.scheduled', async (event) => {
    const { appointmentId, procedureType, patientId } = event.payload as {
      appointmentId: string;
      procedureType?: string;
      patientId: string;
    };

    if (!procedureType) return;

    const clinicId = event.clinicId;

    // Busca kit vinculado ao tipo de procedimento
    const kitRes = await db.query<{ id: string; name: string }>(
      `SELECT id, name FROM supply.kit_templates
       WHERE clinic_id = $1 AND procedure_type = $2 AND is_active = TRUE
       LIMIT 1`,
      [clinicId, procedureType],
    );

    const kit = kitRes.rows[0];
    if (!kit) return;

    // Busca itens do kit
    const itemsRes = await db.query<{
      product_id: string; quantity: number; is_optional: boolean; product_name: string;
      min_stock: number; reorder_point: number;
    }>(
      `SELECT ki.product_id, ki.quantity, ki.is_optional,
              p.name AS product_name, p.min_stock, p.reorder_point
       FROM supply.kit_items ki
       JOIN supply.products p ON p.id = ki.product_id
       WHERE ki.kit_id = $1`,
      [kit.id],
    );

    for (const item of itemsRes.rows) {
      if (item.is_optional) continue;

      // Saldo atual por produto
      const stockRes = await db.query<{ total: number }>(
        `SELECT COALESCE(SUM(quantity_current), 0) AS total
         FROM supply.inventory_lots
         WHERE clinic_id = $1 AND product_id = $2
           AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)`,
        [clinicId, item.product_id],
      );

      const currentStock = Number(stockRes.rows[0]?.total ?? 0);
      const needed = item.quantity;

      if (currentStock < needed) {
        // Estoque insuficiente para o kit
        const isCritical = currentStock <= item.min_stock * LOW_STOCK_THRESHOLD;
        const alertType = isCritical ? 'stock.critical_alert' : 'stock.low_alert';

        await eventBus.publish(alertType, clinicId, item.product_id, {
          productName: item.product_name,
          currentStock,
          neededForKit: needed,
          reorderPoint: item.reorder_point,
          minStock: item.min_stock,
          kitId: kit.id,
          kitName: kit.name,
          appointmentId,
          patientId,
        });

        logger.warn(
          { productId: item.product_id, currentStock, needed, clinicId, alertType },
          'appointment-supply: stock alert triggered',
        );
      }
    }
  });
}
