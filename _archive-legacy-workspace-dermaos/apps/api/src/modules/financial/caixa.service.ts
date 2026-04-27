import { withClinicContext } from '../../db/client.js';
import type { PaymentMethod } from '@dermaos/shared';

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface CaixaTransaction {
  id:             string;
  invoice_id:     string;
  invoice_number: string;
  patient_name:   string | null;
  method:         string;
  payment_type:   string;
  amount:         number;     // centavos
  received_at:    string;
  registered_by:  string | null;
}

export interface CaixaResult {
  date:            string;            // ISO date string no timezone da clínica
  totalGeral:      number;            // centavos (já subtraídos estornos)
  totalPorMetodo:  Record<string, number>;
  countTransacoes: number;
  transactions:    CaixaTransaction[];
}

// ─── Caixa do Dia ──────────────────────────────────────────────────────────

export async function getCaixaDoDia(
  clinicId: string,
  date?: Date,
): Promise<CaixaResult> {
  return withClinicContext(clinicId, async (client) => {
    // Recupera timezone da clínica
    const cfgResult = await client.query<{ timezone: string }>(
      `SELECT timezone FROM financial.financial_config WHERE clinic_id = $1`,
      [clinicId],
    );
    const timezone = cfgResult.rows[0]?.timezone ?? 'America/Sao_Paulo';

    // Determina a data alvo no timezone da clínica
    const targetDate = date
      ? date.toISOString().slice(0, 10)
      : await getClinicToday(timezone, client);

    // Busca todos os pagamentos/estornos do dia no timezone da clínica
    // Usa AT TIME ZONE para converter received_at para o timezone local antes de comparar
    const result = await client.query<CaixaTransaction & {
      signed_amount: string;
    }>(
      `SELECT
          p.id,
          p.invoice_id,
          COALESCE(i.invoice_number, '–') AS invoice_number,
          pt.name                          AS patient_name,
          p.method::text,
          p.payment_type,
          p.amount,
          CASE WHEN p.payment_type = 'estorno' THEN -p.amount ELSE p.amount END AS signed_amount,
          p.received_at,
          u.name AS registered_by
        FROM financial.payments p
        JOIN financial.invoices   i  ON i.id  = p.invoice_id
        JOIN shared.patients      pt ON pt.id = i.patient_id
   LEFT JOIN shared.users          u  ON u.id  = p.registered_by
       WHERE p.clinic_id = $1
         AND p.deleted_at IS NULL
         AND p.status     = 'aprovado'
         AND p.installment_number IS NULL  -- exclui parcelas pendentes
         AND (p.received_at AT TIME ZONE $2)::date = $3::date
       ORDER BY p.received_at DESC`,
      [clinicId, timezone, targetDate],
    );

    const transactions = result.rows;

    // Totais por método (pagamentos - estornos)
    const totalPorMetodo: Record<string, number> = {};
    let totalGeral = 0;

    for (const tx of transactions) {
      const signed = parseInt(String(tx.signed_amount), 10);
      totalGeral += signed;
      totalPorMetodo[tx.method] = (totalPorMetodo[tx.method] ?? 0) + signed;
    }

    return {
      date:            targetDate,
      totalGeral,
      totalPorMetodo,
      countTransacoes: transactions.length,
      transactions:    transactions.map((tx) => ({
        id:             tx.id,
        invoice_id:     tx.invoice_id,
        invoice_number: tx.invoice_number,
        patient_name:   tx.patient_name,
        method:         tx.method,
        payment_type:   tx.payment_type,
        amount:         tx.amount,
        received_at:    tx.received_at ?? '',
        registered_by:  tx.registered_by,
      })),
    };
  });
}

// ─── Helper: data de hoje no timezone da clínica ───────────────────────────

async function getClinicToday(
  timezone: string,
  client:   import('pg').PoolClient,
): Promise<string> {
  const r = await client.query<{ today: string }>(
    `SELECT (NOW() AT TIME ZONE $1)::date::text AS today`,
    [timezone],
  );
  return r.rows[0]?.today ?? new Date().toISOString().slice(0, 10);
}
