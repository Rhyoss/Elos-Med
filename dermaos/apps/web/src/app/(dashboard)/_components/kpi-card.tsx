'use client';

import * as React from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Card, CardContent, cn } from '@dermaos/ui';
import {
  formatCurrencyCents,
  formatInt,
  formatPercent,
  formatTrend,
} from './formatters';

export interface KpiCardProps {
  label:    string;
  value:    number | null;
  trendPct: number | null;
  unit:     'currency' | 'percent' | 'count';
  icon?:    React.ReactNode;
  emptyHint?: string;
  /** indica que este KPI pode estar oculto por permissão (ex.: financeiro) */
  hidden?:  boolean;
  /** "lower is better" — inverte cor de tendência, p.ex. no-show */
  invertTrend?: boolean;
}

function renderValue(value: number | null, unit: KpiCardProps['unit']): string {
  if (value === null) return '—';
  if (unit === 'currency') return formatCurrencyCents(value);
  if (unit === 'percent')  return formatPercent(value);
  return formatInt(value);
}

export function KpiCard({
  label,
  value,
  trendPct,
  unit,
  icon,
  emptyHint,
  hidden,
  invertTrend = false,
}: KpiCardProps) {
  if (hidden) {
    return (
      <Card className="bg-muted/40">
        <CardContent className="p-5 flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <span className="text-sm text-muted-foreground italic">Sem permissão para visualizar</span>
        </CardContent>
      </Card>
    );
  }

  const isPositive = trendPct === null || trendPct === 0
    ? null
    : invertTrend
      ? trendPct < 0
      : trendPct > 0;

  return (
    <Card>
      <CardContent className="p-5 flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon && (
            <span className="[&_svg]:size-4 shrink-0" aria-hidden="true">{icon}</span>
          )}
          <span className="truncate">{label}</span>
        </div>
        <span
          className="text-2xl font-bold text-foreground tabular-nums"
          aria-label={`${label}: ${renderValue(value, unit)}`}
        >
          {renderValue(value, unit)}
        </span>
        {value === null && emptyHint && (
          <span className="text-xs text-muted-foreground">{emptyHint}</span>
        )}
        {trendPct !== null && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              isPositive === null
                ? 'text-muted-foreground'
                : isPositive
                  ? 'text-success-700'
                  : 'text-danger-700',
            )}
            aria-label={`Variação vs período anterior: ${formatTrend(trendPct)}`}
          >
            {isPositive === null ? (
              <Minus className="h-3 w-3" aria-hidden="true" />
            ) : isPositive ? (
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-3 w-3" aria-hidden="true" />
            )}
            <span>{formatTrend(trendPct)}</span>
            <span className="text-muted-foreground font-normal ml-1">vs período anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
