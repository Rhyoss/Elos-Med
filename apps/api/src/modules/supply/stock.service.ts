import { TRPCError } from '@trpc/server';
import { withClinicContext, db } from '../../db/client.js';
import { searchProducts } from './products.service.js';
import type {
  ListStockPositionInput,
  AdjustStockInput,
  ListProductLotsInput,
  ListProductMovementsInput,
  StockStatus,
} from '@dermaos/shared';

export interface StockPositionRow {
  id:               string;
  clinic_id:        string;
  name:             string;
  sku:              string | null;
  barcode:          string | null;
  brand:            string | null;
  unit:             string;
  category_id:      string | null;
  category_name:    string | null;
  supplier_name:    string | null;
  is_controlled:    boolean;
  is_cold_chain:    boolean;
  control_class:    string | null;
  anvisa_registration: string | null;
  photo_object_key: string | null;
  unit_cost:        number | null;
  sale_price:       number | null;
  min_stock:        number;
  max_stock:        number | null;
  reorder_point:    number | null;
  qty_total:        number;
  active_lots:      number;
  next_expiry:      string | null;
  coverage_days:    number | null;
  statuses:         StockStatus[];
  status_priority:  number;
  created_at:       string;
  /** Timestamp ISO da última movimentação registrada (qualquer tipo). Null se nunca movimentou. */
  last_movement_at:   string | null;
  /** Tipo da última movimentação (entrada/saida/ajuste/perda/transferencia/uso_paciente/vencimento). */
  last_movement_type: string | null;
}

export interface LotRow {
  id:                  string;
  lot_number:          string;
  batch_number:        string | null;
  expiry_date:         string | null;
  manufactured_date:   string | null;
  quantity_initial:    number;
  quantity_current:    number;
  unit_cost:           number | null;
  storage_location_id: string | null;
  storage_location_name: string | null;
  is_quarantined:      boolean;
  quarantine_reason:   string | null;
  received_at:         string;
}

export interface MovementRow {
  id:             string;
  type:           string;
  reference_type: string | null;
  quantity:       number;
  quantity_before: number;
  quantity_after:  number;
  notes:          string | null;
  performed_at:   string;
  performed_by_name: string | null;
}

/* ── Posição de estoque ───────────────────────────────────────────────────── */

export async function listStockPosition(
  input:    ListStockPositionInput,
  clinicId: string,
): Promise<{ data: StockPositionRow[]; total: number }> {
  // Se há busca textual, resolve IDs via Typesense/SQL
  let searchIds: string[] | null = null;
  if (input.search && input.search.trim().length >= 2) {
    const result = await searchProducts(input.search.trim(), clinicId, 1, 500);
    searchIds = result.ids;
    if (searchIds.length === 0) {
      return { data: [], total: 0 };
    }
  }

  return withClinicContext(clinicId, async (client) => {
    const conditions: string[] = ['p.clinic_id = $1', 'p.deleted_at IS NULL', 'p.is_active = TRUE'];
    const params: unknown[]    = [clinicId];
    let p = 2;

    if (searchIds !== null) {
      conditions.push(`p.id = ANY($${p++}::uuid[])`);
      params.push(searchIds);
    }
    if (input.categoryId) {
      conditions.push(`p.category_id = $${p++}`);
      params.push(input.categoryId);
    }

    const productWhere = conditions.join(' AND ');

    // Filtro de local de armazenamento (via subquery em inventory_lots)
    const locationFilter = input.storageLocationId
      ? `AND p.id IN (
           SELECT DISTINCT product_id FROM supply.inventory_lots
            WHERE clinic_id = $1 AND storage_location_id = $${p++}
              AND quantity_current > 0
         )`
      : '';
    if (input.storageLocationId) params.push(input.storageLocationId);

    // Status filter aplicado após cálculo (subquery)
    const statusArray    = input.statuses?.length ? input.statuses : null;
    const statusFilter   = statusArray ? `AND statuses_arr && $${p++}::text[]` : '';
    if (statusArray) params.push(statusArray);

    const offset = (input.page - 1) * input.limit;

    const baseQuery = `
      WITH
      consumption AS (
        SELECT product_id,
               SUM(quantity) / 30.0 AS avg_daily
          FROM supply.inventory_movements
         WHERE clinic_id = $1
           AND type IN ('saida', 'uso_paciente', 'perda', 'vencimento')
           AND performed_at >= NOW() - INTERVAL '30 days'
         GROUP BY product_id
      ),
      lot_agg AS (
        SELECT product_id,
               COALESCE(SUM(quantity_current) FILTER (WHERE NOT is_quarantined), 0) AS qty_total,
               MIN(expiry_date) FILTER (WHERE NOT is_quarantined AND quantity_current > 0 AND expiry_date IS NOT NULL) AS next_expiry,
               COUNT(*) FILTER (WHERE NOT is_quarantined AND quantity_current > 0)::int AS active_lots
          FROM supply.inventory_lots
         WHERE clinic_id = $1
         GROUP BY product_id
      ),
      last_mov AS (
        SELECT DISTINCT ON (product_id)
               product_id,
               performed_at AS last_movement_at,
               type::text   AS last_movement_type
          FROM supply.inventory_movements
         WHERE clinic_id = $1
         ORDER BY product_id, performed_at DESC
      ),
      with_status AS (
        SELECT
          p.id, p.clinic_id, p.name, p.sku, p.barcode, p.brand, p.unit,
          p.category_id, c.name AS category_name,
          s.name AS supplier_name,
          p.is_controlled, p.is_cold_chain, p.control_class,
          p.anvisa_registration, p.photo_object_key,
          p.unit_cost, p.sale_price,
          p.min_stock, p.max_stock, p.reorder_point,
          COALESCE(la.qty_total, 0)    AS qty_total,
          COALESCE(la.active_lots, 0)  AS active_lots,
          la.next_expiry,
          CASE WHEN COALESCE(co.avg_daily, 0) > 0
               THEN FLOOR(COALESCE(la.qty_total, 0) / co.avg_daily)::int
               ELSE NULL
          END AS coverage_days,
          ARRAY_REMOVE(ARRAY[
            CASE WHEN COALESCE(la.qty_total, 0) = 0 THEN 'RUPTURA' END,
            CASE WHEN COALESCE(la.qty_total, 0) > 0
                      AND p.min_stock > 0
                      AND COALESCE(la.qty_total, 0) < p.min_stock
                 THEN 'CRITICO' END,
            CASE WHEN COALESCE(la.qty_total, 0) >= COALESCE(p.min_stock, 0)
                      AND p.reorder_point IS NOT NULL
                      AND COALESCE(la.qty_total, 0) <= p.reorder_point
                      AND COALESCE(la.qty_total, 0) > 0
                 THEN 'ATENCAO' END,
            CASE WHEN la.next_expiry IS NOT NULL
                      AND la.next_expiry <= CURRENT_DATE + INTERVAL '30 days'
                 THEN 'VENCIMENTO_PROXIMO' END
          ], NULL) AS statuses_arr,
          p.created_at,
          lm.last_movement_at,
          lm.last_movement_type
        FROM supply.products p
   LEFT JOIN supply.categories c ON c.id = p.category_id AND c.deleted_at IS NULL
   LEFT JOIN supply.suppliers  s ON s.id = p.preferred_supplier_id AND s.deleted_at IS NULL
   LEFT JOIN lot_agg la ON la.product_id = p.id
   LEFT JOIN consumption co ON co.product_id = p.id
   LEFT JOIN last_mov lm ON lm.product_id = p.id
        WHERE ${productWhere} ${locationFilter}
      )
      SELECT *,
             CASE
               WHEN 'RUPTURA'           = ANY(statuses_arr) THEN 1
               WHEN 'CRITICO'           = ANY(statuses_arr) THEN 2
               WHEN 'ATENCAO'           = ANY(statuses_arr) THEN 3
               WHEN 'VENCIMENTO_PROXIMO'= ANY(statuses_arr) THEN 4
               ELSE 5
             END AS status_priority,
             CASE WHEN array_length(statuses_arr, 1) IS NULL
                  THEN ARRAY['OK'::text]
                  ELSE statuses_arr
             END AS statuses
        FROM with_status
       WHERE true ${statusFilter}`;

    const [rows, countResult] = await Promise.all([
      client.query<StockPositionRow>(
        `${baseQuery} ORDER BY status_priority ASC, name ASC
          LIMIT $${p} OFFSET $${p + 1}`,
        [...params, input.limit, offset],
      ),
      client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM (${baseQuery}) sub`,
        params,
      ),
    ]);

    return {
      data:  rows.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0', 10),
    };
  });
}

/* ── Lotes de um produto ──────────────────────────────────────────────────── */

export async function listProductLots(
  input:    ListProductLotsInput,
  clinicId: string,
): Promise<LotRow[]> {
  return withClinicContext(clinicId, async (client) => {
    const rows = await client.query<LotRow>(
      `SELECT il.*,
              sl.name AS storage_location_name
         FROM supply.inventory_lots il
    LEFT JOIN supply.storage_locations sl ON sl.id = il.storage_location_id
        WHERE il.product_id = $1 AND il.clinic_id = $2
          AND il.quantity_current > 0 AND NOT il.is_quarantined
        ORDER BY il.expiry_date ASC NULLS LAST, il.received_at ASC`,
      [input.productId, clinicId],
    );
    return rows.rows;
  });
}

/* ── Movimentações de um produto ──────────────────────────────────────────── */

export async function listProductMovements(
  input:    ListProductMovementsInput,
  clinicId: string,
): Promise<{ data: MovementRow[]; total: number }> {
  return withClinicContext(clinicId, async (client) => {
    const offset = (input.page - 1) * input.limit;
    const [rows, countResult] = await Promise.all([
      client.query<MovementRow>(
        `SELECT im.*,
                u.name AS performed_by_name
           FROM supply.inventory_movements im
      LEFT JOIN shared.users u ON u.id = im.performed_by
          WHERE im.product_id = $1 AND im.clinic_id = $2
          ORDER BY im.performed_at DESC
          LIMIT $3 OFFSET $4`,
        [input.productId, clinicId, input.limit, offset],
      ),
      client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM supply.inventory_movements
          WHERE product_id = $1 AND clinic_id = $2`,
        [input.productId, clinicId],
      ),
    ]);
    return {
      data:  rows.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0', 10),
    };
  });
}

/* ── Ajuste de estoque ────────────────────────────────────────────────────── */

export async function adjustStock(
  input:    AdjustStockInput,
  clinicId: string,
  userId:   string,
): Promise<{ success: boolean; new_qty: number }> {
  return withClinicContext(clinicId, async (client) => {
    // Busca produto
    const prodResult = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM supply.products
        WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [input.productId, clinicId],
    );
    if (!prodResult.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Produto não encontrado.' });
    }

    // Calcula quantidade atual
    const currentQtyResult = await client.query<{ qty: number }>(
      `SELECT COALESCE(SUM(quantity_current), 0)::numeric AS qty
         FROM supply.inventory_lots
        WHERE product_id = $1 AND clinic_id = $2 AND NOT is_quarantined`,
      [input.productId, clinicId],
    );
    const currentQty = Number(currentQtyResult.rows[0]?.qty ?? 0);

    // Calcula o delta com base no motivo
    let delta: number;
    let movementType: string;
    let newQty: number;

    if (input.reason === 'contagem') {
      // Nova contagem absoluta — delta = nova contagem - atual
      if (input.quantity < 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Contagem deve ser ≥ 0.' });
      }
      delta       = input.quantity - currentQty;
      movementType = 'ajuste';
      newQty      = input.quantity;
    } else if (input.reason === 'perda') {
      if (input.quantity <= 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Quantidade de perda deve ser > 0.' });
      }
      if (input.quantity > currentQty) {
        throw new TRPCError({
          code:    'BAD_REQUEST',
          message: `Quantidade de perda (${input.quantity}) excede o estoque atual (${currentQty}).`,
        });
      }
      delta        = -input.quantity;
      movementType = 'perda';
      newQty       = currentQty - input.quantity;
    } else {
      // correcao — delta direto (positivo ou negativo)
      delta        = input.quantity;
      movementType = 'ajuste';
      newQty       = currentQty + input.quantity;
      if (newQty < 0) {
        throw new TRPCError({
          code:    'BAD_REQUEST',
          message: `Correção resultaria em estoque negativo (${newQty}).`,
        });
      }
    }

    if (delta === 0) {
      return { success: true, new_qty: currentQty };
    }

    // Aplica delta nos lotes disponíveis (FEFO — First Expired First Out)
    if (delta < 0) {
      const lotsResult = await client.query<{ id: string; quantity_current: number }>(
        `SELECT id, quantity_current FROM supply.inventory_lots
          WHERE product_id = $1 AND clinic_id = $2 AND NOT is_quarantined AND quantity_current > 0
          ORDER BY expiry_date ASC NULLS LAST, received_at ASC`,
        [input.productId, clinicId],
      );

      let remaining = Math.abs(delta);
      for (const lot of lotsResult.rows) {
        if (remaining <= 0) break;
        const deduct = Math.min(remaining, lot.quantity_current);
        await client.query(
          `UPDATE supply.inventory_lots
              SET quantity_current = quantity_current - $3
            WHERE id = $1 AND clinic_id = $2`,
          [lot.id, clinicId, deduct],
        );
        remaining -= deduct;
      }
    } else {
      // Para ajuste positivo: adiciona ao lote mais recente ou cria lote de ajuste
      const latestLot = await client.query<{ id: string }>(
        `SELECT id FROM supply.inventory_lots
          WHERE product_id = $1 AND clinic_id = $2 AND NOT is_quarantined
          ORDER BY received_at DESC LIMIT 1`,
        [input.productId, clinicId],
      );

      if (latestLot.rows[0]) {
        await client.query(
          `UPDATE supply.inventory_lots
              SET quantity_current = quantity_current + $3
            WHERE id = $1 AND clinic_id = $2`,
          [latestLot.rows[0].id, clinicId, delta],
        );
      } else {
        // Cria um lote de ajuste se não houver lotes existentes
        await client.query(
          `INSERT INTO supply.inventory_lots
             (clinic_id, product_id, lot_number, quantity_initial, quantity_current)
           VALUES ($1, $2, $3, $4, $4)`,
          [clinicId, input.productId, `ADJ-${Date.now()}`, delta],
        );
      }
    }

    // Registra movimento (imutável)
    await client.query(
      `INSERT INTO supply.inventory_movements
         (clinic_id, product_id, type, reference_type, quantity,
          quantity_before, quantity_after, notes, performed_by)
       VALUES ($1, $2, $3::supply.movement_type, 'manual'::supply.movement_reference_type,
               $4, $5, $6, $7, $8)`,
      [
        clinicId,
        input.productId,
        movementType,
        Math.abs(delta),
        currentQty,
        newQty,
        input.notes ?? `Ajuste manual: ${input.reason}`,
        userId,
      ],
    );

    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'supply_product', $2, 'supply_stock.adjusted', $3, $4)`,
      [
        clinicId, input.productId,
        JSON.stringify({ reason: input.reason, delta, current_qty: currentQty, new_qty: newQty }),
        JSON.stringify({ user_id: userId }),
      ],
    );

    return { success: true, new_qty: newQty };
  });
}
