import { TRPCError } from '@trpc/server';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { withClinicContext, db } from '../../db/client.js';
import { emitToClinic } from '../../lib/socket.js';
import { parseNfeXml, computeXmlHash } from './nfe-parser.js';
import { readProductTotal } from './lots.service.js';
import type {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  SubmitOrderInput,
  ApproveOrderInput,
  RejectOrderInput,
  ReturnOrderInput,
  SendOrderInput,
  ReceiveOrderInput,
  ListOrdersInput,
  GetOrderInput,
  OrderStatus,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatusHistory,
  PurchaseSettings,
  ReceiveOrderResult,
} from '@dermaos/shared';
import { VALID_TRANSITIONS } from '@dermaos/shared';

export interface OrderContext {
  clinicId: string;
  userId:   string;
  ipOrigin: string | null;
}

/* ── Máquina de estados (validação server-side) ──────────────────────────── */

function assertTransition(from: OrderStatus, to: OrderStatus): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new TRPCError({
      code:    'UNPROCESSABLE_CONTENT',
      message: `Transição de status inválida: ${from} → ${to}. ` +
               `Transições permitidas a partir de "${from}": ${allowed.length ? allowed.join(', ') : 'nenhuma'}.`,
    });
  }
}

/* ── Helpers de banco ────────────────────────────────────────────────────── */

interface OrderRow {
  id:              string;
  order_number:    string | null;
  clinic_id:       string;
  supplier_id:     string;
  supplier_name:   string;
  supplier_cnpj:   string | null;
  status:          OrderStatus;
  urgency:         string;
  total_amount:    string;
  notes:           string | null;
  expected_delivery: string | null;
  created_by:      string | null;
  created_by_name: string | null;
  created_at:      string;
  submitted_at:    string | null;
  approved_at:     string | null;
  approved_by:     string | null;
  rejected_at:     string | null;
  rejection_reason: string | null;
  returned_at:     string | null;
  return_reason:   string | null;
  sent_at:         string | null;
  auto_approved:   boolean;
  deleted_at:      string | null;
}

async function lockOrderOrThrow(
  client:   PoolClient,
  orderId:  string,
  clinicId: string,
): Promise<OrderRow> {
  const r = await client.query<OrderRow>(
    `SELECT
       po.id, po.order_number, po.clinic_id, po.supplier_id,
       s.name   AS supplier_name,
       s.cnpj   AS supplier_cnpj,
       po.status, po.urgency, po.total_amount, po.notes, po.expected_delivery,
       po.created_by,
       u.name   AS created_by_name,
       po.created_at, po.submitted_at, po.approved_at, po.approved_by,
       po.rejected_at, po.rejection_reason, po.returned_at, po.return_reason,
       po.sent_at, po.auto_approved, po.deleted_at
     FROM supply.purchase_orders po
     JOIN supply.suppliers s ON s.id = po.supplier_id
     LEFT JOIN shared.users u ON u.id = po.created_by
     WHERE po.id = $1 AND po.clinic_id = $2 AND po.deleted_at IS NULL
     FOR UPDATE OF po`,
    [orderId, clinicId],
  );
  if (!r.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Pedido de compra não encontrado.' });
  }
  return r.rows[0]!;
}

async function insertStatusHistory(
  client:   PoolClient,
  args: {
    clinicId:       string;
    orderId:        string;
    fromStatus:     OrderStatus | null;
    toStatus:       OrderStatus;
    changedBy:      string | null;
    changedByLabel: string | null;
    reason:         string | null;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO supply.purchase_order_status_history
       (clinic_id, purchase_order_id, from_status, to_status,
        changed_by, changed_by_label, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      args.clinicId, args.orderId,
      args.fromStatus, args.toStatus,
      args.changedBy, args.changedByLabel,
      args.reason,
    ],
  );
}

async function recalcOrderTotal(client: PoolClient, orderId: string): Promise<number> {
  const r = await client.query<{ total: string }>(
    `SELECT COALESCE(SUM(quantity_ordered * unit_cost), 0) AS total
       FROM supply.purchase_order_items
      WHERE purchase_order_id = $1`,
    [orderId],
  );
  const total = parseFloat(r.rows[0]?.total ?? '0');
  await client.query(
    `UPDATE supply.purchase_orders SET total_amount = $2, updated_at = NOW() WHERE id = $1`,
    [orderId, total],
  );
  return total;
}

async function getSettings(
  client:   PoolClient,
  clinicId: string,
): Promise<{
  autoApprovalThreshold:   number;
  divergenceTolerancePct:  number;
  divergenceSupervisorPct: number;
  orderNumberPrefix:       string;
}> {
  const r = await client.query<{
    auto_approval_threshold:   string;
    divergence_tolerance_pct:  string;
    divergence_supervisor_pct: string;
    order_number_prefix:       string;
  }>(
    `SELECT auto_approval_threshold, divergence_tolerance_pct,
            divergence_supervisor_pct, order_number_prefix
       FROM supply.tenant_purchase_settings
      WHERE clinic_id = $1`,
    [clinicId],
  );
  const row = r.rows[0];
  return {
    autoApprovalThreshold:   parseFloat(row?.auto_approval_threshold   ?? '1000'),
    divergenceTolerancePct:  parseFloat(row?.divergence_tolerance_pct  ?? '10'),
    divergenceSupervisorPct: parseFloat(row?.divergence_supervisor_pct ?? '30'),
    orderNumberPrefix:       row?.order_number_prefix ?? 'PO',
  };
}

async function generateOrderNumber(client: PoolClient, clinicId: string): Promise<string> {
  const r = await client.query<{ order_number_prefix: string; last_order_seq: number }>(
    `UPDATE supply.tenant_purchase_settings
        SET last_order_seq = last_order_seq + 1, updated_at = NOW()
      WHERE clinic_id = $1
      RETURNING order_number_prefix, last_order_seq`,
    [clinicId],
  );
  if (!r.rows[0]) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR',
      message: 'Configurações de compra não encontradas para esta clínica.' });
  }
  const { order_number_prefix, last_order_seq } = r.rows[0]!;
  return `${order_number_prefix}-${String(last_order_seq).padStart(5, '0')}`;
}

async function writeAudit(
  ctx:         OrderContext,
  eventType:   string,
  aggregateId: string,
  payload:     Record<string, unknown>,
): Promise<void> {
  await db.query(
    `INSERT INTO audit.domain_events
       (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
     VALUES ($1, 'purchase_order', $2, $3, $4, $5)`,
    [
      ctx.clinicId, aggregateId, eventType,
      JSON.stringify(payload),
      JSON.stringify({ user_id: ctx.userId, ip: ctx.ipOrigin }),
    ],
  );
}

function rowToOrder(row: OrderRow): PurchaseOrder {
  return {
    id:              row.id,
    orderNumber:     row.order_number,
    supplierId:      row.supplier_id,
    supplierName:    row.supplier_name,
    status:          row.status,
    urgency:         row.urgency as PurchaseOrder['urgency'],
    totalAmount:     parseFloat(row.total_amount),
    notes:           row.notes,
    expectedDelivery: row.expected_delivery,
    createdBy:       row.created_by,
    createdByName:   row.created_by_name,
    createdAt:       row.created_at,
    submittedAt:     row.submitted_at,
    approvedAt:      row.approved_at,
    approvedBy:      row.approved_by,
    rejectedAt:      row.rejected_at,
    rejectionReason: row.rejection_reason,
    returnedAt:      row.returned_at,
    returnReason:    row.return_reason,
    sentAt:          row.sent_at,
    autoApproved:    row.auto_approved,
  };
}

/* ── createOrder ─────────────────────────────────────────────────────────── */

export async function createOrder(
  input: CreatePurchaseOrderInput,
  ctx:   OrderContext,
): Promise<PurchaseOrder> {
  return withClinicContext(ctx.clinicId, async (client) => {
    // Valida fornecedor
    const sup = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM supply.suppliers
        WHERE id = $1 AND clinic_id = $2 AND is_active = TRUE LIMIT 1`,
      [input.supplierId, ctx.clinicId],
    );
    if (!sup.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Fornecedor não encontrado ou inativo.' });
    }

    // Cria o pedido em rascunho
    const po = await client.query<{ id: string }>(
      `INSERT INTO supply.purchase_orders
         (clinic_id, supplier_id, status, urgency, notes, expected_delivery,
          total_amount, created_by)
       VALUES ($1, $2, 'rascunho', $3::supply.order_urgency, $4, $5::date, 0, $6)
       RETURNING id`,
      [
        ctx.clinicId, input.supplierId, input.urgency,
        input.notes ?? null, input.expectedDelivery ?? null,
        ctx.userId,
      ],
    );
    const orderId = po.rows[0]!.id;

    // Insere os itens
    for (const item of input.items) {
      const prod = await client.query<{ id: string }>(
        `SELECT id FROM supply.products
          WHERE id = $1 AND clinic_id = $2 AND is_active = TRUE AND deleted_at IS NULL LIMIT 1`,
        [item.productId, ctx.clinicId],
      );
      if (!prod.rows[0]) {
        throw new TRPCError({ code: 'NOT_FOUND',
          message: `Produto ${item.productId} não encontrado ou inativo.` });
      }
      await client.query(
        `INSERT INTO supply.purchase_order_items
           (clinic_id, purchase_order_id, product_id, quantity_ordered, unit_cost, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ctx.clinicId, orderId, item.productId, item.quantity, item.estimatedCost, item.notes ?? null],
      );
    }

    await recalcOrderTotal(client, orderId);

    // Audit trail: entrada inicial
    await insertStatusHistory(client, {
      clinicId:       ctx.clinicId,
      orderId,
      fromStatus:     null,
      toStatus:       'rascunho',
      changedBy:      ctx.userId,
      changedByLabel: null,
      reason:         'Pedido criado',
    });

    await writeAudit(ctx, 'purchase_order.created', orderId,
      { supplierId: input.supplierId, urgency: input.urgency, itemCount: input.items.length });

    return getOrderById(client, orderId, ctx.clinicId);
  });
}

/* ── updateOrder ─────────────────────────────────────────────────────────── */

export async function updateOrder(
  input: UpdatePurchaseOrderInput,
  ctx:   OrderContext,
): Promise<PurchaseOrder> {
  return withClinicContext(ctx.clinicId, async (client) => {
    const order = await lockOrderOrThrow(client, input.orderId, ctx.clinicId);

    if (!['rascunho', 'devolvido'].includes(order.status)) {
      throw new TRPCError({
        code:    'UNPROCESSABLE_CONTENT',
        message: `Pedido no status "${order.status}" não pode ser editado. ` +
                 'Apenas rascunhos e pedidos devolvidos podem ser alterados.',
      });
    }

    const fields: string[] = [];
    const params: unknown[] = [];

    if (input.supplierId !== undefined) {
      const sup = await client.query<{ id: string }>(
        `SELECT id FROM supply.suppliers WHERE id = $1 AND clinic_id = $2 AND is_active = TRUE LIMIT 1`,
        [input.supplierId, ctx.clinicId],
      );
      if (!sup.rows[0]) throw new TRPCError({ code: 'NOT_FOUND', message: 'Fornecedor não encontrado.' });
      fields.push(`supplier_id = $${params.push(input.supplierId)}`);
    }
    if (input.urgency          !== undefined) fields.push(`urgency = $${params.push(input.urgency)}::supply.order_urgency`);
    if (input.notes             !== undefined) fields.push(`notes = $${params.push(input.notes)}`);
    if (input.expectedDelivery  !== undefined) fields.push(`expected_delivery = $${params.push(input.expectedDelivery)}::date`);

    if (fields.length > 0) {
      fields.push('updated_at = NOW()');
      await client.query(
        `UPDATE supply.purchase_orders SET ${fields.join(', ')} WHERE id = $${params.push(input.orderId)}`,
        params,
      );
    }

    // Substitui os itens se fornecidos
    if (input.items) {
      await client.query(
        `DELETE FROM supply.purchase_order_items WHERE purchase_order_id = $1`,
        [input.orderId],
      );
      for (const item of input.items) {
        await client.query(
          `INSERT INTO supply.purchase_order_items
             (clinic_id, purchase_order_id, product_id, quantity_ordered, unit_cost, notes)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [ctx.clinicId, input.orderId, item.productId, item.quantity, item.estimatedCost, item.notes ?? null],
        );
      }
      await recalcOrderTotal(client, input.orderId);
    }

    await writeAudit(ctx, 'purchase_order.updated', input.orderId,
      { fields: Object.keys(input).filter(k => k !== 'orderId') });

    return getOrderById(client, input.orderId, ctx.clinicId);
  });
}

/* ── submitOrder ─────────────────────────────────────────────────────────── */

export async function submitOrder(
  input: SubmitOrderInput,
  ctx:   OrderContext,
): Promise<PurchaseOrder> {
  return withClinicContext(ctx.clinicId, async (client) => {
    const order = await lockOrderOrThrow(client, input.orderId, ctx.clinicId);

    if (!['rascunho', 'devolvido'].includes(order.status)) {
      assertTransition(order.status, 'pendente_aprovacao');
    }

    // Valida completude
    const items = await client.query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM supply.purchase_order_items
        WHERE purchase_order_id = $1`,
      [input.orderId],
    );
    if (parseInt(items.rows[0]?.cnt ?? '0', 10) === 0) {
      throw new TRPCError({ code: 'UNPROCESSABLE_CONTENT',
        message: 'Não é possível submeter um pedido sem itens.' });
    }

    const settings = await getSettings(client, ctx.clinicId);
    const totalAmount = parseFloat(order.total_amount);
    const isEmergencia = order.urgency === 'emergencia';
    const isAutoApprove = isEmergencia && totalAmount < settings.autoApprovalThreshold;

    const fromStatus = order.status as OrderStatus;

    if (isAutoApprove) {
      // Aprovação automática: vai direto para 'aprovado'
      await client.query(
        `UPDATE supply.purchase_orders
            SET status       = 'aprovado',
                submitted_by = $2, submitted_at = NOW(),
                approved_by  = 'system_auto', approved_at = NOW(),
                auto_approved = TRUE,
                updated_at   = NOW()
          WHERE id = $1`,
        [input.orderId, ctx.userId],
      );
      await insertStatusHistory(client, {
        clinicId: ctx.clinicId, orderId: input.orderId,
        fromStatus, toStatus: 'aprovado',
        changedBy: null, changedByLabel: 'system_auto',
        reason: `Aprovação automática: valor R$ ${totalAmount.toFixed(2)} abaixo da alçada ` +
                `(R$ ${settings.autoApprovalThreshold.toFixed(2)}) + urgência emergência.`,
      });
    } else {
      await client.query(
        `UPDATE supply.purchase_orders
            SET status       = 'pendente_aprovacao',
                submitted_by = $2, submitted_at = NOW(),
                updated_at   = NOW()
          WHERE id = $1`,
        [input.orderId, ctx.userId],
      );
      await insertStatusHistory(client, {
        clinicId: ctx.clinicId, orderId: input.orderId,
        fromStatus, toStatus: 'pendente_aprovacao',
        changedBy: ctx.userId, changedByLabel: null,
        reason: null,
      });
    }

    emitToClinic(ctx.clinicId, 'purchase_order.submitted', {
      orderId: input.orderId, autoApproved: isAutoApprove,
    });
    await writeAudit(ctx, 'purchase_order.submitted', input.orderId,
      { autoApproved: isAutoApprove, totalAmount });

    return getOrderById(client, input.orderId, ctx.clinicId);
  });
}

/* ── approveOrder ────────────────────────────────────────────────────────── */

export async function approveOrder(
  input:    ApproveOrderInput,
  ctx:      OrderContext,
): Promise<PurchaseOrder> {
  return withClinicContext(ctx.clinicId, async (client) => {
    const order = await lockOrderOrThrow(client, input.orderId, ctx.clinicId);
    assertTransition(order.status, 'aprovado');

    // Segregação de funções: aprovador ≠ criador
    if (order.created_by === ctx.userId) {
      throw new TRPCError({
        code:    'FORBIDDEN',
        message: 'O criador do pedido não pode aprová-lo (segregação de funções).',
      });
    }

    await client.query(
      `UPDATE supply.purchase_orders
          SET status      = 'aprovado',
              approved_by = $2, approved_at = NOW(),
              updated_at  = NOW()
        WHERE id = $1`,
      [input.orderId, ctx.userId],
    );
    await insertStatusHistory(client, {
      clinicId: ctx.clinicId, orderId: input.orderId,
      fromStatus: order.status, toStatus: 'aprovado',
      changedBy: ctx.userId, changedByLabel: null,
      reason: null,
    });

    emitToClinic(ctx.clinicId, 'purchase_order.approved', { orderId: input.orderId });
    await writeAudit(ctx, 'purchase_order.approved', input.orderId, {});

    return getOrderById(client, input.orderId, ctx.clinicId);
  });
}

/* ── rejectOrder ─────────────────────────────────────────────────────────── */

export async function rejectOrder(
  input: RejectOrderInput,
  ctx:   OrderContext,
): Promise<PurchaseOrder> {
  return withClinicContext(ctx.clinicId, async (client) => {
    const order = await lockOrderOrThrow(client, input.orderId, ctx.clinicId);
    assertTransition(order.status, 'rejeitado');

    await client.query(
      `UPDATE supply.purchase_orders
          SET status           = 'rejeitado',
              rejected_by      = $2, rejected_at = NOW(),
              rejection_reason = $3, updated_at  = NOW()
        WHERE id = $1`,
      [input.orderId, ctx.userId, input.reason],
    );
    await insertStatusHistory(client, {
      clinicId: ctx.clinicId, orderId: input.orderId,
      fromStatus: order.status, toStatus: 'rejeitado',
      changedBy: ctx.userId, changedByLabel: null,
      reason: input.reason,
    });

    emitToClinic(ctx.clinicId, 'purchase_order.rejected', { orderId: input.orderId });
    await writeAudit(ctx, 'purchase_order.rejected', input.orderId, { reason: input.reason });

    return getOrderById(client, input.orderId, ctx.clinicId);
  });
}

/* ── returnOrder ─────────────────────────────────────────────────────────── */

export async function returnOrder(
  input: ReturnOrderInput,
  ctx:   OrderContext,
): Promise<PurchaseOrder> {
  return withClinicContext(ctx.clinicId, async (client) => {
    const order = await lockOrderOrThrow(client, input.orderId, ctx.clinicId);
    assertTransition(order.status, 'devolvido');

    await client.query(
      `UPDATE supply.purchase_orders
          SET status        = 'devolvido',
              returned_by   = $2, returned_at = NOW(),
              return_reason = $3, updated_at  = NOW()
        WHERE id = $1`,
      [input.orderId, ctx.userId, input.reason],
    );
    await insertStatusHistory(client, {
      clinicId: ctx.clinicId, orderId: input.orderId,
      fromStatus: order.status, toStatus: 'devolvido',
      changedBy: ctx.userId, changedByLabel: null,
      reason: input.reason,
    });

    emitToClinic(ctx.clinicId, 'purchase_order.returned', { orderId: input.orderId });
    await writeAudit(ctx, 'purchase_order.returned', input.orderId, { reason: input.reason });

    return getOrderById(client, input.orderId, ctx.clinicId);
  });
}

/* ── sendOrder ───────────────────────────────────────────────────────────── */

export async function sendOrder(
  input: SendOrderInput,
  ctx:   OrderContext,
): Promise<PurchaseOrder> {
  return withClinicContext(ctx.clinicId, async (client) => {
    const order = await lockOrderOrThrow(client, input.orderId, ctx.clinicId);
    assertTransition(order.status, 'enviado');

    const orderNumber = order.order_number ?? (await generateOrderNumber(client, ctx.clinicId));

    await client.query(
      `UPDATE supply.purchase_orders
          SET status       = 'enviado',
              order_number = $2,
              sent_by      = $3, sent_at = NOW(),
              updated_at   = NOW()
        WHERE id = $1`,
      [input.orderId, orderNumber, ctx.userId],
    );
    await insertStatusHistory(client, {
      clinicId: ctx.clinicId, orderId: input.orderId,
      fromStatus: order.status, toStatus: 'enviado',
      changedBy: ctx.userId, changedByLabel: null,
      reason: `Pedido ${orderNumber} enviado ao fornecedor.`,
    });

    emitToClinic(ctx.clinicId, 'purchase_order.sent', { orderId: input.orderId, orderNumber });
    await writeAudit(ctx, 'purchase_order.sent', input.orderId, { orderNumber });

    return getOrderById(client, input.orderId, ctx.clinicId);
  });
}

/* ── receiveOrder (operação ATÔMICA) ─────────────────────────────────────── */

interface OrderItemRow {
  id:               string;
  product_id:       string;
  quantity_ordered: string;
  quantity_received: string;
  unit_cost:        string;
  is_cold_chain:    boolean;
}

export async function receiveOrder(
  input: ReceiveOrderInput,
  ctx:   OrderContext,
): Promise<ReceiveOrderResult> {
  // Parse NF-e antes de entrar na transação (pode lançar erro antes de qualquer lock)
  let parsedNfe = null;
  if (input.nfeXml) {
    try {
      parsedNfe = parseNfeXml(input.nfeXml);
    } catch (e) {
      throw new TRPCError({
        code:    'UNPROCESSABLE_CONTENT',
        message: e instanceof Error ? e.message : 'Erro ao processar XML da NF-e.',
      });
    }
  }

  return withClinicContext(ctx.clinicId, async (client) => {
    // 1. Lock do pedido
    const order = await lockOrderOrThrow(client, input.orderId, ctx.clinicId);

    if (!['enviado', 'parcialmente_recebido'].includes(order.status)) {
      throw new TRPCError({
        code:    'UNPROCESSABLE_CONTENT',
        message: `Recebimento não permitido para pedidos com status "${order.status}". ` +
                 'Apenas pedidos enviados ou parcialmente recebidos podem ser conferidos.',
      });
    }

    // 2. Recusa de recebimento (não altera status nem cria lotes)
    if (input.type === 'recusar') {
      await client.query(
        `INSERT INTO supply.nfe_receipts
           (clinic_id, purchase_order_id, nf_number, nf_series, issuer_cnpj,
            issue_date, receipt_items, xml_hash, refusal_reason,
            received_by, status)
         VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, 'recusado')`,
        [
          ctx.clinicId, input.orderId,
          parsedNfe?.numero ?? input.nfeNumber ?? 'RECUSADO',
          parsedNfe?.serie  ?? input.nfeSeries  ?? null,
          parsedNfe?.cnpjEmitente ?? input.issuerCnpj ?? null,
          parsedNfe?.dataEmissao  ?? input.issueDate  ?? null,
          JSON.stringify(parsedNfe?.itens ?? []),
          input.nfeXml ? computeXmlHash(input.nfeXml) : null,
          input.refusalReason ?? null,
          ctx.userId,
        ],
      );
      await insertStatusHistory(client, {
        clinicId: ctx.clinicId, orderId: input.orderId,
        fromStatus: order.status, toStatus: order.status, // sem mudança de status
        changedBy: ctx.userId, changedByLabel: null,
        reason: `Recebimento recusado: ${input.refusalReason}`,
      });
      await writeAudit(ctx, 'purchase_order.receipt_refused', input.orderId,
        { reason: input.refusalReason });
      return {
        orderId: input.orderId,
        newStatus: order.status,
        lotsCreated: 0,
        movementsCreated: 0,
        cnpjDivergent: false,
      };
    }

    // 3. Settings de tolerância
    const settings = await getSettings(client, ctx.clinicId);

    // 4. Lock dos itens do pedido
    const orderItemsResult = await client.query<OrderItemRow>(
      `SELECT
         poi.id, poi.product_id,
         poi.quantity_ordered, poi.quantity_received,
         poi.unit_cost,
         p.is_cold_chain
       FROM supply.purchase_order_items poi
       JOIN supply.products p ON p.id = poi.product_id
       WHERE poi.purchase_order_id = $1
       FOR UPDATE OF poi`,
      [input.orderId],
    );
    const orderItemMap = new Map<string, OrderItemRow>(
      orderItemsResult.rows.map((r) => [r.id, r]),
    );

    // 5. Validação de divergências
    let hasDivergence         = false;
    let hasSupervisorDivergence = false;

    for (const ri of input.items) {
      if (ri.quantityReceived === 0) continue;
      const oi = orderItemMap.get(ri.purchaseOrderItemId);
      if (!oi) {
        throw new TRPCError({ code: 'NOT_FOUND',
          message: `Item do pedido ${ri.purchaseOrderItemId} não encontrado.` });
      }
      const qOrdered = parseFloat(oi.quantity_ordered);
      const divPct   = qOrdered > 0
        ? Math.abs(ri.quantityReceived - qOrdered) / qOrdered * 100
        : 0;
      if (divPct > settings.divergenceTolerancePct)  hasDivergence = true;
      if (divPct > settings.divergenceSupervisorPct) hasSupervisorDivergence = true;
    }

    if (hasDivergence && !input.divergenceJustification) {
      throw new TRPCError({
        code:    'UNPROCESSABLE_CONTENT',
        message: `Divergência de quantidade acima de ${settings.divergenceTolerancePct}% detectada. ` +
                 'Justificativa obrigatória.',
      });
    }
    if (hasSupervisorDivergence && !input.supervisorApproved) {
      throw new TRPCError({
        code:    'UNPROCESSABLE_CONTENT',
        message: `Divergência acima de ${settings.divergenceSupervisorPct}% requer aprovação de supervisor.`,
      });
    }

    // 6. CNPJ divergência (alerta, não bloqueia)
    const issuerCnpj   = parsedNfe?.cnpjEmitente ?? input.issuerCnpj ?? '';
    const supplierCnpj = order.supplier_cnpj ?? '';
    const normCnpj     = (c: string) => c.replace(/[\.\-\/]/g, '');
    const cnpjDivergent = !!(issuerCnpj && supplierCnpj &&
      normCnpj(issuerCnpj) !== normCnpj(supplierCnpj));

    // 7. Criação de lotes + movimentações (núcleo atômico)
    const lotsCreated:      string[] = [];
    const movementsCreated: string[] = [];

    for (const ri of input.items) {
      if (ri.quantityReceived === 0) continue;

      const oi = orderItemMap.get(ri.purchaseOrderItemId)!;

      // Verifica se lote já existe (reusa se existir e estiver ativo)
      const existingLot = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM supply.inventory_lots
          WHERE clinic_id = $1 AND product_id = $2 AND lot_number = $3
            AND deleted_at IS NULL
          FOR UPDATE`,
        [ctx.clinicId, oi.product_id, ri.lotNumber],
      );

      const qtyBefore = await readProductTotal(client, ctx.clinicId, oi.product_id);
      let lotId: string;

      if (existingLot.rows[0]) {
        const existing = existingLot.rows[0]!;
        if (existing.status === 'quarantined' || existing.status === 'expired') {
          throw new TRPCError({
            code:    'PRECONDITION_FAILED',
            message: `Lote "${ri.lotNumber}" está com status "${existing.status}". ` +
                     'Altere o status antes de registrar entrada.',
          });
        }
        lotId = existing.id;
        await client.query(
          `UPDATE supply.inventory_lots
              SET quantity_initial = quantity_initial + $2,
                  quantity_current = quantity_current + $2,
                  status = CASE WHEN status = 'consumed'
                                THEN 'active'::supply.lot_status ELSE status END,
                  updated_at = NOW()
            WHERE id = $1`,
          [lotId, ri.quantityReceived],
        );
      } else {
        const lotR = await client.query<{ id: string }>(
          `INSERT INTO supply.inventory_lots
             (clinic_id, product_id, storage_location_id, purchase_order_item_id,
              lot_number, expiry_date,
              quantity_initial, quantity_current, unit_cost, status)
           VALUES ($1, $2, $3, $4, $5, $6::date, $7, $7, $8, 'active')
           RETURNING id`,
          [
            ctx.clinicId,
            oi.product_id,
            ri.storageLocationId ?? null,
            ri.purchaseOrderItemId,
            ri.lotNumber,
            ri.expiryDate ?? null,
            ri.quantityReceived,
            parseFloat(oi.unit_cost),
          ],
        );
        lotId = lotR.rows[0]!.id;
      }
      lotsCreated.push(lotId);

      // Movimentação de entrada
      const qtyAfter = qtyBefore + ri.quantityReceived;
      const movR = await client.query<{ id: string }>(
        `INSERT INTO supply.inventory_movements
           (clinic_id, product_id, lot_id,
            type, reason, reference_type, reference_id,
            quantity, quantity_before, quantity_after, unit_cost,
            to_storage_location_id,
            notes, performed_by, ip_origin)
         VALUES ($1, $2, $3,
                 'entrada'::supply.movement_type,
                 'recebimento'::supply.movement_reason,
                 'purchase_order'::supply.movement_reference_type, $4,
                 $5, $6, $7, $8,
                 $9,
                 $10, $11, $12::inet)
         RETURNING id`,
        [
          ctx.clinicId, oi.product_id, lotId,
          input.orderId,
          ri.quantityReceived, qtyBefore, qtyAfter, parseFloat(oi.unit_cost),
          ri.storageLocationId ?? null,
          `Recebimento pedido ${order.order_number ?? input.orderId}`,
          ctx.userId, ctx.ipOrigin,
        ],
      );
      movementsCreated.push(movR.rows[0]!.id);

      // Atualiza qty recebida no item
      await client.query(
        `UPDATE supply.purchase_order_items
            SET quantity_received = quantity_received + $2, updated_at = NOW()
          WHERE id = $1`,
        [ri.purchaseOrderItemId, ri.quantityReceived],
      );
    }

    // 8. Determina novo status do pedido
    const updatedItems = await client.query<{
      quantity_ordered: string;
      quantity_received: string;
    }>(
      `SELECT quantity_ordered, quantity_received
         FROM supply.purchase_order_items
        WHERE purchase_order_id = $1`,
      [input.orderId],
    );

    const allReceived = updatedItems.rows.every(
      (r) => parseFloat(r.quantity_received) >= parseFloat(r.quantity_ordered),
    );
    const anyReceived = updatedItems.rows.some((r) => parseFloat(r.quantity_received) > 0);
    const newStatus: OrderStatus = allReceived
      ? 'recebido'
      : anyReceived
        ? 'parcialmente_recebido'
        : order.status as OrderStatus;

    await client.query(
      `UPDATE supply.purchase_orders
          SET status = $2, updated_at = NOW()
        WHERE id = $1`,
      [input.orderId, newStatus],
    );
    await insertStatusHistory(client, {
      clinicId: ctx.clinicId, orderId: input.orderId,
      fromStatus: order.status as OrderStatus, toStatus: newStatus,
      changedBy: ctx.userId, changedByLabel: null,
      reason: `Recebimento ${input.type}. NF ${parsedNfe?.numero ?? input.nfeNumber ?? 'manual'}.`,
    });

    // 9. Registra NF-e
    await client.query(
      `INSERT INTO supply.nfe_receipts
         (clinic_id, purchase_order_id, nf_number, nf_series, issuer_cnpj,
          cnpj_divergent, issue_date, receipt_items, xml_hash,
          divergence_justification, received_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, $11, 'confirmado')`,
      [
        ctx.clinicId, input.orderId,
        parsedNfe?.numero    ?? input.nfeNumber    ?? 'MANUAL',
        parsedNfe?.serie     ?? input.nfeSeries    ?? null,
        issuerCnpj           || null,
        cnpjDivergent,
        parsedNfe?.dataEmissao ?? input.issueDate  ?? null,
        JSON.stringify(parsedNfe?.itens ?? []),
        input.nfeXml ? computeXmlHash(input.nfeXml) : null,
        input.divergenceJustification ?? null,
        ctx.userId,
      ],
    );

    emitToClinic(ctx.clinicId, 'purchase_order.received', {
      orderId: input.orderId, newStatus,
      lotsCreated: lotsCreated.length,
    });
    await writeAudit(ctx, 'purchase_order.received', input.orderId, {
      lotsCreated, movementsCreated, newStatus,
      nfeNumber: parsedNfe?.numero ?? input.nfeNumber,
    });

    return {
      orderId: input.orderId,
      newStatus,
      lotsCreated:      lotsCreated.length,
      movementsCreated: movementsCreated.length,
      cnpjDivergent,
    };
  });
}

/* ── listOrders ──────────────────────────────────────────────────────────── */

export async function listOrders(
  input:    ListOrdersInput,
  clinicId: string,
): Promise<{ items: PurchaseOrder[]; total: number; page: number; totalPages: number }> {
  const params: unknown[] = [clinicId];
  const filters: string[]  = ['po.clinic_id = $1', 'po.deleted_at IS NULL'];

  if (input.status)     filters.push(`po.status = $${params.push(input.status)}::supply.order_status`);
  if (input.urgency)    filters.push(`po.urgency = $${params.push(input.urgency)}::supply.order_urgency`);
  if (input.supplierId) filters.push(`po.supplier_id = $${params.push(input.supplierId)}`);
  if (input.dateFrom)   filters.push(`po.created_at >= $${params.push(input.dateFrom)}::date`);
  if (input.dateTo)     filters.push(`po.created_at <  ($${params.push(input.dateTo)}::date + INTERVAL '1 day')`);
  if (input.search) {
    const like = `%${input.search}%`;
    filters.push(`(s.name ILIKE $${params.push(like)} OR po.order_number ILIKE $${params.push(like)})`);
  }

  const where  = filters.join(' AND ');
  const offset = (input.page - 1) * input.limit;

  const sql = `
    SELECT
      po.id, po.order_number, po.supplier_id,
      s.name    AS supplier_name,
      po.status, po.urgency, po.total_amount, po.notes,
      po.expected_delivery, po.created_by,
      u.name    AS created_by_name,
      po.created_at, po.submitted_at, po.approved_at, po.approved_by,
      po.rejected_at, po.rejection_reason, po.returned_at, po.return_reason,
      po.sent_at, po.auto_approved,
      po.deleted_at,
      COUNT(*) OVER () AS total_count
    FROM supply.purchase_orders po
    JOIN supply.suppliers s ON s.id = po.supplier_id
    LEFT JOIN shared.users u ON u.id = po.created_by
    WHERE ${where}
    ORDER BY po.created_at DESC
    LIMIT $${params.push(input.limit)} OFFSET $${params.push(offset)}
  `;

  const result = await db.query<OrderRow & { total_count: string }>(sql, params);
  const total  = result.rows[0] ? parseInt(result.rows[0].total_count, 10) : 0;

  return {
    items:      result.rows.map(rowToOrder),
    total,
    page:       input.page,
    totalPages: Math.max(1, Math.ceil(total / input.limit)),
  };
}

/* ── getOrder ────────────────────────────────────────────────────────────── */

export async function getOrder(
  input:    GetOrderInput,
  clinicId: string,
): Promise<PurchaseOrder & { items: PurchaseOrderItem[]; history: PurchaseOrderStatusHistory[] }> {
  const order = await db.query<OrderRow>(
    `SELECT
       po.id, po.order_number, po.supplier_id, s.name AS supplier_name,
       s.cnpj AS supplier_cnpj,
       po.status, po.urgency, po.total_amount, po.notes,
       po.expected_delivery, po.created_by, u.name AS created_by_name,
       po.created_at, po.submitted_at, po.approved_at, po.approved_by,
       po.rejected_at, po.rejection_reason, po.returned_at, po.return_reason,
       po.sent_at, po.auto_approved, po.deleted_at
     FROM supply.purchase_orders po
     JOIN supply.suppliers s ON s.id = po.supplier_id
     LEFT JOIN shared.users u ON u.id = po.created_by
     WHERE po.id = $1 AND po.clinic_id = $2 AND po.deleted_at IS NULL`,
    [input.orderId, clinicId],
  );
  if (!order.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Pedido de compra não encontrado.' });
  }

  const itemsResult = await db.query<{
    id: string; product_id: string; product_name: string;
    sku: string | null; unit: string;
    quantity_ordered: string; quantity_received: string;
    unit_cost: string; total_cost: string; notes: string | null;
  }>(
    `SELECT
       poi.id, poi.product_id, p.name AS product_name, p.sku, p.unit,
       poi.quantity_ordered, poi.quantity_received,
       poi.unit_cost, poi.total_cost, poi.notes
     FROM supply.purchase_order_items poi
     JOIN supply.products p ON p.id = poi.product_id
     WHERE poi.purchase_order_id = $1
     ORDER BY p.name`,
    [input.orderId],
  );

  const historyResult = await db.query<{
    id: string; from_status: string | null; to_status: string;
    changed_by: string | null; user_name: string | null;
    changed_by_label: string | null; changed_at: string; reason: string | null;
  }>(
    `SELECT
       h.id, h.from_status, h.to_status,
       h.changed_by, u.name AS user_name,
       h.changed_by_label, h.changed_at, h.reason
     FROM supply.purchase_order_status_history h
     LEFT JOIN shared.users u ON u.id = h.changed_by
     WHERE h.purchase_order_id = $1
     ORDER BY h.changed_at ASC`,
    [input.orderId],
  );

  return {
    ...rowToOrder(order.rows[0]!),
    items: itemsResult.rows.map((r) => ({
      id:               r.id,
      productId:        r.product_id,
      productName:      r.product_name,
      sku:              r.sku,
      unit:             r.unit,
      quantityOrdered:  parseFloat(r.quantity_ordered),
      quantityReceived: parseFloat(r.quantity_received),
      unitCost:         parseFloat(r.unit_cost),
      totalCost:        parseFloat(r.total_cost),
      notes:            r.notes,
    })),
    history: historyResult.rows.map((r) => ({
      id:             r.id,
      fromStatus:     r.from_status as OrderStatus | null,
      toStatus:       r.to_status as OrderStatus,
      changedBy:      r.changed_by,
      changedByName:  r.user_name,
      changedByLabel: r.changed_by_label,
      changedAt:      r.changed_at,
      reason:         r.reason,
    })),
  };
}

/* ── getPurchaseSettings ─────────────────────────────────────────────────── */

export async function getPurchaseSettings(clinicId: string): Promise<PurchaseSettings> {
  const r = await db.query<{
    auto_approval_threshold: string;
    divergence_tolerance_pct: string;
    divergence_supervisor_pct: string;
    order_number_prefix: string;
  }>(
    `SELECT auto_approval_threshold, divergence_tolerance_pct,
            divergence_supervisor_pct, order_number_prefix
       FROM supply.tenant_purchase_settings WHERE clinic_id = $1`,
    [clinicId],
  );
  const row = r.rows[0];
  return {
    autoApprovalThreshold:   parseFloat(row?.auto_approval_threshold   ?? '1000'),
    divergenceTolerancePct:  parseFloat(row?.divergence_tolerance_pct  ?? '10'),
    divergenceSupervisorPct: parseFloat(row?.divergence_supervisor_pct ?? '30'),
    orderNumberPrefix:       row?.order_number_prefix ?? 'PO',
  };
}

/* ── Helper interno: lê pedido sem lock (pós-mutação) ────────────────────── */

async function getOrderById(
  client:   PoolClient,
  orderId:  string,
  clinicId: string,
): Promise<PurchaseOrder> {
  const r = await client.query<OrderRow>(
    `SELECT
       po.id, po.order_number, po.supplier_id, s.name AS supplier_name,
       s.cnpj AS supplier_cnpj,
       po.status, po.urgency, po.total_amount, po.notes,
       po.expected_delivery, po.created_by, u.name AS created_by_name,
       po.created_at, po.submitted_at, po.approved_at, po.approved_by,
       po.rejected_at, po.rejection_reason, po.returned_at, po.return_reason,
       po.sent_at, po.auto_approved, po.deleted_at
     FROM supply.purchase_orders po
     JOIN supply.suppliers s ON s.id = po.supplier_id
     LEFT JOIN shared.users u ON u.id = po.created_by
     WHERE po.id = $1 AND po.clinic_id = $2`,
    [orderId, clinicId],
  );
  return rowToOrder(r.rows[0]!);
}
