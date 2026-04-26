'use client';

import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, cn } from '@dermaos/ui';
import { formatCurrencyCents, formatInt, formatPercent } from '../../_components/formatters';

export type Unit = 'currency' | 'percent' | 'count' | 'days';

interface KpiCardProps {
  label:    string;
  value:    number | null;
  trendPct: number | null;
  unit:     Unit;
  /** Quando true, tendência negativa é boa (ex: cancelamento). */
  invertTrend?: boolean;
  icon?:    ReactNode;
  hint?:    string;
}

function formatValue(value: number | null, unit: Unit): string {
  if (value === null) return '—';
  switch (unit) {
    case 'currency': return formatCurrencyCents(value);
    case 'percent':  return formatPercent(value);
    case 'count':    return formatInt(value);
    case 'days':     return `${formatInt(value)} dias`;
  }
}

export function KpiCard({
  label, value, trendPct, unit, invertTrend, icon, hint,
}: KpiCardProps) {
  const positive = trendPct !== null && (invertTrend ? trendPct < 0 : trendPct > 0);
  const negative = trendPct !== null && (invertTrend ? trendPct > 0 : trendPct < 0);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          {icon && <span className="text-muted-foreground" aria-hidden="true">{icon}</span>}
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums">
          {formatValue(value, unit)}
        </div>
        {trendPct !== null ? (
          <div
            className={cn(
              'mt-1 flex items-center gap-1 text-xs',
              positive && 'text-success-700',
              negative && 'text-danger-700',
              !positive && !negative && 'text-muted-foreground',
            )}
          >
            {positive && <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />}
            {negative && <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />}
            {!positive && !negative && <Minus className="h-3.5 w-3.5" aria-hidden="true" />}
            {trendPct > 0 ? '+' : ''}{trendPct.toFixed(1).replace('.', ',')}% vs período anterior
          </div>
        ) : (
          hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null
        )}
      </CardContent>
    </Card>
  );
}
