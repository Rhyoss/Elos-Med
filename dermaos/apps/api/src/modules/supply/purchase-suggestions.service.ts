import { db } from '../../db/client.js';
import type { ListSuggestionsInput, PurchaseSuggestion } from '@dermaos/shared';

interface SuggestionRow {
  product_id:             string;
  product_name:           string;
  sku:                    string | null;
  unit:                   string;
  qty_atual:              string;
  reorder_point:          string;
  qty_sugerida:           string;
  max_stock:              string | null;
  suggested_supplier_id:  string | null;
  suggested_supplier_name: string | null;
  last_unit_cost:         string | null;
  last_order_date:        string | null;
  demanda_proxima:        boolean;
  procedure_count:        string;
  stock_status:           'RUPTURA' | 'CRITICO' | 'ATENCAO';
}

export async function listPurchaseSuggestions(
  input:    ListSuggestionsInput,
  clinicId: string,
): Promise<{ items: PurchaseSuggestion[]; total: number }> {
  const offset = (input.page - 1) * input.limit;
  const params: unknown[] = [clinicId];

  // Filtro opcional por fornecedor sugerido
  const supplierFilter = input.supplierId
    ? ` AND COALESCE(lo.supplier_id, p.preferred_supplier_id) = $${params.push(input.supplierId)}`
    : '';

  const sql = `
    WITH stock AS (
      SELECT
        p.id,
        p.name,
        p.sku,
        p.unit,
        p.reorder_point,
        p.max_stock,
        p.min_stock,
        p.preferred_supplier_id,
        COALESCE(SUM(l.quantity_current), 0) AS qty_atual
      FROM supply.products p
      LEFT JOIN supply.inventory_lots l
        ON  l.product_id    = p.id
        AND l.status        = 'active'
        AND l.deleted_at    IS NULL
      WHERE p.clinic_id  = $1
        AND p.is_active  = TRUE
        AND p.reorder_point IS NOT NULL
        AND p.deleted_at IS NULL
      GROUP BY p.id
      HAVING COALESCE(SUM(l.quantity_current), 0) < p.reorder_point
    ),
    last_orders AS (
      SELECT DISTINCT ON (poi.product_id)
        poi.product_id,
        po.supplier_id,
        s.name           AS supplier_name,
        poi.unit_cost    AS last_unit_cost,
        po.created_at    AS last_order_date
      FROM supply.purchase_order_items poi
      JOIN supply.purchase_orders po ON po.id = poi.purchase_order_id
        AND po.clinic_id   = $1
        AND po.deleted_at  IS NULL
        AND po.status IN ('enviado', 'parcialmente_recebido', 'recebido')
      JOIN supply.suppliers s ON s.id = po.supplier_id
      ORDER BY poi.product_id, po.created_at DESC
    ),
    preferred_suppliers AS (
      SELECT s.id, s.name
      FROM supply.suppliers s
      WHERE s.clinic_id = $1 AND s.is_active = TRUE
    ),
    upcoming_demand AS (
      SELECT ki.product_id, COUNT(*) AS procedure_count
      FROM supply.kit_items ki
      JOIN supply.kit_templates kt
        ON  kt.id        = ki.kit_template_id
        AND kt.is_active = TRUE
        AND kt.clinic_id = $1
      JOIN shared.appointments a
        ON  a.service_id    = kt.service_id
        AND a.clinic_id     = $1
        AND a.scheduled_at  BETWEEN NOW() AND NOW() + INTERVAL '7 days'
        AND a.status        IN ('scheduled', 'confirmed')
      GROUP BY ki.product_id
    ),
    results AS (
      SELECT
        s.id                                                              AS product_id,
        s.name                                                            AS product_name,
        s.sku,
        s.unit,
        s.qty_atual::DECIMAL,
        s.reorder_point::DECIMAL,
        GREATEST(
          COALESCE(s.max_stock, s.reorder_point * 2) - s.qty_atual, 0
        )::DECIMAL                                                        AS qty_sugerida,
        s.max_stock::DECIMAL,
        COALESCE(lo.supplier_id, s.preferred_supplier_id)                AS suggested_supplier_id,
        COALESCE(lo.supplier_name,
          (SELECT ps.name FROM preferred_suppliers ps WHERE ps.id = s.preferred_supplier_id)
        )                                                                 AS suggested_supplier_name,
        lo.last_unit_cost::DECIMAL,
        lo.last_order_date::TEXT,
        (ud.procedure_count IS NOT NULL AND ud.procedure_count > 0)      AS demanda_proxima,
        COALESCE(ud.procedure_count, 0)                                  AS procedure_count,
        CASE
          WHEN s.qty_atual = 0                THEN 'RUPTURA'
          WHEN s.qty_atual < s.min_stock      THEN 'CRITICO'
          ELSE                                     'ATENCAO'
        END                                                               AS stock_status
      FROM stock s
      LEFT JOIN last_orders lo    ON lo.product_id = s.id
      LEFT JOIN upcoming_demand ud ON ud.product_id = s.id
      WHERE TRUE ${supplierFilter}
    )
    SELECT *, COUNT(*) OVER () AS total_count
    FROM results
    ORDER BY
      CASE stock_status WHEN 'RUPTURA' THEN 0 WHEN 'CRITICO' THEN 1 ELSE 2 END,
      CASE WHEN demanda_proxima THEN 0 ELSE 1 END,
      product_name
    LIMIT $${params.push(input.limit)}
    OFFSET $${params.push(offset)}
  `;

  const result = await db.query<SuggestionRow & { total_count: string }>(sql, params);

  const total = result.rows[0] ? parseInt(result.rows[0].total_count, 10) : 0;

  const items: PurchaseSuggestion[] = result.rows.map((r) => ({
    productId:             r.product_id,
    productName:           r.product_name,
    sku:                   r.sku,
    unit:                  r.unit,
    qtyAtual:              parseFloat(r.qty_atual),
    reorderPoint:          parseFloat(r.reorder_point),
    qtySugerida:           parseFloat(r.qty_sugerida),
    maxStock:              r.max_stock ? parseFloat(r.max_stock) : null,
    suggestedSupplierId:   r.suggested_supplier_id,
    suggestedSupplierName: r.suggested_supplier_name,
    lastUnitCost:          r.last_unit_cost ? parseFloat(r.last_unit_cost) : null,
    lastOrderDate:         r.last_order_date,
    demandaProxima:        r.demanda_proxima,
    procedureCount:        parseInt(r.procedure_count, 10),
    stockStatus:           r.stock_status,
  }));

  return { items, total };
}
