import { TRPCError } from '@trpc/server';
import type { PoolClient } from 'pg';
import { withClinicContext, db } from '../../db/client.js';
import { emitToClinic } from '../../lib/socket.js';
import type {
  ListLotsInput,
  ChangeLotStatusInput,
  QuarantineLotInput,
  FefoSuggestionInput,
  FefoSuggestionResult,
  LotStatus,
  ExpiryAlertLevel,
} from '@dermaos/shared';

export interface GlobalLotRow {
  id:                    string;
  clinic_id:             string;
  product_id:            string;
  product_name:          string;
  product_sku:           string | null;
  product_unit:          string;
  storage_location_id:   string | null;
  storage_location_name: string | null;
  lot_number:            string;
  batch_number:          string | null;
  expiry_date:           string | null;
  manufactured_date:     string | null;
  quantity_initial:      number;
  quantity_current:      number;
  unit_cost:             number | null;
  status:                LotStatus;
  expiry_alert_level:    ExpiryAlertLevel;
  days_to_expiry:        number | null;
  is_quarantined:        boolean;
  quarantine_reason:     string | null;
  received_at:           string;
  last_alert_check_at:   string | null;
}

/* ── Listagem global de lotes (com filtros) ──────────────────────────────── */

export async function listLotsGlobal(
  input:    ListLotsInput,
  clinicId: string,
): Promise<{ data: GlobalLotRow[]; total: number }> {
  return withClinicContext(clinicId, async (client) => {
    const conditions: string[] = ['il.clinic_id = $1', 'il.deleted_at IS NULL'];
    const params: unknown[] = [clinicId];
    let p = 2;

    if (input.productId) {
      conditions.push(`il.product_id = $${p++}`);
      params.push(input.productId);
    }
    if (input.categoryId) {
      conditions.push(`p.category_id = $${p++}`);
      params.push(input.categoryId);
    }
    if (input.storageLocationId) {
      conditions.push(`il.storage_location_id = $${p++}`);
      params.push(input.storageLocationId);
    }
    if (input.statuses && input.statuses.length > 0) {
      conditions.push(`il.status = ANY($${p++}::supply.lot_status[])`);
      params.push(input.statuses);
    } else if (!input.includeConsumed) {
      // Por padrão oculta consumidos para não poluir a lista operacional
      conditions.push(`il.status <> 'consumed'`);
    }
    if (input.alertLevel) {
      conditions.push(`il.expiry_alert_level = $${p++}`);
      params.push(input.alertLevel);
    }
    if (input.search && input.search.trim().length >= 2) {
      const term = `%${input.search.trim()}%`;
      conditions.push(`(il.lot_number ILIKE $${p} OR p.name ILIKE $${p})`);
      params.push(term);
      p += 1;
    }

    const where  = conditions.join(' AND ');
    const offset = (input.page - 1) * input.limit;

    const baseQuery = `
        FROM supply.inventory_lots il
        JOIN supply.products p ON p.id = il.product_id AND p.deleted_at IS NULL
   LEFT JOIN supply.storage_locations sl ON sl.id = il.storage_location_id
       WHERE ${where}`;

    const [rows, countResult] = await Promise.all([
      client.query<GlobalLotRow>(
        `SELECT il.id, il.clinic_id, il.product_id,
                p.name AS product_name, p.sku AS product_sku, p.unit AS product_unit,
                il.storage_location_id, sl.name AS storage_location_name,
                il.lot_number, il.batch_number, il.expiry_date, il.manufactured_date,
                il.quantity_initial, il.quantity_current, il.unit_cost,
                il.status, il.expiry_alert_level, il.days_to_expiry,
                il.is_quarantined, il.quarantine_reason,
                il.received_at, il.last_alert_check_at
           ${baseQuery}
        ORDER BY il.expiry_date ASC NULLS LAST, il.received_at ASC
        LIMIT $${p} OFFSET $${p + 1}`,
        [...params, input.limit, offset],
      ),
      client.query<{ count: string }>(
        `SELECT COUNT(*) AS count ${baseQuery}`,
        params,
      ),
    ]);

    return {
      data:  rows.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0', 10),
    };
  });
}

/* ── Mudança de status de lote (auditável + justificativa) ───────────────── */

export async function changeLotStatus(
  input:    ChangeLotStatusInput,
  clinicId: string,
  userId:   string,
): Promise<{ id: string; status: LotStatus }> {
  return withClinicContext(clinicId, async (client) => {
    const lot = await lockLotOrThrow(client, input.lotId, clinicId);

    if (lot.status === input.status) {
      throw new TRPCError({
        code:    'BAD_REQUEST',
        message: `Lote já está com status "${input.status}". Nenhuma alteração aplicada.`,
      });
    }

    // Regras simples de transição:
    //  - 'consumed' só faz sentido quando quantity_current = 0.
    //  - 'expired' pode ser forçado quando expiry_date já passou.
    if (input.status === 'consumed' && Number(lot.quantity_current) > 0) {
      throw new TRPCError({
        code:    'BAD_REQUEST',
        message: `Lote com saldo ${lot.quantity_current} não pode ser marcado como consumido. Registre uma saída antes.`,
      });
    }

    await client.query(
      `UPDATE supply.inventory_lots
          SET status            = $3,
              is_quarantined    = ($3 = 'quarantined'),
              quarantine_reason = CASE WHEN $3 = 'quarantined' THEN $4 ELSE NULL END,
              updated_at        = NOW()
        WHERE id = $1 AND clinic_id = $2`,
      [input.lotId, clinicId, input.status, input.justification],
    );

    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'supply_lot', $2, 'supply_lot.status_changed', $3, $4)`,
      [
        clinicId, input.lotId,
        JSON.stringify({
          from_status: lot.status, to_status: input.status,
          justification: input.justification, product_id: lot.product_id,
        }),
        JSON.stringify({ user_id: userId }),
      ],
    );

    emitToClinic(clinicId, 'stock.lot_status_changed', {
      lotId:     input.lotId,
      productId: lot.product_id,
      fromStatus: lot.status,
      toStatus:  input.status,
    });

    return { id: input.lotId, status: input.status };
  });
}

/* ── Quarentena (atalho de changeLotStatus com motivo) ──────────────────── */

export async function quarantineLot(
  input:    QuarantineLotInput,
  clinicId: string,
  userId:   string,
): Promise<{ id: string; status: LotStatus }> {
  return changeLotStatus(
    { lotId: input.lotId, status: 'quarantined', justification: input.reason },
    clinicId,
    userId,
  );
}

/* ── Sugestão FEFO para saída ────────────────────────────────────────────── */

export async function fefoSuggest(
  input:    FefoSuggestionInput,
  clinicId: string,
): Promise<FefoSuggestionResult> {
  return withClinicContext(clinicId, async (client) => {
    const rows = await client.query<{
      lot_id:             string | null;
      lot_number:         string | null;
      expiry_date:        string | null;
      quantity_available: string;
      quantity_from_lot:  string;
      is_insufficient:    boolean;
    }>(
      `SELECT * FROM supply.select_lot_fefo($1, $2, $3)`,
      [clinicId, input.productId, input.quantity],
    );

    const available = !rows.rows.some((r) => r.is_insufficient);
    const lots = rows.rows
      .filter((r) => !r.is_insufficient && r.lot_id !== null)
      .map((r) => ({
        lotId:             r.lot_id!,
        lotNumber:         r.lot_number!,
        expiryDate:        r.expiry_date,
        quantityAvailable: Number(r.quantity_available),
        quantityFromLot:   Number(r.quantity_from_lot),
      }));
    const totalAvailable = lots.reduce((s, l) => s + l.quantityFromLot, 0)
      + (available ? 0 : 0); // placeholder — quando insuficiente calculamos abaixo

    // Quando insuficiente, select_lot_fefo devolveu linha-sentinela com
    // quantity_available = quantidade que AINDA FALTAVA. O total REAL
    // disponível no estoque = requested - shortage.
    const shortageRow = rows.rows.find((r) => r.is_insufficient);
    const shortage    = shortageRow ? Number(shortageRow.quantity_available) : 0;
    const requested   = input.quantity;

    return {
      available,
      totalAvailable: requested - shortage,
      requested,
      shortage,
      lots,
    };
  });
}

/* ── Helpers internos ────────────────────────────────────────────────────── */

export interface LockedLot {
  id:                  string;
  clinic_id:           string;
  product_id:          string;
  storage_location_id: string | null;
  lot_number:          string;
  batch_number:        string | null;
  expiry_date:         string | null;
  manufactured_date:   string | null;
  quantity_current:    number;
  unit_cost:           number | null;
  status:              LotStatus;
  received_at:         string;
}

/**
 * Trava um lote específico com SELECT ... FOR UPDATE. Garante que nenhuma
 * outra transação pode alterar o lote enquanto esta transação está ativa.
 * Lança NOT_FOUND se o lote não existir na clínica.
 */
export async function lockLotOrThrow(
  client:   PoolClient,
  lotId:    string,
  clinicId: string,
): Promise<LockedLot> {
  const r = await client.query<LockedLot>(
    `SELECT id, clinic_id, product_id, storage_location_id,
            lot_number, batch_number, expiry_date, manufactured_date,
            quantity_current, unit_cost, status, received_at
       FROM supply.inventory_lots
      WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL
        FOR UPDATE`,
    [lotId, clinicId],
  );
  if (!r.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Lote não encontrado.' });
  }
  return r.rows[0];
}

/**
 * Seleciona e trava lotes em ordem FEFO para consumir `qty` unidades.
 * Retorna o plano de decomposição: lista de { lot, take }. Lança
 * PRECONDITION_FAILED se o saldo total for insuficiente.
 *
 * Os lotes permanecem travados até o COMMIT/ROLLBACK da transação.
 */
export async function lockLotsFefo(
  client:    PoolClient,
  clinicId:  string,
  productId: string,
  qty:       number,
): Promise<Array<{ lot: LockedLot; take: number }>> {
  // FOR UPDATE impede qualquer outra tx de decrementar enquanto calculamos.
  const rows = await client.query<LockedLot>(
    `SELECT id, clinic_id, product_id, storage_location_id,
            lot_number, batch_number, expiry_date, manufactured_date,
            quantity_current, unit_cost, status, received_at
       FROM supply.inventory_lots
      WHERE clinic_id = $1 AND product_id = $2
        AND status = 'active' AND quantity_current > 0
      ORDER BY expiry_date ASC NULLS LAST, received_at ASC
        FOR UPDATE`,
    [clinicId, productId],
  );

  const plan: Array<{ lot: LockedLot; take: number }> = [];
  let remaining = qty;
  for (const lot of rows.rows) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(lot.quantity_current));
    plan.push({ lot, take });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Saldo insuficiente para atender a saída. Faltam ${remaining} unidade(s).`,
    });
  }

  return plan;
}

/**
 * Consulta a quantidade total ativa do produto (somente lotes active).
 * Usada para preencher quantity_before/quantity_after nas movimentações.
 */
export async function readProductTotal(
  client:    PoolClient,
  clinicId:  string,
  productId: string,
): Promise<number> {
  const r = await client.query<{ qty: string }>(
    `SELECT COALESCE(SUM(quantity_current), 0)::numeric AS qty
       FROM supply.inventory_lots
      WHERE clinic_id = $1 AND product_id = $2
        AND status = 'active' AND deleted_at IS NULL`,
    [clinicId, productId],
  );
  return Number(r.rows[0]?.qty ?? 0);
}

/**
 * Marca o lote como `consumed` quando seu saldo chega a zero. Idempotente.
 */
export async function markLotConsumedIfEmpty(
  client: PoolClient,
  lotId:  string,
): Promise<void> {
  await client.query(
    `UPDATE supply.inventory_lots
        SET status = 'consumed', updated_at = NOW()
      WHERE id = $1 AND quantity_current = 0 AND status = 'active'`,
    [lotId],
  );
}
