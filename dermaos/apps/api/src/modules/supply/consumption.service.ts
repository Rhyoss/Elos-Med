import { TRPCError } from '@trpc/server';
import type { PoolClient } from 'pg';
import { withClinicContext, db } from '../../db/client.js';
import { emitToClinic } from '../../lib/socket.js';
import {
  lockLotOrThrow,
  lockLotsFefo,
  markLotConsumedIfEmpty,
  readProductTotal,
  type LockedLot,
} from './lots.service.js';
import type {
  ConsumeKitInput,
  ConsumeKitResult,
  ConsumeKitResultItem,
  ConsumptionSource,
  ConsumptionStatus,
  ListConsumptionsInput,
  StockConsumptionIncompletePayload,
} from '@dermaos/shared';

/* ══════════════════════════════════════════════════════════════════════════
 * Consumo por procedimento: atômico, idempotente, com suporte a parcial.
 * ══════════════════════════════════════════════════════════════════════════ */

export interface ConsumptionContext {
  clinicId:   string;
  userId:     string | null;
  ipOrigin:   string | null;
  source:     ConsumptionSource;
}

/**
 * Monta chave de idempotência canônica a partir do escopo do consumo.
 * Para encounter/session, usamos o ID como chave. Para manual, exige chave
 * fornecida pelo cliente. Para offline_sync, chave vem do dispositivo.
 */
export function buildConsumptionIdempotencyKey(args: {
  source:             ConsumptionSource;
  encounterId?:       string | null;
  protocolSessionId?: string | null;
  clientKey?:         string | null;
}): string {
  if (args.encounterId)       return `encounter:${args.encounterId}`;
  if (args.protocolSessionId) return `session:${args.protocolSessionId}`;
  if (args.clientKey)         return `${args.source}:${args.clientKey}`;
  throw new Error('buildConsumptionIdempotencyKey: escopo insuficiente');
}

/* ── Entrypoint: consumeKit ──────────────────────────────────────────────── */

export async function consumeKit(
  input: ConsumeKitInput,
  ctx:   ConsumptionContext,
): Promise<ConsumeKitResult> {
  // Idempotência: se já existe um log com a mesma chave, retornamos o estado
  // anterior sem executar nada (no-op).
  const existing = await findExistingConsumption(ctx.clinicId, input.idempotencyKey);
  if (existing) {
    return existing;
  }

  return withClinicContext(ctx.clinicId, async (client) => {
    // Re-check dentro da transação (com lock do kit) — evita race entre
    // dois eventos concorrentes para o mesmo encounter_id.
    const dupCheck = await client.query<{ id: string }>(
      `SELECT id FROM supply.procedure_consumption_log
        WHERE clinic_id = $1 AND idempotency_key = $2
          FOR UPDATE`,
      [ctx.clinicId, input.idempotencyKey],
    );
    if (dupCheck.rows[0]) {
      // Outra transação concluiu o consumo primeiro — devolve estado atual.
      throw new TRPCError({
        code:    'CONFLICT',
        message: 'Consumo já processado em paralelo. Recarregue para ver o resultado.',
      });
    }

    // Carrega kit + itens (lock para evitar mudança durante consumo)
    const kitR = await client.query<{
      id: string; name: string; version: number; status: string;
    }>(
      `SELECT id, name, version, status
         FROM supply.kit_templates
        WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL
          FOR SHARE`,
      [input.kitId, ctx.clinicId],
    );
    if (!kitR.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Kit não encontrado.' });
    }
    const kit = kitR.rows[0];
    if (kit.status === 'archived') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Kit arquivado não pode ser consumido.' });
    }

    const items = await client.query<{
      product_id: string; product_name: string; product_unit: string;
      quantity: number; is_optional: boolean;
    }>(
      `SELECT ki.product_id, p.name AS product_name, p.unit AS product_unit,
              ki.quantity, ki.is_optional
         FROM supply.kit_items ki
         JOIN supply.products p ON p.id = ki.product_id
        WHERE ki.kit_template_id = $1 AND ki.clinic_id = $2
        ORDER BY ki.display_order ASC, p.name ASC`,
      [kit.id, ctx.clinicId],
    );

    // Mapa de overrides por productId para acesso rápido
    const overrides = new Map<string, { lotId: string | null; skipped: boolean; quantity: number | undefined }>();
    for (const o of input.overrides) {
      overrides.set(o.productId, {
        lotId:    o.lotId ?? null,
        skipped:  !!o.skipped,
        quantity: o.quantity ?? undefined,
      });
    }

    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const resultItems: ConsumeKitResultItem[] = [];
    const missingForAlert: StockConsumptionIncompletePayload['missingItems'] = [];
    const pendingInserts: Array<{ productId: string; qtyMissing: number; qtyRequired: number }> = [];
    const tracesToInsert: Array<{
      productId: string; lotId: string; quantity: number;
    }> = [];
    let itemsConsumed = 0;
    let itemsPending  = 0;

    for (const it of items.rows) {
      const ov = overrides.get(it.product_id);
      const qtyRequired = Number(ov?.quantity ?? it.quantity);

      if (ov?.skipped) {
        if (!it.is_optional) {
          throw new TRPCError({
            code:    'BAD_REQUEST',
            message: `Item obrigatório "${it.product_name}" não pode ser marcado como não utilizado.`,
          });
        }
        resultItems.push({
          productId:        it.product_id,
          productName:      it.product_name,
          quantityConsumed: 0,
          quantityMissing:  0,
          skipped:          true,
          lots:             [],
        });
        continue;
      }

      // Plano de consumo: override de lote ou FEFO multi-lote.
      let plan: Array<{ lot: LockedLot; take: number }> = [];
      let shortage = 0;

      if (ov?.lotId) {
        const lot = await lockLotOrThrow(client, ov.lotId, ctx.clinicId);
        if (lot.product_id !== it.product_id) {
          throw new TRPCError({
            code:    'BAD_REQUEST',
            message: `Lote informado não pertence ao produto "${it.product_name}".`,
          });
        }
        if (lot.status !== 'active') {
          throw new TRPCError({
            code:    'PRECONDITION_FAILED',
            message: `Lote "${lot.lot_number}" não está ativo (${lot.status}).`,
          });
        }
        const available = Number(lot.quantity_current);
        const take      = Math.min(available, qtyRequired);
        if (take > 0) plan = [{ lot, take }];
        shortage = qtyRequired - take;
      } else {
        try {
          plan = await lockLotsFefo(client, ctx.clinicId, it.product_id, qtyRequired);
        } catch {
          // Insuficiente: retornamos plano parcial (o que conseguir) manualmente.
          const rows = await client.query<LockedLot>(
            `SELECT id, clinic_id, product_id, storage_location_id,
                    lot_number, batch_number, expiry_date, manufactured_date,
                    quantity_current, unit_cost, status, received_at
               FROM supply.inventory_lots
              WHERE clinic_id = $1 AND product_id = $2
                AND status = 'active' AND quantity_current > 0
              ORDER BY expiry_date ASC NULLS LAST, received_at ASC
                FOR UPDATE`,
            [ctx.clinicId, it.product_id],
          );
          let remaining = qtyRequired;
          for (const lot of rows.rows) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, Number(lot.quantity_current));
            plan.push({ lot, take });
            remaining -= take;
          }
          shortage = remaining;
        }
      }

      if (shortage > 0 && !input.allowPartial) {
        throw new TRPCError({
          code:    'PRECONDITION_FAILED',
          message: `Saldo insuficiente para "${it.product_name}". Faltam ${shortage} ${it.product_unit}.`,
        });
      }

      // Aplica o plano: decrementa lotes + prepara traces + movimentação
      const lotsConsumed: ConsumeKitResultItem['lots'] = [];
      let consumedQty = 0;
      for (const { lot, take } of plan) {
        if (take <= 0) continue;
        const qtyBefore = await readProductTotal(client, ctx.clinicId, it.product_id);
        await client.query(
          `UPDATE supply.inventory_lots
              SET quantity_current = quantity_current - $2, updated_at = NOW()
            WHERE id = $1`,
          [lot.id, take],
        );
        await markLotConsumedIfEmpty(client, lot.id);

        const qtyAfter = qtyBefore - take;

        await client.query(
          `INSERT INTO supply.inventory_movements
             (clinic_id, product_id, lot_id,
              type, reason, reference_type, reference_id,
              quantity, quantity_before, quantity_after, unit_cost,
              from_storage_location_id, encounter_id,
              notes, performed_by, ip_origin)
           VALUES ($1, $2, $3,
                   'saida'::supply.movement_type,
                   'procedimento'::supply.movement_reason,
                   CASE WHEN $4::uuid IS NOT NULL THEN 'appointment'::supply.movement_reference_type
                        WHEN $5::uuid IS NOT NULL THEN 'protocol_session'::supply.movement_reference_type
                        ELSE 'manual'::supply.movement_reference_type END,
                   COALESCE($4, $5),
                   $6, $7, $8, $9,
                   $10, $4,
                   $11, $12, $13::inet)`,
          [
            ctx.clinicId, it.product_id, lot.id,
            input.encounterId ?? null, input.protocolSessionId ?? null,
            take, qtyBefore, qtyAfter, lot.unit_cost ?? null,
            lot.storage_location_id ?? null,
            input.notes ?? null, ctx.userId, ctx.ipOrigin,
          ],
        );

        tracesToInsert.push({ productId: it.product_id, lotId: lot.id, quantity: take });
        lotsConsumed.push({ lotId: lot.id, lotNumber: lot.lot_number, quantity: take });
        consumedQty += take;
      }

      if (consumedQty > 0) itemsConsumed += 1;

      if (shortage > 0) {
        if (!it.is_optional) {
          itemsPending += 1;
          missingForAlert.push({
            productId:       it.product_id,
            productName:     it.product_name,
            quantityMissing: shortage,
          });
        }
        pendingInserts.push({
          productId:    it.product_id,
          qtyMissing:   shortage,
          qtyRequired,
        });
      }

      resultItems.push({
        productId:        it.product_id,
        productName:      it.product_name,
        quantityConsumed: consumedQty,
        quantityMissing:  shortage,
        skipped:          false,
        lots:             lotsConsumed,
      });
    }

    // Status final do consumo
    let status: ConsumptionStatus;
    if (itemsPending > 0)      status = 'partial';
    else if (itemsConsumed > 0) status = 'completed';
    else                        status = 'skipped';

    // Grava log (idempotency_key é UNIQUE → CONFLICT cai aqui e aborta tx)
    const logR = await client.query<{ id: string }>(
      `INSERT INTO supply.procedure_consumption_log
         (clinic_id, encounter_id, protocol_session_id, kit_template_id,
          source, status, items_consumed, items_pending,
          performed_by, performed_at, idempotency_key, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        ctx.clinicId,
        input.encounterId ?? null, input.protocolSessionId ?? null, kit.id,
        ctx.source, status, itemsConsumed, itemsPending,
        ctx.userId, occurredAt, input.idempotencyKey, input.notes ?? null,
      ],
    );
    const logId = logR.rows[0]!.id;

    // Grava traces
    for (const t of tracesToInsert) {
      await client.query(
        `INSERT INTO supply.patient_lot_traces
           (clinic_id, patient_id, lot_id, product_id, kit_template_id,
            encounter_id, protocol_session_id,
            quantity_used, applied_by, applied_at, ip_origin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::inet)`,
        [
          ctx.clinicId, input.patientId, t.lotId, t.productId, kit.id,
          input.encounterId ?? null, input.protocolSessionId ?? null,
          t.quantity, ctx.userId, occurredAt, ctx.ipOrigin,
        ],
      );
    }

    // Grava pending_items
    for (const pi of pendingInserts) {
      await client.query(
        `INSERT INTO supply.consumption_pending_items
           (clinic_id, consumption_log_id, product_id, quantity_missing, quantity_required)
         VALUES ($1, $2, $3, $4, $5)`,
        [ctx.clinicId, logId, pi.productId, pi.qtyMissing, pi.qtyRequired],
      );
    }

    // Audit
    await writeAudit(ctx.clinicId, logId, 'consumption.recorded', ctx.userId, {
      kitId: kit.id, kitName: kit.name, patientId: input.patientId,
      encounterId: input.encounterId ?? null, status,
      itemsConsumed, itemsPending, source: ctx.source,
      idempotencyKey: input.idempotencyKey,
    });

    // Eventos realtime
    emitToClinic(ctx.clinicId, 'supply.consumption_recorded', {
      consumptionLogId: logId, kitId: kit.id, status,
      patientId: input.patientId, encounterId: input.encounterId ?? null,
    });

    if (missingForAlert.length > 0) {
      const incomplete: StockConsumptionIncompletePayload = {
        kitId:        kit.id,
        kitName:      kit.name,
        encounterId:  input.encounterId ?? null,
        patientId:    input.patientId,
        missingItems: missingForAlert,
      };
      emitToClinic(ctx.clinicId, 'stock.consumption_incomplete', incomplete as unknown as Record<string, unknown>);
    }

    return {
      consumptionLogId: logId,
      kitId:            kit.id,
      status,
      itemsConsumed,
      itemsPending,
      items:            resultItems,
      alreadyProcessed: false,
    };
  });
}

async function findExistingConsumption(
  clinicId:       string,
  idempotencyKey: string,
): Promise<ConsumeKitResult | null> {
  return withClinicContext(clinicId, async (client) => {
    const logR = await client.query<{
      id: string; kit_template_id: string | null; status: ConsumptionStatus;
      items_consumed: number; items_pending: number;
    }>(
      `SELECT id, kit_template_id, status, items_consumed, items_pending
         FROM supply.procedure_consumption_log
        WHERE clinic_id = $1 AND idempotency_key = $2
        LIMIT 1`,
      [clinicId, idempotencyKey],
    );
    if (!logR.rows[0]) return null;
    const log = logR.rows[0];

    const traces = await client.query<{
      product_id: string; lot_id: string; lot_number: string;
      quantity_used: number; product_name: string;
    }>(
      `SELECT plt.product_id, plt.lot_id, il.lot_number, plt.quantity_used, p.name AS product_name
         FROM supply.patient_lot_traces plt
         JOIN supply.inventory_lots il ON il.id = plt.lot_id
         JOIN supply.products p        ON p.id  = plt.product_id
        WHERE plt.clinic_id = $1
          AND (plt.encounter_id, plt.applied_at) IN (
            SELECT pcl.encounter_id, pcl.performed_at
              FROM supply.procedure_consumption_log pcl
             WHERE pcl.id = $2
          )`,
      [clinicId, log.id],
    );

    const byProduct = new Map<string, ConsumeKitResultItem>();
    for (const tr of traces.rows) {
      const cur = byProduct.get(tr.product_id) ?? {
        productId:        tr.product_id,
        productName:      tr.product_name,
        quantityConsumed: 0,
        quantityMissing:  0,
        skipped:          false,
        lots:             [],
      };
      cur.quantityConsumed += Number(tr.quantity_used);
      cur.lots.push({ lotId: tr.lot_id, lotNumber: tr.lot_number, quantity: Number(tr.quantity_used) });
      byProduct.set(tr.product_id, cur);
    }

    return {
      consumptionLogId: log.id,
      kitId:            log.kit_template_id ?? '',
      status:           log.status,
      itemsConsumed:    log.items_consumed,
      itemsPending:     log.items_pending,
      items:            Array.from(byProduct.values()),
      alreadyProcessed: true,
    };
  });
}

/* ── Histórico de consumos ───────────────────────────────────────────────── */

export async function listConsumptions(
  input:    ListConsumptionsInput,
  clinicId: string,
) {
  return withClinicContext(clinicId, async (client) => {
    const conds: string[] = ['pcl.clinic_id = $1'];
    const params: unknown[] = [clinicId];
    let p = 2;

    if (input.patientId) {
      conds.push(`EXISTS (
        SELECT 1 FROM supply.patient_lot_traces plt
         WHERE plt.patient_id = $${p}
           AND (plt.encounter_id = pcl.encounter_id OR plt.protocol_session_id = pcl.protocol_session_id)
      )`);
      params.push(input.patientId);
      p += 1;
    }
    if (input.kitId) {
      conds.push(`pcl.kit_template_id = $${p++}`);
      params.push(input.kitId);
    }
    if (input.status) {
      conds.push(`pcl.status = $${p++}`);
      params.push(input.status);
    }
    if (input.encounterId) {
      conds.push(`pcl.encounter_id = $${p++}`);
      params.push(input.encounterId);
    }
    if (input.from) {
      conds.push(`pcl.performed_at >= $${p++}`);
      params.push(input.from);
    }
    if (input.to) {
      conds.push(`pcl.performed_at <= $${p++}`);
      params.push(input.to);
    }

    const where   = conds.join(' AND ');
    const offset  = (input.page - 1) * input.limit;

    const [rows, count] = await Promise.all([
      client.query(
        `SELECT pcl.id, pcl.encounter_id, pcl.protocol_session_id, pcl.kit_template_id,
                kt.name AS kit_name, pcl.status,
                pcl.items_consumed, pcl.items_pending, pcl.source,
                pcl.performed_at, pcl.performed_by, pcl.notes
           FROM supply.procedure_consumption_log pcl
      LEFT JOIN supply.kit_templates kt ON kt.id = pcl.kit_template_id
          WHERE ${where}
          ORDER BY pcl.performed_at DESC
          LIMIT $${p} OFFSET $${p + 1}`,
        [...params, input.limit, offset],
      ),
      client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM supply.procedure_consumption_log pcl WHERE ${where}`,
        params,
      ),
    ]);

    return {
      data:  rows.rows,
      total: parseInt(count.rows[0]?.count ?? '0', 10),
    };
  });
}

/* ── Audit ──────────────────────────────────────────────────────────────── */

async function writeAudit(
  clinicId: string, aggregateId: string, eventType: string,
  userId: string | null, payload: Record<string, unknown>,
): Promise<void> {
  await db.query(
    `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
     VALUES ($1, 'supply_consumption', $2, $3, $4, $5)`,
    [
      clinicId, aggregateId, eventType,
      JSON.stringify(payload),
      JSON.stringify({ user_id: userId }),
    ],
  );
}
