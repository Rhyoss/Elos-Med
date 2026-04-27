import { TRPCError } from '@trpc/server';
import { withClinicContext, db } from '../../db/client.js';
import { logger } from '../../lib/logger.js';
import type {
  CreateInvoiceInput,
  UpdateInvoiceDraftInput,
  ListInvoicesInput,
  CancelInvoiceInput,
  InvoiceStatus,
  DiscountInput,
} from '@dermaos/shared';

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface InvoiceRow {
  id:                    string;
  clinic_id:             string;
  patient_id:            string;
  provider_id:           string | null;
  appointment_id:        string | null;
  invoice_number:        string;
  status:                InvoiceStatus;
  issue_date:            string;
  due_date:              string | null;
  subtotal:              number;  // centavos
  discount_amount:       number;  // centavos
  discount_pct:          number;  // basis-points (100% = 10000)
  discount_type:         string | null;
  discount_reason:       string | null;
  discount_approved_by:  string | null;
  total_amount:          number;  // centavos
  amount_paid:           number;  // centavos
  amount_due:            number;  // centavos (generated)
  notes:                 string | null;
  internal_notes:        string | null;
  cancellation_reason:   string | null;
  cancelled_at:          string | null;
  sent_at:               string | null;
  paid_at:               string | null;
  created_at:            string;
  updated_at:            string;
  created_by:            string | null;
  updated_by:            string | null;
  ip_origin:             string | null;
  deleted_at:            string | null;
  // JOINed
  patient_name:          string | null;
  provider_name:         string | null;
}

export interface InvoiceItemRow {
  id:              string;
  invoice_id:      string;
  service_id:      string | null;
  description:     string;
  quantity:        number;
  unit_price:      number;  // centavos
  discount_amount: number;  // centavos
  total_price:     number;  // centavos (generated)
  created_at:      string;
}

// ─── Máquina de estados ─────────────────────────────────────────────────────
// Transições permitidas: {from: to[]}
const ALLOWED_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  rascunho:  ['emitida'],
  emitida:   ['parcial', 'paga', 'vencida', 'cancelada'],
  parcial:   ['paga', 'vencida', 'cancelada'],
  paga:      [],
  vencida:   ['paga', 'cancelada'],
  cancelada: [],
};

function assertTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new TRPCError({
      code:    'UNPROCESSABLE_CONTENT',
      message: `Transição inválida: fatura "${from}" não pode passar para "${to}".`,
    });
  }
}

// ─── Leitura ───────────────────────────────────────────────────────────────

export async function listInvoices(
  input:    ListInvoicesInput,
  clinicId: string,
): Promise<{ data: InvoiceRow[]; total: number }> {
  return withClinicContext(clinicId, async (client) => {
    const conditions: string[] = ['i.clinic_id = $1', 'i.deleted_at IS NULL'];
    const params: unknown[] = [clinicId];
    let p = 2;

    if (input.patientId) {
      conditions.push(`i.patient_id = $${p++}`);
      params.push(input.patientId);
    }
    if (input.providerId) {
      conditions.push(`i.provider_id = $${p++}`);
      params.push(input.providerId);
    }
    if (input.status) {
      conditions.push(`i.status = $${p++}::financial.invoice_status`);
      params.push(input.status);
    }
    if (input.dateFrom) {
      conditions.push(`i.issue_date >= $${p++}`);
      params.push(input.dateFrom);
    }
    if (input.dateTo) {
      conditions.push(`i.issue_date <= $${p++}`);
      params.push(input.dateTo);
    }
    if (input.search) {
      conditions.push(`(i.invoice_number ILIKE $${p} OR pt.name ILIKE $${p})`);
      params.push(`%${input.search}%`);
      p++;
    }

    const where  = conditions.join(' AND ');
    const offset = (input.page - 1) * input.limit;

    const [rows, count] = await Promise.all([
      client.query<InvoiceRow>(
        `SELECT i.*,
                pt.name AS patient_name,
                u.name  AS provider_name
           FROM financial.invoices i
      LEFT JOIN shared.patients pt ON pt.id = i.patient_id
      LEFT JOIN shared.users     u  ON u.id  = i.provider_id
          WHERE ${where}
          ORDER BY i.issue_date DESC, i.created_at DESC
          LIMIT $${p} OFFSET $${p + 1}`,
        [...params, input.limit, offset],
      ),
      client.query<{ count: string }>(
        `SELECT COUNT(*) AS count
           FROM financial.invoices i
      LEFT JOIN shared.patients pt ON pt.id = i.patient_id
          WHERE ${where}`,
        params,
      ),
    ]);

    return {
      data:  rows.rows,
      total: parseInt(count.rows[0]?.count ?? '0', 10),
    };
  });
}

export async function getInvoiceById(
  id:       string,
  clinicId: string,
): Promise<InvoiceRow> {
  return withClinicContext(clinicId, async (client) => {
    const r = await client.query<InvoiceRow>(
      `SELECT i.*,
              pt.name AS patient_name,
              u.name  AS provider_name
         FROM financial.invoices i
    LEFT JOIN shared.patients pt ON pt.id = i.patient_id
    LEFT JOIN shared.users     u  ON u.id  = i.provider_id
        WHERE i.id = $1 AND i.clinic_id = $2 AND i.deleted_at IS NULL
        LIMIT 1`,
      [id, clinicId],
    );
    if (!r.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Fatura não encontrada.' });
    }
    return r.rows[0];
  });
}

export async function getInvoiceItems(
  invoiceId: string,
  clinicId:  string,
): Promise<InvoiceItemRow[]> {
  const r = await db.query<InvoiceItemRow>(
    `SELECT ii.*
       FROM financial.invoice_items ii
      WHERE ii.invoice_id = $1 AND ii.clinic_id = $2
      ORDER BY ii.created_at ASC`,
    [invoiceId, clinicId],
  );
  return r.rows;
}

// ─── Criação ───────────────────────────────────────────────────────────────

export async function createInvoice(
  input:    CreateInvoiceInput,
  clinicId: string,
  userId:   string,
  ipOrigin: string,
): Promise<InvoiceRow> {
  // Idempotência: se appointment já tem fatura, retorna a existente
  if (input.appointmentId) {
    const existing = await db.query<{ id: string }>(
      `SELECT id FROM financial.invoices
        WHERE clinic_id = $1 AND appointment_id = $2 AND deleted_at IS NULL
        LIMIT 1`,
      [clinicId, input.appointmentId],
    );
    if (existing.rows[0]) {
      logger.warn(
        { clinicId, appointmentId: input.appointmentId },
        'Invoice already exists for appointment — returning existing.',
      );
      return getInvoiceById(existing.rows[0].id, clinicId);
    }
  }

  return withClinicContext(clinicId, async (client) => {
    // Busca preços atuais dos serviços
    const serviceIds = input.items.map((i) => i.serviceId);
    const servicesResult = await client.query<{
      id: string; name: string; price: number; is_active: boolean;
    }>(
      `SELECT id, name, price, is_active
         FROM financial.service_catalog
        WHERE id = ANY($1::uuid[]) AND clinic_id = $2 AND deleted_at IS NULL`,
      [serviceIds, clinicId],
    );
    const serviceMap = new Map(servicesResult.rows.map((s) => [s.id, s]));

    // Valida itens e calcula subtotal
    let subtotal = 0;
    const resolvedItems: Array<{
      serviceId:   string;
      description: string;
      quantity:    number;
      unitPrice:   number;
    }> = [];

    for (const item of input.items) {
      const svc = serviceMap.get(item.serviceId);
      if (!svc) {
        throw new TRPCError({
          code:    'BAD_REQUEST',
          message: `Serviço "${item.serviceId}" não encontrado ou inativo.`,
        });
      }
      if (!svc.is_active) {
        throw new TRPCError({
          code:    'BAD_REQUEST',
          message: `Serviço "${svc.name}" está desativado e não pode ser faturado.`,
        });
      }
      const unitPrice = item.unitPrice ?? svc.price;
      const qty       = item.quantity ?? 1;
      resolvedItems.push({
        serviceId:   item.serviceId,
        description: item.description ?? svc.name,
        quantity:    qty,
        unitPrice,
      });
      subtotal += qty * unitPrice;
    }

    // Calcula desconto
    const { discountAmount, discountPct } = resolveDiscount(
      input.discount ?? null,
      subtotal,
    );
    const totalAmount = subtotal - discountAmount;

    if (totalAmount < 0) {
      throw new TRPCError({
        code:    'BAD_REQUEST',
        message: 'Desconto não pode exceder o valor total da fatura.',
      });
    }

    // Cria fatura com número provisório (será atribuído na emissão)
    const invoiceResult = await client.query<{ id: string }>(
      `INSERT INTO financial.invoices
         (clinic_id, patient_id, provider_id, appointment_id,
          invoice_number, status, issue_date, due_date,
          subtotal, discount_amount, discount_pct,
          discount_type, discount_reason,
          total_amount, amount_paid,
          notes, internal_notes,
          created_by, updated_by, ip_origin)
       VALUES ($1,$2,$3,$4,
               'RASCUNHO', 'rascunho', CURRENT_DATE, $5,
               $6,$7,$8,
               $9,$10,
               $11,0,
               $12,$13,
               $14,$14,$15)
       RETURNING id`,
      [
        clinicId,
        input.patientId,
        input.providerId    ?? null,
        input.appointmentId ?? null,
        input.dueDate       ?? null,
        subtotal,
        discountAmount,
        discountPct,
        input.discount?.discountType   ?? null,
        input.discount?.discountReason ?? null,
        totalAmount,
        input.notes         ?? null,
        input.internalNotes ?? null,
        userId,
        ipOrigin,
      ],
    );

    const invoiceId = invoiceResult.rows[0]!.id;

    // Insere itens
    for (const item of resolvedItems) {
      await client.query(
        `INSERT INTO financial.invoice_items
           (clinic_id, invoice_id, service_id, description, quantity, unit_price, discount_amount)
         VALUES ($1,$2,$3,$4,$5,$6,0)`,
        [clinicId, invoiceId, item.serviceId, item.description, item.quantity, item.unitPrice],
      );
    }

    await db.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1,'financial_invoice',$2,'financial_invoice.created',$3,$4)`,
      [clinicId, invoiceId,
        JSON.stringify({ patient_id: input.patientId, total_amount: totalAmount }),
        JSON.stringify({ user_id: userId, ip: ipOrigin })],
    );

    return getInvoiceById(invoiceId, clinicId);
  });
}

// ─── Edição de rascunho ────────────────────────────────────────────────────

export async function updateInvoiceDraft(
  input:    UpdateInvoiceDraftInput,
  clinicId: string,
  userId:   string,
  ipOrigin: string,
): Promise<InvoiceRow> {
  const current = await getInvoiceById(input.id, clinicId);

  if (current.status !== 'rascunho') {
    throw new TRPCError({
      code:    'UNPROCESSABLE_CONTENT',
      message: 'Apenas faturas em rascunho podem ser editadas.',
    });
  }

  return withClinicContext(clinicId, async (client) => {
    let subtotal = current.subtotal;

    if (input.items) {
      // Recarrega itens do catálogo
      const serviceIds = input.items.map((i) => i.serviceId);
      const svcs = await client.query<{ id: string; name: string; price: number }>(
        `SELECT id, name, price FROM financial.service_catalog
          WHERE id = ANY($1::uuid[]) AND clinic_id = $2 AND deleted_at IS NULL`,
        [serviceIds, clinicId],
      );
      const serviceMap = new Map(svcs.rows.map((s) => [s.id, s]));

      // Remove itens antigos
      await client.query(
        `DELETE FROM financial.invoice_items WHERE invoice_id = $1 AND clinic_id = $2`,
        [input.id, clinicId],
      );

      subtotal = 0;
      for (const item of input.items) {
        const svc = serviceMap.get(item.serviceId);
        if (!svc) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Serviço "${item.serviceId}" não encontrado.` });
        }
        const unitPrice = item.unitPrice ?? svc.price;
        const qty       = item.quantity ?? 1;
        subtotal += qty * unitPrice;
        await client.query(
          `INSERT INTO financial.invoice_items
             (clinic_id, invoice_id, service_id, description, quantity, unit_price, discount_amount)
           VALUES ($1,$2,$3,$4,$5,$6,0)`,
          [clinicId, input.id, item.serviceId, item.description ?? svc.name, qty, unitPrice],
        );
      }
    }

    const discountSource = input.discount ?? (current.discount_type ? {
      discountType:   current.discount_type as 'absolute' | 'percentage',
      discountValue:  current.discount_type === 'absolute'
        ? current.discount_amount
        : current.discount_pct / 100,
      discountReason: current.discount_reason as any,
    } : null);

    const { discountAmount, discountPct } = resolveDiscount(discountSource, subtotal);
    const totalAmount = subtotal - discountAmount;

    if (totalAmount < 0) {
      throw new TRPCError({
        code:    'BAD_REQUEST',
        message: 'Desconto não pode exceder o valor total da fatura.',
      });
    }

    await client.query(
      `UPDATE financial.invoices
          SET due_date        = COALESCE($3, due_date),
              notes           = COALESCE($4, notes),
              internal_notes  = COALESCE($5, internal_notes),
              subtotal        = $6,
              discount_amount = $7,
              discount_pct    = $8,
              discount_type   = $9,
              discount_reason = $10,
              total_amount    = $11,
              updated_by      = $12,
              ip_origin       = $13
        WHERE id = $1 AND clinic_id = $2`,
      [
        input.id, clinicId,
        input.dueDate       ?? null,
        input.notes         ?? null,
        input.internalNotes ?? null,
        subtotal,
        discountAmount,
        discountPct,
        discountSource?.discountType   ?? null,
        discountSource?.discountReason ?? null,
        totalAmount,
        userId,
        ipOrigin,
      ],
    );

    return getInvoiceById(input.id, clinicId);
  });
}

// ─── Emissão (rascunho → emitida + número sequencial) ─────────────────────

export async function emitInvoice(
  id:       string,
  clinicId: string,
  userId:   string,
  ipOrigin: string,
): Promise<InvoiceRow> {
  const current = await getInvoiceById(id, clinicId);
  assertTransition(current.status, 'emitida');

  // Verifica teto de desconto
  await assertDiscountApproval(current, clinicId);

  return withClinicContext(clinicId, async (client) => {
    // Gera número sequencial com advisory lock por clínica (sem gaps)
    const year   = new Date().getFullYear();
    const lockId = BigInt(clinicId.replace(/-/g, '').slice(0, 15));

    await client.query(`SELECT pg_advisory_xact_lock($1)`, [lockId]);

    // Upsert na tabela de sequências
    const seqResult = await client.query<{ last_seq: number }>(
      `INSERT INTO financial.invoice_sequences (clinic_id, year, last_seq)
       VALUES ($1, $2, 1)
       ON CONFLICT (clinic_id, year) DO UPDATE
         SET last_seq = financial.invoice_sequences.last_seq + 1
       RETURNING last_seq`,
      [clinicId, year],
    );

    const seq = seqResult.rows[0]!.last_seq;

    // Recupera prefixo da configuração
    const cfgResult = await client.query<{ invoice_prefix: string }>(
      `SELECT invoice_prefix FROM financial.financial_config WHERE clinic_id = $1`,
      [clinicId],
    );
    const prefix = cfgResult.rows[0]?.invoice_prefix ?? 'DRM';
    const invoiceNumber = `${prefix}-${year}-${String(seq).padStart(6, '0')}`;

    await client.query(
      `UPDATE financial.invoices
          SET status         = 'emitida',
              invoice_number = $3,
              sent_at        = NOW(),
              updated_by     = $4,
              ip_origin      = $5
        WHERE id = $1 AND clinic_id = $2`,
      [id, clinicId, invoiceNumber, userId, ipOrigin],
    );

    await db.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1,'financial_invoice',$2,'financial_invoice.emitida',$3,$4)`,
      [clinicId, id,
        JSON.stringify({ invoice_number: invoiceNumber }),
        JSON.stringify({ user_id: userId, ip: ipOrigin })],
    );

    return getInvoiceById(id, clinicId);
  });
}

// ─── Cancelamento ──────────────────────────────────────────────────────────

export async function cancelInvoice(
  input:    CancelInvoiceInput,
  clinicId: string,
  userId:   string,
  ipOrigin: string,
): Promise<InvoiceRow> {
  const current = await getInvoiceById(input.id, clinicId);
  assertTransition(current.status, 'cancelada');

  await withClinicContext(clinicId, async (client) => {
    await client.query(
      `UPDATE financial.invoices
          SET status               = 'cancelada',
              cancellation_reason  = $3,
              cancelled_at         = NOW(),
              updated_by           = $4,
              ip_origin            = $5
        WHERE id = $1 AND clinic_id = $2`,
      [input.id, clinicId, input.reason, userId, ipOrigin],
    );
    await db.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1,'financial_invoice',$2,'financial_invoice.cancelada',$3,$4)`,
      [clinicId, input.id,
        JSON.stringify({ reason: input.reason }),
        JSON.stringify({ user_id: userId, ip: ipOrigin })],
    );
  });

  return getInvoiceById(input.id, clinicId);
}

// ─── Atualização de status por conciliação (chamado pelo payments service) ─

export async function reconcileInvoiceStatus(
  invoiceId: string,
  clinicId:  string,
  userId:    string,
  client:    import('pg').PoolClient,
): Promise<void> {
  const r = await client.query<{
    status: InvoiceStatus;
    total_amount: number;
    amount_paid: number;
    due_date: string | null;
  }>(
    `SELECT status, total_amount, amount_paid, due_date
       FROM financial.invoices
      WHERE id = $1 AND clinic_id = $2 FOR UPDATE`,
    [invoiceId, clinicId],
  );

  const inv = r.rows[0];
  if (!inv) return;

  const current = inv.status as InvoiceStatus;
  if (current === 'cancelada' || current === 'paga') return;

  let newStatus: InvoiceStatus;
  if (inv.amount_paid >= inv.total_amount) {
    newStatus = 'paga';
  } else if (inv.amount_paid > 0) {
    newStatus = 'parcial';
  } else {
    return; // sem pagamento registrado ainda
  }

  if (newStatus === current) return;

  assertTransition(current, newStatus);

  await client.query(
    `UPDATE financial.invoices
        SET status     = $3,
            paid_at    = CASE WHEN $3 = 'paga' THEN NOW() ELSE paid_at END,
            updated_by = $4
      WHERE id = $1 AND clinic_id = $2`,
    [invoiceId, clinicId, newStatus, userId],
  );

  await db.query(
    `INSERT INTO audit.domain_events
       (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
     VALUES ($1,'financial_invoice',$2,'financial_invoice.status_updated',$3,$4)`,
    [clinicId, invoiceId,
      JSON.stringify({ from: current, to: newStatus }),
      JSON.stringify({ user_id: userId })],
  );
}

// ─── Worker: marcar vencidas ────────────────────────────────────────────────
// Chamado por job diário; usa dermaos_worker (sem RLS por clinic_id).

export async function markOverdueInvoices(): Promise<number> {
  const r = await db.query<{ id: string }>(
    `UPDATE financial.invoices
        SET status = 'vencida'
      WHERE status IN ('emitida','parcial')
        AND due_date < CURRENT_DATE
        AND deleted_at IS NULL
     RETURNING id`,
  );
  if (r.rows.length > 0) {
    logger.info({ count: r.rows.length }, 'Faturas marcadas como vencidas.');
  }
  return r.rows.length;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function resolveDiscount(
  discount: DiscountInput | null,
  subtotal:  number,
): { discountAmount: number; discountPct: number } {
  if (!discount) {
    return { discountAmount: 0, discountPct: 0 };
  }
  if (discount.discountType === 'absolute') {
    const discountAmount = discount.discountValue;
    const discountPct    = subtotal > 0
      ? Math.round((discountAmount / subtotal) * 10000)
      : 0;
    return { discountAmount, discountPct };
  }
  // percentage
  const discountPct    = discount.discountValue * 100; // basis-points
  const discountAmount = Math.round((subtotal * discount.discountValue) / 100);
  return { discountAmount, discountPct };
}

async function assertDiscountApproval(
  invoice:  InvoiceRow,
  clinicId: string,
): Promise<void> {
  if (!invoice.discount_type) return;

  const cfg = await db.query<{ admin_discount_floor: number }>(
    `SELECT admin_discount_floor FROM financial.financial_config WHERE clinic_id = $1`,
    [clinicId],
  );
  const floor = cfg.rows[0]?.admin_discount_floor ?? 30;

  // Calcula % efetiva do desconto
  const effectivePct = invoice.subtotal > 0
    ? Math.round((invoice.discount_amount / invoice.subtotal) * 100)
    : 0;

  if (effectivePct > floor && !invoice.discount_approved_by) {
    throw new TRPCError({
      code:    'FORBIDDEN',
      message: `Desconto de ${effectivePct}% excede o teto de ${floor}% e requer aprovação de um administrador.`,
    });
  }
}
