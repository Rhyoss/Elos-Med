import { TRPCError } from '@trpc/server';
import { withClinicContext, db } from '../../db/client.js';
import { reconcileInvoiceStatus } from './invoices.service.js';
import type { RegisterPaymentInput, RefundPaymentInput, InstallmentsInput } from '@dermaos/shared';

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface PaymentRow {
  id:                string;
  clinic_id:         string;
  invoice_id:        string;
  method:            string;
  status:            string;
  payment_type:      string;
  amount:            number;  // centavos (positivo para pagamento, negativo para estorno)
  received_at:       string | null;
  installments:      number;
  installment_number: number | null;
  card_brand:        string | null;
  card_last4:        string | null;
  card_installments: number | null;
  pix_txid:          string | null;
  boleto_barcode:    string | null;
  convenio_name:     string | null;
  convenio_guide:    string | null;
  refund_reason:     string | null;
  refund_of_id:      string | null;
  registered_by:     string | null;
  gateway_id:        string | null;
  gateway_response:  object;
  notes:             string | null;
  ip_origin:         string | null;
  deleted_at:        string | null;
  created_at:        string;
  updated_at:        string;
}

// ─── Leitura ───────────────────────────────────────────────────────────────

export async function getInvoicePayments(
  invoiceId: string,
  clinicId:  string,
): Promise<PaymentRow[]> {
  const r = await db.query<PaymentRow>(
    `SELECT * FROM financial.payments
      WHERE invoice_id = $1 AND clinic_id = $2 AND deleted_at IS NULL
      ORDER BY created_at ASC`,
    [invoiceId, clinicId],
  );
  return r.rows;
}

// ─── Registro de pagamento ─────────────────────────────────────────────────

export async function registerPayment(
  input:    RegisterPaymentInput,
  clinicId: string,
  userId:   string,
  ipOrigin: string,
): Promise<PaymentRow> {
  return withClinicContext(clinicId, async (client) => {
    // Lock na fatura para serializar pagamentos concorrentes
    const invResult = await client.query<{
      id: string;
      status: string;
      total_amount: number;
      amount_paid:  number;
    }>(
      `SELECT id, status, total_amount, amount_paid
         FROM financial.invoices
        WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL
        FOR UPDATE`,
      [input.invoiceId, clinicId],
    );

    const invoice = invResult.rows[0];
    if (!invoice) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Fatura não encontrada.' });
    }

    // Valida status: só aceita pagamento em emitida, parcial ou vencida
    if (!['emitida', 'parcial', 'vencida'].includes(invoice.status)) {
      throw new TRPCError({
        code:    'UNPROCESSABLE_CONTENT',
        message: `Não é possível registrar pagamento em fatura com status "${invoice.status}".`,
      });
    }

    // Anti-overpayment: impede pagamento acima do saldo devedor
    const balance = invoice.total_amount - invoice.amount_paid;
    if (input.amount > balance) {
      throw new TRPCError({
        code:    'BAD_REQUEST',
        message: `Valor excede o saldo devedor de R$ ${formatBRL(balance)}. Registre o valor correto.`,
      });
    }

    // Extrai campos específicos por método
    const methodFields = extractMethodFields(input);

    // Chama mock gateway
    const gatewayResult = await mockGateway(input.method, input.amount);

    const payResult = await client.query<{ id: string }>(
      `INSERT INTO financial.payments
         (clinic_id, invoice_id, method, status, payment_type, amount,
          received_at, installments,
          card_brand, card_last4, card_installments,
          pix_txid, boleto_barcode,
          convenio_name, convenio_guide,
          gateway_id, gateway_response,
          registered_by, ip_origin, notes)
       VALUES ($1,$2,$3,$4,'pagamento',$5,
               COALESCE($6,NOW()),1,
               $7,$8,$9,
               $10,$11,
               $12,$13,
               $14,$15,
               $16,$17,$18)
       RETURNING id`,
      [
        clinicId,
        input.invoiceId,
        input.method,
        'aprovado',
        input.amount,
        input.paidAt ?? null,
        methodFields.cardBrand        ?? null,
        methodFields.cardLast4        ?? null,
        methodFields.cardInstallments ?? null,
        methodFields.pixTxid          ?? null,
        methodFields.boletoBarcode    ?? null,
        methodFields.convenioName     ?? null,
        methodFields.convenioGuide    ?? null,
        gatewayResult.id,
        JSON.stringify(gatewayResult),
        userId,
        ipOrigin,
        input.notes ?? null,
      ],
    );

    const paymentId = payResult.rows[0]!.id;

    // Atualiza amount_paid na fatura (ainda dentro da mesma tx)
    await client.query(
      `UPDATE financial.invoices
          SET amount_paid = amount_paid + $3, updated_by = $4
        WHERE id = $1 AND clinic_id = $2`,
      [input.invoiceId, clinicId, input.amount, userId],
    );

    // Reconcilia status da fatura
    await reconcileInvoiceStatus(input.invoiceId, clinicId, userId, client);

    await db.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1,'financial_payment',$2,'financial_payment.registered',$3,$4)`,
      [clinicId, paymentId,
        JSON.stringify({ invoice_id: input.invoiceId, amount: input.amount, method: input.method }),
        JSON.stringify({ user_id: userId, ip: ipOrigin })],
    );

    const r = await client.query<PaymentRow>(
      `SELECT * FROM financial.payments WHERE id = $1`,
      [paymentId],
    );
    return r.rows[0]!;
  });
}

// ─── Estorno ───────────────────────────────────────────────────────────────

export async function refundPayment(
  input:    RefundPaymentInput,
  clinicId: string,
  userId:   string,
  ipOrigin: string,
): Promise<PaymentRow> {
  return withClinicContext(clinicId, async (client) => {
    // Busca pagamento original com lock
    const origResult = await client.query<PaymentRow>(
      `SELECT * FROM financial.payments
        WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL
        FOR UPDATE`,
      [input.paymentId, clinicId],
    );

    const original = origResult.rows[0];
    if (!original) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Pagamento não encontrado.' });
    }
    if (original.payment_type !== 'pagamento') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Não é possível estornar um estorno.' });
    }
    // Verifica se já foi estornado
    const existingRefund = await client.query<{ id: string }>(
      `SELECT id FROM financial.payments
        WHERE refund_of_id = $1 AND payment_type = 'estorno' AND deleted_at IS NULL
        LIMIT 1`,
      [input.paymentId],
    );
    if (existingRefund.rows.length > 0) {
      throw new TRPCError({ code: 'CONFLICT', message: 'Este pagamento já possui um estorno registrado.' });
    }

    // Cria registro de estorno (amount positivo, type='estorno', subtraído no cálculo)
    const refundResult = await client.query<{ id: string }>(
      `INSERT INTO financial.payments
         (clinic_id, invoice_id, method, status, payment_type, amount,
          received_at, installments, refund_of_id, refund_reason,
          registered_by, ip_origin)
       VALUES ($1,$2,$3,'aprovado','estorno',$4,NOW(),1,$5,$6,$7,$8)
       RETURNING id`,
      [
        clinicId,
        original.invoice_id,
        original.method,
        original.amount,   // mesmo valor; type='estorno' indica subtração
        original.id,
        input.reason,
        userId,
        ipOrigin,
      ],
    );

    const refundId = refundResult.rows[0]!.id;

    // Subtrai do amount_paid na fatura
    await client.query(
      `UPDATE financial.invoices
          SET amount_paid = amount_paid - $3, updated_by = $4
        WHERE id = $1 AND clinic_id = $2`,
      [original.invoice_id, clinicId, original.amount, userId],
    );

    // Reconcilia status (pode voltar de 'paga' para 'parcial' ou 'emitida')
    await reconcileInvoiceRefundStatus(original.invoice_id, clinicId, userId, client);

    await db.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1,'financial_payment',$2,'financial_payment.refunded',$3,$4)`,
      [clinicId, refundId,
        JSON.stringify({ original_payment_id: input.paymentId, reason: input.reason }),
        JSON.stringify({ user_id: userId, ip: ipOrigin })],
    );

    const r = await client.query<PaymentRow>(
      `SELECT * FROM financial.payments WHERE id = $1`,
      [refundId],
    );
    return r.rows[0]!;
  });
}

// ─── Parcelamento ──────────────────────────────────────────────────────────

export async function createInstallments(
  input:    InstallmentsInput,
  clinicId: string,
  userId:   string,
  ipOrigin: string,
): Promise<PaymentRow[]> {
  return withClinicContext(clinicId, async (client) => {
    // Verifica configuração de max parcelas
    const cfg = await client.query<{ max_installments: number }>(
      `SELECT max_installments FROM financial.financial_config WHERE clinic_id = $1`,
      [clinicId],
    );
    const maxInstallments = cfg.rows[0]?.max_installments ?? 12;
    if (input.installments > maxInstallments) {
      throw new TRPCError({
        code:    'BAD_REQUEST',
        message: `Parcelamento máximo configurado é ${maxInstallments}x.`,
      });
    }

    const invResult = await client.query<{
      id: string; status: string; total_amount: number; amount_paid: number;
    }>(
      `SELECT id, status, total_amount, amount_paid
         FROM financial.invoices
        WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL
        FOR UPDATE`,
      [input.invoiceId, clinicId],
    );

    const invoice = invResult.rows[0];
    if (!invoice) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Fatura não encontrada.' });
    }
    if (!['emitida', 'parcial', 'vencida'].includes(invoice.status)) {
      throw new TRPCError({
        code:    'UNPROCESSABLE_CONTENT',
        message: `Parcelamento não disponível para fatura com status "${invoice.status}".`,
      });
    }

    const balance = invoice.total_amount - invoice.amount_paid;
    if (balance <= 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Fatura já quitada.' });
    }

    // Divide valor com ajuste de centavos na última parcela
    const n         = input.installments;
    const baseAmt   = Math.floor(balance / n);
    const remainder = balance - baseAmt * n;

    const createdPayments: PaymentRow[] = [];
    const firstDue = new Date(input.firstDueDate);

    for (let i = 1; i <= n; i++) {
      const amount  = i === n ? baseAmt + remainder : baseAmt;
      const dueDate = new Date(firstDue);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));

      const r = await client.query<PaymentRow>(
        `INSERT INTO financial.payments
           (clinic_id, invoice_id, method, status, payment_type, amount,
            installments, installment_number,
            registered_by, ip_origin)
         VALUES ($1,$2,$3,'pendente','pagamento',$4,
                 $5,$6,
                 $7,$8)
         RETURNING *`,
        [
          clinicId, input.invoiceId, input.method, amount,
          n, i,
          userId, ipOrigin,
        ],
      );
      createdPayments.push(r.rows[0]!);
    }

    await db.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1,'financial_invoice',$2,'financial_invoice.installments_created',$3,$4)`,
      [clinicId, input.invoiceId,
        JSON.stringify({ installments: n, method: input.method, total: balance }),
        JSON.stringify({ user_id: userId })],
    );

    return createdPayments;
  });
}

// ─── Mock Gateway ──────────────────────────────────────────────────────────

interface GatewayResult {
  id:         string;
  status:     'paid_mock';
  amount:     number;
  created_at: string;
}

async function mockGateway(
  method: string,
  amount: number,
): Promise<GatewayResult> {
  return {
    id:         `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status:     'paid_mock',
    amount,
    created_at: new Date().toISOString(),
  };
}

// ─── Status após estorno ────────────────────────────────────────────────────

async function reconcileInvoiceRefundStatus(
  invoiceId: string,
  clinicId:  string,
  userId:    string,
  client:    import('pg').PoolClient,
): Promise<void> {
  const r = await client.query<{
    total_amount: number; amount_paid: number; status: string;
  }>(
    `SELECT total_amount, amount_paid, status
       FROM financial.invoices
      WHERE id = $1 AND clinic_id = $2`,
    [invoiceId, clinicId],
  );
  const inv = r.rows[0];
  if (!inv) return;

  let newStatus: string;
  if (inv.amount_paid <= 0) {
    newStatus = 'emitida';
  } else if (inv.amount_paid < inv.total_amount) {
    newStatus = 'parcial';
  } else {
    return;
  }

  await client.query(
    `UPDATE financial.invoices
        SET status = $3, paid_at = NULL, updated_by = $4
      WHERE id = $1 AND clinic_id = $2 AND status = 'paga'`,
    [invoiceId, clinicId, newStatus, userId],
  );
}

// ─── Utils ─────────────────────────────────────────────────────────────────

function formatBRL(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style:    'currency',
    currency: 'BRL',
  }).format(centavos / 100);
}

interface MethodFields {
  cardBrand?:        string;
  cardLast4?:        string;
  cardInstallments?: number;
  pixTxid?:          string;
  boletoBarcode?:    string;
  convenioName?:     string;
  convenioGuide?:    string;
}

function extractMethodFields(input: RegisterPaymentInput): MethodFields {
  if (input.method === 'cartao_credito') {
    return {
      cardBrand:        (input as any).cardBrand,
      cardLast4:        (input as any).cardLast4,
      cardInstallments: (input as any).cardInstallments,
    };
  }
  if (input.method === 'cartao_debito') {
    return {
      cardBrand: (input as any).cardBrand,
      cardLast4: (input as any).cardLast4,
    };
  }
  if (input.method === 'pix') {
    return { pixTxid: (input as any).pixTxid };
  }
  if (input.method === 'boleto') {
    return { boletoBarcode: (input as any).boletoBarcode };
  }
  if (input.method === 'plano_saude') {
    return {
      convenioName:  (input as any).convenioName,
      convenioGuide: (input as any).convenioGuide,
    };
  }
  return {};
}
