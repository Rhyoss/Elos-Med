/**
 * Formatters comuns aos dashboards.
 * Money em centavos (BIGINT do backend) → BRL.
 * Percent em fração (0..1) → "%".
 */

export function formatCurrencyCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatPercent(rate: number | null | undefined, digits = 1): string {
  if (rate === null || rate === undefined) return '—';
  return `${(rate * 100).toFixed(digits).replace('.', ',')}%`;
}

export function formatInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('pt-BR').format(n);
}

export function formatTrend(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return '';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1).replace('.', ',')}%`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export const APPT_TYPE_LABELS: Record<string, string> = {
  consultation:    'Consulta',
  return:          'Retorno',
  procedure:       'Procedimento',
  aesthetic:       'Estético',
  surgery:         'Cirurgia',
  evaluation:      'Avaliação',
  follow_up:       'Acompanhamento',
};

export function apptTypeLabel(type: string): string {
  return APPT_TYPE_LABELS[type] ?? type;
}
