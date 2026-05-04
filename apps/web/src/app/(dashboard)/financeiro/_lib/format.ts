import {
  PAYMENT_METHOD_LABELS,
  INVOICE_STATUS_LABELS,
  type PaymentMethod,
  type InvoiceStatus,
} from '@dermaos/shared';
import type { BadgeVariant, IcoName } from '@dermaos/ui/ds';

export function fmtBRL(centavos: number | null | undefined): string {
  if (centavos == null) return '—';
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

export function fmtBRLFull(centavos: number | null | undefined): string {
  if (centavos == null) return '—';
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function fmtPct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function fmtShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace('.', '');
}

export function fmtFullDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} ${d
    .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoMonthStart(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

export function isoMonthEnd(date = new Date()): string {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return end.toISOString().slice(0, 10);
}

export function isoNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Brazilian-style currency mask for input text. */
export function parseCurrencyInput(raw: string): number {
  // strip everything but digits → integer cents
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10);
}

export function maskCurrencyInput(value: number): string {
  return (value / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function monthLabel(date = new Date()): string {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export function monthLabelShort(date = new Date()): string {
  return date
    .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    .replace('.', '');
}

export const STATUS_BADGE: Record<InvoiceStatus, BadgeVariant> = {
  rascunho:  'default',
  emitida:   'info',
  parcial:   'warning',
  paga:      'success',
  vencida:   'danger',
  cancelada: 'danger',
};

export function statusLabel(status: string): string {
  return INVOICE_STATUS_LABELS[status as InvoiceStatus] ?? status;
}

export function methodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method;
}

export const METHOD_ICON: Record<PaymentMethod, IcoName> = {
  dinheiro:       'creditCard',
  pix:            'zap',
  cartao_credito: 'creditCard',
  cartao_debito:  'creditCard',
  boleto:         'file',
  plano_saude:    'shield',
};

export const METHOD_DESCRIPTION: Record<PaymentMethod, string> = {
  dinheiro:       'Pagamento à vista, sem custo de transação',
  pix:            'Confirmação imediata · sem taxa',
  cartao_credito: 'Aceita parcelamento (até 12x)',
  cartao_debito:  'Compensação em D+1 · sem parcelamento',
  boleto:         'Compensação em até 3 dias úteis · custo R$ 1,99',
  plano_saude:    'Convênio / particular com cobrança via guia',
};

/** Group by helper for client-side aggregations. */
export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  return items.reduce<Record<K, T[]>>((acc, item) => {
    const k = keyFn(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

/** Number of days between two ISO dates (start, end). end inclusive. */
export function daysBetween(startIso: string, endIso: string): number {
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000) + 1);
}
