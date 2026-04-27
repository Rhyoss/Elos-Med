import { TRPCError } from '@trpc/server';
import { randomUUID } from 'node:crypto';
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
  RegisterMovementInput,
  EntryMovementInput,
  ExitMovementInput,
  AdjustMovementInput,
  TransferMovementInput,
  MovementType,
  MovementReason,
} from '@dermaos/shared';

export interface MovementResult {
  movementIds:    string[];
  transferPairId: string | null;
  productId:      string;
  quantityBefore: number;
  quantityAfter:  number;
}

export interface MovementContext {
  clinicId: string;
  userId:   string;
  ipOrigin: string | null;
}

/* ── Entrypoint: registerMovement (dispatch por tipo) ─────────────────────── */

export async function registerMovement(
  input: RegisterMovementInput,
  ctx:   MovementContext,
): Promise<MovementResult> {
  switch (input.type) {
    case 'entrada':       return handleEntry(input, ctx);
    case 'saida':         return handleExit(input, ctx);
    case 'ajuste':        return handleAdjust(input, ctx);
    case 'transferencia': return handleTransfer(input, ctx);
  }
}

/* ── Validação helpers ───────────────────────────────────────────────────── */

async function assertProductExists(
  client: PoolClient, productId: string, clinicId: string,
): Promise<{ id: string; name: string }> {
  const r = await client.query<{ id: string; name: string }>(
    `SELECT id, name FROM supply.products
      WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL
      LIMIT 1`,
    [productId, clinicId],
  );
  if (!r.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Produto não encontrado.' });
  }
  return r.rows[0];
}

async function assertStorageLocation(
  client: PoolClient, locationId: string, clinicId: string, label: string,
): Promise<void> {
  const r = await client.query<{ id: string }>(
    `SELECT id FROM supply.storage_locations
      WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL
      LIMIT 1`,
    [locationId, clinicId],
  );
  if (!r.rows[0]) {
    throw new TRPCError({
      code:    'NOT_FOUND',
      message: `Local de armazenamento (${label}) não encontrado.`,
    });
  }
}

/* ── Entrada (cria ou reaproveita lote) ──────────────────────────────────── */

async function handleEntry(
  input: EntryMovementInput,
  ctx:   MovementContext,
): Promise<MovementResult> {
  return withClinicContext(ctx.clinicId, async (client) => {
    await assertProductExists(client, input.productId, ctx.clinicId);
    if (input.storageLocationId) {
      await assertStorageLocation(client, input.storageLocationId, ctx.clinicId, 'destino');
    }

    // Lê total ativo ANTES de qualquer mutação (para quantity_before na movimentação).
    const qtyBefore = await readProductTotal(client, ctx.clinicId, input.productId);

    // Se lote já existe (uq: clinic_id + product_id + lot_number), reaproveita;
    // caso contrário, cria novo. Campos de data/custo do lote existente não são
    // sobrescritos; somam-se apenas as quantidades.
    const existing = await client.query<{
      id: string; expiry_date: string | null; status: string;
    }>(
      `SELECT id, expiry_date, status FROM supply.inventory_lots
        WHERE clinic_id = $1 AND product_id = $2 AND lot_number = $3
          AND deleted_at IS NULL
        FOR UPDATE`,
      [ctx.clinicId, input.productId, input.lotNumber],
    );

    let lotId: string;
    if (existing.rows[0]) {
      const row = existing.rows[0];
      // Entrada em lote quarentenado/vencido é bloqueada — opere via changeLotStatus antes.
      if (row.status === 'quarantined' || row.status === 'expired') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Lote "${input.lotNumber}" está com status "${row.status}". Altere o status para "active" antes de registrar entrada.`,
        });
      }
      const isExpired = row.expiry_date
        && new Date(row.expiry_date) < new Date(new Date().toDateString());
      if (isExpired && !input.acceptExpired) {
        throw new TRPCError({
          code:    'PRECONDITION_FAILED',
          message: 'Lote existente está vencido. Para aceitar a entrada, marque "aceitar vencido".',
        });
      }
      lotId = row.id;
      await client.query(
        `UPDATE supply.inventory_lots
            SET quantity_initial = quantity_initial + $2,
                quantity_current = quantity_current + $2,
                status           = CASE WHEN status = 'consumed' THEN 'active'::supply.lot_status
                                        ELSE status END,
                updated_at       = NOW()
          WHERE id = $1`,
        [lotId, input.quantity],
      );
    } else {
      // Lote novo — bloqueia vencido sem acceptExpired
      if (input.expiryDate) {
        const expired = new Date(input.expiryDate) < new Date(new Date().toDateString());
        if (expired && !input.acceptExpired) {
          throw new TRPCError({
            code:    'PRECONDITION_FAILED',
            message: 'Data de validade informada já passou. Use "aceitar vencido" com justificativa.',
          });
        }
      }
      const r = await client.query<{ id: string }>(
        `INSERT INTO supply.inventory_lots
           (clinic_id, product_id, storage_location_id, lot_number, batch_number,
            expiry_date, manufactured_date,
            quantity_initial, quantity_current, unit_cost)
         VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8, $8, $9)
         RETURNING id`,
        [
          ctx.clinicId, input.productId, input.storageLocationId ?? null,
          input.lotNumber, input.batchNumber ?? null,
          input.expiryDate ?? null, input.manufacturedDate ?? null,
          input.quantity, input.unitCost,
        ],
      );
      lotId = r.rows[0]!.id;
    }

    const qtyAfter = qtyBefore + input.quantity;

    const movementId = await insertMovement(client, {
      clinicId:    ctx.clinicId,
      productId:   input.productId,
      lotId,
      type:        'entrada',
      reason:      input.reason,
      quantity:    input.quantity,
      qtyBefore,
      qtyAfter,
      unitCost:    input.unitCost,
      toLocation:  input.storageLocationId ?? null,
      notes:       input.notes ?? null,
      performedBy: ctx.userId,
      ipOrigin:    ctx.ipOrigin,
      acceptExpired: input.acceptExpired,
      justification: input.acceptExpired ? (input.acceptExpiredReason ?? null) : null,
    });

    await writeAudit(ctx, 'supply_stock.entry', input.productId, {
      movementId, lotId, quantity: input.quantity, reason: input.reason,
      acceptExpired: input.acceptExpired,
    });

    emitToClinic(ctx.clinicId, 'stock.entry', {
      productId: input.productId, lotId, quantity: input.quantity,
      reason: input.reason, qtyAfter,
    });

    return {
      movementIds:   [movementId],
      transferPairId: null,
      productId:     input.productId,
      quantityBefore: qtyBefore,
      quantityAfter:  qtyAfter,
    };
  });
}

/* ── Saída (por lote ou FEFO multi-lote) ─────────────────────────────────── */

async function handleExit(
  input: ExitMovementInput,
  ctx:   MovementContext,
): Promise<MovementResult> {
  return withClinicContext(ctx.clinicId, async (client) => {
    await assertProductExists(client, input.productId, ctx.clinicId);

    const qtyBefore = await readProductTotal(client, ctx.clinicId, input.productId);
    if (qtyBefore < input.quantity) {
      throw new TRPCError({
        code:    'PRECONDITION_FAILED',
        message: `Saldo insuficiente. Disponível: ${qtyBefore}, solicitado: ${input.quantity}.`,
      });
    }

    // Monta o plano de consumo: ou um único lote fixado, ou FEFO multi-lote.
    const plan: Array<{ lot: LockedLot; take: number }> = input.lotId
      ? await planFromSingleLot(client, input.lotId, ctx.clinicId, input.productId, input.quantity)
      : await lockLotsFefo(client, ctx.clinicId, input.productId, input.quantity);

    const movementIds: string[] = [];
    let qtyRunning = qtyBefore;

    for (const { lot, take } of plan) {
      await client.query(
        `UPDATE supply.inventory_lots
            SET quantity_current = quantity_current - $2,
                updated_at       = NOW()
          WHERE id = $1`,
        [lot.id, take],
      );
      await markLotConsumedIfEmpty(client, lot.id);

      const thisBefore = qtyRunning;
      const thisAfter  = qtyRunning - take;
      qtyRunning       = thisAfter;

      const id = await insertMovement(client, {
        clinicId:    ctx.clinicId,
        productId:   input.productId,
        lotId:       lot.id,
        type:        'saida',
        reason:      input.reason,
        quantity:    take,
        qtyBefore:   thisBefore,
        qtyAfter:    thisAfter,
        unitCost:    lot.unit_cost,
        fromLocation: lot.storage_location_id,
        toLocation:  null,
        encounterId: input.encounterId ?? null,
        invoiceId:   input.invoiceId ?? null,
        notes:       input.notes ?? null,
        justification: input.justification ?? null,
        performedBy: ctx.userId,
        ipOrigin:    ctx.ipOrigin,
      });
      movementIds.push(id);
    }

    await writeAudit(ctx, 'supply_stock.exit', input.productId, {
      movementIds, totalQuantity: input.quantity, reason: input.reason,
      encounterId: input.encounterId ?? null, invoiceId: input.invoiceId ?? null,
    });

    emitToClinic(ctx.clinicId, 'stock.exit', {
      productId: input.productId, quantity: input.quantity,
      reason: input.reason, qtyAfter: qtyRunning, lotsAffected: plan.length,
    });

    return {
      movementIds,
      transferPairId: null,
      productId:      input.productId,
      quantityBefore: qtyBefore,
      quantityAfter:  qtyRunning,
    };
  });
}

async function planFromSingleLot(
  client:    PoolClient,
  lotId:     string,
  clinicId:  string,
  productId: string,
  qty:       number,
): Promise<Array<{ lot: LockedLot; take: number }>> {
  const lot = await lockLotOrThrow(client, lotId, clinicId);
  if (lot.product_id !== productId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Lote não pertence ao produto informado.' });
  }
  if (lot.status !== 'active') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Lote não está ativo (status: ${lot.status}).`,
    });
  }
  if (Number(lot.quantity_current) < qty) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Lote só tem ${lot.quantity_current} unidades; solicitado ${qty}.`,
    });
  }
  return [{ lot, take: qty }];
}

/* ── Ajuste (delta positivo ou negativo) ─────────────────────────────────── */

async function handleAdjust(
  input: AdjustMovementInput,
  ctx:   MovementContext,
): Promise<MovementResult> {
  return withClinicContext(ctx.clinicId, async (client) => {
    await assertProductExists(client, input.productId, ctx.clinicId);

    const qtyBefore = await readProductTotal(client, ctx.clinicId, input.productId);
    const delta     = input.delta;
    const qtyAfter  = qtyBefore + delta;

    if (qtyAfter < 0) {
      throw new TRPCError({
        code:    'BAD_REQUEST',
        message: `Ajuste resultaria em estoque negativo (${qtyAfter}).`,
      });
    }

    const movementIds: string[] = [];

    if (delta < 0) {
      // Deduz. Se lotId fornecido, deduz só desse lote; senão FEFO.
      const plan = input.lotId
        ? await planFromSingleLot(client, input.lotId, ctx.clinicId, input.productId, Math.abs(delta))
        : await lockLotsFefo(client, ctx.clinicId, input.productId, Math.abs(delta));

      let running = qtyBefore;
      for (const { lot, take } of plan) {
        await client.query(
          `UPDATE supply.inventory_lots
              SET quantity_current = quantity_current - $2, updated_at = NOW()
            WHERE id = $1`,
          [lot.id, take],
        );
        await markLotConsumedIfEmpty(client, lot.id);

        const id = await insertMovement(client, {
          clinicId: ctx.clinicId, productId: input.productId, lotId: lot.id,
          type: 'ajuste', reason: input.reason, quantity: take,
          qtyBefore: running, qtyAfter: running - take,
          justification: input.justification,
          notes: input.notes ?? null,
          performedBy: ctx.userId, ipOrigin: ctx.ipOrigin,
        });
        movementIds.push(id);
        running -= take;
      }
    } else {
      // Adiciona. Se lotId fornecido, aplica no lote; senão, procura lote ativo mais recente.
      let targetLotId: string;
      if (input.lotId) {
        const lot = await lockLotOrThrow(client, input.lotId, ctx.clinicId);
        if (lot.product_id !== input.productId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Lote não pertence ao produto.' });
        }
        targetLotId = lot.id;
        await client.query(
          `UPDATE supply.inventory_lots
              SET quantity_current = quantity_current + $2, updated_at = NOW()
            WHERE id = $1`,
          [lot.id, delta],
        );
      } else {
        const latest = await client.query<{ id: string }>(
          `SELECT id FROM supply.inventory_lots
            WHERE clinic_id = $1 AND product_id = $2
              AND status = 'active' AND deleted_at IS NULL
            ORDER BY received_at DESC
            LIMIT 1
              FOR UPDATE`,
          [ctx.clinicId, input.productId],
        );
        if (latest.rows[0]) {
          targetLotId = latest.rows[0].id;
          await client.query(
            `UPDATE supply.inventory_lots
                SET quantity_current = quantity_current + $2, updated_at = NOW()
              WHERE id = $1`,
            [targetLotId, delta],
          );
        } else {
          // Nenhum lote existente — cria um lote de ajuste.
          const r = await client.query<{ id: string }>(
            `INSERT INTO supply.inventory_lots
               (clinic_id, product_id, lot_number, quantity_initial, quantity_current, status)
             VALUES ($1, $2, $3, $4, $4, 'active')
             RETURNING id`,
            [ctx.clinicId, input.productId, `ADJ-${Date.now()}`, delta],
          );
          targetLotId = r.rows[0]!.id;
        }
      }

      const id = await insertMovement(client, {
        clinicId: ctx.clinicId, productId: input.productId, lotId: targetLotId,
        type: 'ajuste', reason: input.reason, quantity: delta,
        qtyBefore, qtyAfter,
        justification: input.justification,
        notes: input.notes ?? null,
        performedBy: ctx.userId, ipOrigin: ctx.ipOrigin,
      });
      movementIds.push(id);
    }

    await writeAudit(ctx, 'supply_stock.adjust', input.productId, {
      movementIds, delta, reason: input.reason, justification: input.justification,
    });

    emitToClinic(ctx.clinicId, 'stock.adjust', {
      productId: input.productId, delta, reason: input.reason, qtyAfter,
    });

    return {
      movementIds, transferPairId: null,
      productId: input.productId, quantityBefore: qtyBefore, quantityAfter: qtyAfter,
    };
  });
}

/* ── Transferência entre locais (duas pernas + transfer_pair_id) ─────────── */

async function handleTransfer(
  input: TransferMovementInput,
  ctx:   MovementContext,
): Promise<MovementResult> {
  return withClinicContext(ctx.clinicId, async (client) => {
    await assertProductExists(client, input.productId, ctx.clinicId);
    await assertStorageLocation(client, input.fromStorageLocationId, ctx.clinicId, 'origem');
    await assertStorageLocation(client, input.toStorageLocationId,   ctx.clinicId, 'destino');

    const lot = await lockLotOrThrow(client, input.lotId, ctx.clinicId);
    if (lot.product_id !== input.productId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Lote não pertence ao produto informado.' });
    }
    if (lot.status !== 'active') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Lote não está ativo (status: ${lot.status}).`,
      });
    }
    if (lot.storage_location_id !== input.fromStorageLocationId) {
      throw new TRPCError({
        code:    'BAD_REQUEST',
        message: 'Local de origem não confere com o storage_location_id do lote.',
      });
    }
    if (Number(lot.quantity_current) < input.quantity) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Lote só tem ${lot.quantity_current} unidades; solicitado ${input.quantity}.`,
      });
    }

    const pairId      = randomUUID();
    const isFullMove  = Number(lot.quantity_current) === input.quantity;
    let destinationLotId: string;

    if (isFullMove) {
      // Move o lote inteiro — apenas atualiza storage_location_id.
      await client.query(
        `UPDATE supply.inventory_lots
            SET storage_location_id = $2, updated_at = NOW()
          WHERE id = $1`,
        [lot.id, input.toStorageLocationId],
      );
      destinationLotId = lot.id;
    } else {
      // Split: origem decrementa, cria novo lote no destino com lot_number sufixado.
      await client.query(
        `UPDATE supply.inventory_lots
            SET quantity_current = quantity_current - $2, updated_at = NOW()
          WHERE id = $1`,
        [lot.id, input.quantity],
      );
      const suffix  = pairId.slice(0, 8);
      const newLotR = await client.query<{ id: string }>(
        `INSERT INTO supply.inventory_lots
           (clinic_id, product_id, storage_location_id, lot_number, batch_number,
            expiry_date, manufactured_date,
            quantity_initial, quantity_current, unit_cost, status)
         VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8, $8, $9, 'active')
         RETURNING id`,
        [
          ctx.clinicId, input.productId, input.toStorageLocationId,
          `${lot.lot_number}-T${suffix}`,
          lot.batch_number, lot.expiry_date, lot.manufactured_date,
          input.quantity, lot.unit_cost,
        ],
      );
      destinationLotId = newLotR.rows[0]!.id;
    }

    const qtyTotal = await readProductTotal(client, ctx.clinicId, input.productId);
    // Transferências intra-clínica não mudam o total — qtyBefore == qtyAfter.
    const qtyBefore = qtyTotal;
    const qtyAfter  = qtyTotal;

    const outId = await insertMovement(client, {
      clinicId: ctx.clinicId, productId: input.productId, lotId: lot.id,
      type: 'transferencia', reason: 'transferencia_saida', quantity: input.quantity,
      qtyBefore, qtyAfter,
      fromLocation: input.fromStorageLocationId,
      toLocation:   input.toStorageLocationId,
      transferPairId: pairId,
      notes: input.notes ?? null,
      performedBy: ctx.userId, ipOrigin: ctx.ipOrigin,
    });

    const inId = await insertMovement(client, {
      clinicId: ctx.clinicId, productId: input.productId, lotId: destinationLotId,
      type: 'transferencia', reason: 'transferencia_entrada', quantity: input.quantity,
      qtyBefore, qtyAfter,
      fromLocation: input.fromStorageLocationId,
      toLocation:   input.toStorageLocationId,
      transferPairId: pairId,
      notes: input.notes ?? null,
      performedBy: ctx.userId, ipOrigin: ctx.ipOrigin,
    });

    await writeAudit(ctx, 'supply_stock.transfer', input.productId, {
      pairId, outMovementId: outId, inMovementId: inId,
      sourceLotId: lot.id, destinationLotId,
      fromStorageLocationId: input.fromStorageLocationId,
      toStorageLocationId:   input.toStorageLocationId,
      quantity: input.quantity, split: !isFullMove,
    });

    emitToClinic(ctx.clinicId, 'stock.transfer', {
      productId: input.productId, pairId, quantity: input.quantity,
      fromLocationId: input.fromStorageLocationId,
      toLocationId:   input.toStorageLocationId,
      sourceLotId: lot.id, destinationLotId,
    });

    return {
      movementIds:    [outId, inId],
      transferPairId: pairId,
      productId:      input.productId,
      quantityBefore: qtyBefore,
      quantityAfter:  qtyAfter,
    };
  });
}

/* ── Insert canônico em inventory_movements ──────────────────────────────── */

interface InsertMovementArgs {
  clinicId:       string;
  productId:      string;
  lotId:          string | null;
  type:           MovementType;
  reason:         MovementReason;
  quantity:       number;
  qtyBefore:      number;
  qtyAfter:       number;
  unitCost?:      number | null;
  fromLocation?:  string | null;
  toLocation?:    string | null;
  encounterId?:   string | null;
  invoiceId?:     string | null;
  transferPairId?: string | null;
  notes?:         string | null;
  justification?: string | null;
  acceptExpired?: boolean;
  performedBy:    string;
  ipOrigin:       string | null;
}

async function insertMovement(
  client: PoolClient,
  args:   InsertMovementArgs,
): Promise<string> {
  const r = await client.query<{ id: string }>(
    `INSERT INTO supply.inventory_movements
       (clinic_id, product_id, lot_id,
        type, reason, reference_type,
        quantity, quantity_before, quantity_after, unit_cost,
        from_storage_location_id, to_storage_location_id,
        encounter_id, invoice_id, transfer_pair_id,
        justification, notes, accept_expired,
        performed_by, ip_origin)
     VALUES ($1, $2, $3,
             $4::supply.movement_type, $5::supply.movement_reason, 'manual'::supply.movement_reference_type,
             $6, $7, $8, $9,
             $10, $11,
             $12, $13, $14,
             $15, $16, $17,
             $18, $19::inet)
     RETURNING id`,
    [
      args.clinicId, args.productId, args.lotId,
      args.type, args.reason,
      args.quantity, args.qtyBefore, args.qtyAfter, args.unitCost ?? null,
      args.fromLocation ?? null, args.toLocation ?? null,
      args.encounterId ?? null, args.invoiceId ?? null, args.transferPairId ?? null,
      args.justification ?? null, args.notes ?? null, args.acceptExpired ?? false,
      args.performedBy, args.ipOrigin,
    ],
  );
  return r.rows[0]!.id;
}

/* ── Audit (fora da transação do negócio) ────────────────────────────────── */

async function writeAudit(
  ctx:          MovementContext,
  eventType:    string,
  aggregateId:  string,
  payload:      Record<string, unknown>,
): Promise<void> {
  await db.query(
    `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
     VALUES ($1, 'supply_stock', $2, $3, $4, $5)`,
    [
      ctx.clinicId, aggregateId, eventType,
      JSON.stringify(payload),
      JSON.stringify({ user_id: ctx.userId, ip: ctx.ipOrigin }),
    ],
  );
}
