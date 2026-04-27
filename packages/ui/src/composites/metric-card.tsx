import * as React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../utils';
import { Card, CardContent } from '../primitives/card';

/* ── Sparkline SVG puro (sem deps externas) ──────────────────────────────── */

interface SparklineProps {
  data: number[];
  positive?: boolean;
  className?: string;
}

function Sparkline({ data, positive = true, className }: SparklineProps) {
  if (data.length < 2) return null;

  const width = 80;
  const height = 28;
  const padding = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const polyline = points.join(' ');
  const color = positive ? 'hsl(var(--success-500))' : 'hsl(var(--danger-500))';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={className}
    >
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Tipos ──────────────────────────────────────────────────────────────── */

export interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label?: string;
  };
  sparkline?: number[];
  href?: string;
  onClick?: () => void;
  className?: string;
  loading?: boolean;
}

/* ── Componente ──────────────────────────────────────────────────────────── */

export function MetricCard({
  label,
  value,
  icon,
  trend,
  sparkline,
  href,
  onClick,
  className,
  loading,
}: MetricCardProps) {
  const isPositive = trend ? trend.value >= 0 : true;

  const cardProps = href || onClick
    ? {
        variant: 'interactive' as const,
        role: href ? undefined : 'button',
        tabIndex: href ? undefined : 0,
        onClick,
        onKeyDown: onClick
          ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }
          : undefined,
      }
    : { variant: 'metric' as const };

  const content = (
    <Card className={cn('relative overflow-hidden', className)} {...cardProps}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2">
              {icon && (
                <span className="text-muted-foreground [&_svg]:size-4 shrink-0" aria-hidden="true">
                  {icon}
                </span>
              )}
              <span className="text-sm font-medium text-muted-foreground truncate">{label}</span>
            </div>

            {loading ? (
              <div className="h-8 w-24 animate-pulse rounded-md bg-muted" aria-hidden="true" />
            ) : (
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {value}
              </span>
            )}

            {trend && !loading && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs font-medium',
                  isPositive ? 'text-success-700' : 'text-danger-700',
                )}
                aria-label={`Variação: ${trend.value >= 0 ? '+' : ''}${trend.value}%${trend.label ? ` ${trend.label}` : ''}`}
              >
                {trend.value === 0 ? (
                  <Minus className="h-3 w-3" aria-hidden="true" />
                ) : isPositive ? (
                  <TrendingUp className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <TrendingDown className="h-3 w-3" aria-hidden="true" />
                )}
                <span>
                  {trend.value > 0 && '+'}
                  {trend.value}%
                  {trend.label && (
                    <span className="text-muted-foreground font-normal ml-1">{trend.label}</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {sparkline && sparkline.length >= 2 && !loading && (
            <div className="shrink-0 self-end">
              <Sparkline data={sparkline} positive={isPositive} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <a href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
        {content}
      </a>
    );
  }

  return content;
}
