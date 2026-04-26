/**
 * Lógica pura de seleção FEFO (First-Expired First-Out).
 * Sem dependência de banco — permite testes unitários determinísticos.
 */

export interface LotForFefo {
  id: string;
  lot_number: string;
  expiry_date: string | null; // ISO date 'YYYY-MM-DD' ou null (sem vencimento)
  quantity_current: number;
  status: string;             // apenas 'active' é elegível
  product_id: string;
}

export interface FefoAllocation {
  lotId: string;
  lotNumber: string;
  expiryDate: string | null;
  take: number;
}

export interface FefoResult {
  plan: FefoAllocation[];
  insufficient_stock: boolean;
  qty_available: number; // total disponível nos lotes elegíveis
  shortage: number;      // quanto falta para atender qty_requested
  qty_requested: number;
}

export class FefoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FefoValidationError';
  }
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

function compareLots(a: LotForFefo, b: LotForFefo): number {
  // Sem vencimento vai para o final (NULLS LAST)
  if (a.expiry_date === null && b.expiry_date === null) {
    return a.lot_number.localeCompare(b.lot_number, 'pt-BR');
  }
  if (a.expiry_date === null) return 1;
  if (b.expiry_date === null) return -1;
  if (a.expiry_date !== b.expiry_date) {
    return a.expiry_date.localeCompare(b.expiry_date);
  }
  // Desempate por lot_number ASC
  return a.lot_number.localeCompare(b.lot_number, 'pt-BR');
}

/**
 * Seleciona lotes em ordem FEFO para atender `qtyRequested` unidades.
 *
 * Critérios de elegibilidade:
 *  - status === 'active'
 *  - quantity_current > 0
 *  - expiry_date === null OU expiry_date >= today
 *
 * Ordenação: expiry_date ASC NULLS LAST, desempate por lot_number ASC.
 *
 * @param allLots  Todos os lotes do produto (qualquer status/qty).
 * @param qtyRequested Quantidade a ser retirada. Negativa → FefoValidationError.
 * @param today    Data de referência para validar vencimento (default: hoje).
 */
export function selectLotFEFO(
  allLots: LotForFefo[],
  qtyRequested: number,
  today: Date = new Date(),
): FefoResult {
  if (qtyRequested < 0) {
    throw new FefoValidationError(
      `Quantidade solicitada inválida: ${qtyRequested}. Deve ser ≥ 0.`,
    );
  }

  if (qtyRequested === 0) {
    return {
      plan: [],
      insufficient_stock: false,
      qty_available: 0,
      shortage: 0,
      qty_requested: 0,
    };
  }

  const todayStr = toDateStr(today);

  const eligible = allLots.filter(
    (lot) =>
      lot.status === 'active' &&
      lot.quantity_current > 0 &&
      (lot.expiry_date === null || lot.expiry_date >= todayStr),
  );

  const sorted = [...eligible].sort(compareLots);

  const qtyAvailable = sorted.reduce((sum, lot) => sum + lot.quantity_current, 0);

  const plan: FefoAllocation[] = [];
  let remaining = qtyRequested;

  for (const lot of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, lot.quantity_current);
    plan.push({ lotId: lot.id, lotNumber: lot.lot_number, expiryDate: lot.expiry_date, take });
    remaining -= take;
  }

  const insufficient = remaining > 0;

  return {
    plan,
    insufficient_stock: insufficient,
    qty_available: qtyAvailable,
    shortage: Math.max(0, remaining),
    qty_requested: qtyRequested,
  };
}
