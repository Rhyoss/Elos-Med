import * as React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../utils';
import { Card, CardContent } from '../primitives/card';

/* ── Sparkline SVG puro com gradiente sutil ──────────────────────────────── */

interface SparklineProps {
  data: number[];
  positive?: boolean;
  className?: string;
}

function Sparkline({ data, positive = true, className }: SparklineProps) {
  const id = React.useId();
  if (data.length < 2) return null;

  const width = 88;
  const height = 32;
  const padding = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return [x, y] as const;
  });

  const polyline = points.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `${padding},${height} ${polyline} ${width - padding},${height}`;
  const color = positive ? 'hsl(var(--success-500))' : 'hsl(var(--danger-500))';
  const last = points[points.length - 1] ?? [0, 0];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#spark-${id})`} />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2" fill={color} />
    </svg>
  );
}

/* ── Tipos ──────────────────────────────────────────────────────────────── */

export interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  /** Domínio do KPI — afeta cor do ícone e accent */
  domain?: 'primary' | 'clinical' | 'financial' | 'supply' | 'ai' | 'gold' | 'neutral';
  trend?: {
    value: number;
    label?: string;
  };
  /** Pequena descrição abaixo do valor */
  hint?: string;
  sparkline?: number[];
  href?: string;
  onClick?: () => void;
  className?: string;
  loading?: boolean;
  /** Inverte a leitura de tendência (para métricas onde menor é melhor, ex.: no-show) */
  invertTrend?: boolean;
}

const domainIconClass: Record<NonNullable<MetricCardProps['domain']>, string> = {
  primary:   'bg-primary-100 text-primary-700 dark:bg-primary-100/10',
  clinical:  'bg-clinical-100 text-clinical-700 dark:bg-clinical-100/10',
  financial: 'bg-financial-100 text-financial-700 dark:bg-financial-100/10',
  supply:    'bg-supply-100 text-supply-700 dark:bg-supply-100/10',
  ai:        'bg-ai-100 text-ai-700 dark:bg-ai-100/10',
  gold:      'bg-gold-100 text-gold-700 dark:bg-gold-100/10',
  neutral:   'bg-muted text-muted-foreground',
};

/* ── Componente ──────────────────────────────────────────────────────────── */

export function MetricCard({
  label,
  value,
  icon,
  domain = 'neutral',
  trend,
  hint,
  sparkline,
  href,
  onClick,
  className,
  loading,
  invertTrend = false,
}: MetricCardProps) {
  const trendVal = trend?.value ?? 0;
  const isUp = trendVal > 0;
  const isDown = trendVal < 0;
  const isFlat = trendVal === 0;
  const isPositive = invertTrend ? isDown : isUp;

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

  const trendColor = isFlat
    ? 'bg-muted text-muted-foreground'
    : isPositive
      ? 'bg-success-100 text-success-700'
      : 'bg-danger-100 text-danger-700';

  const content = (
    <Card className={cn('relative overflow-hidden', className)} {...cardProps}>
      <CardContent className="p-5 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-3 min-w-0 flex-1">
            <div className="flex items-center gap-3">
              {icon && (
                <span
                  className={cn('domain-icon [&_svg]:size-4', domainIconClass[domain])}
                  aria-hidden="true"
                >
                  {icon}
                </span>
              )}
              <span className="text-sm font-medium text-muted-foreground truncate">{label}</span>
            </div>

            {loading ? (
              <div className="h-8 w-24 animate-pulse rounded-md bg-muted" aria-hidden="true" />
            ) : (
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl font-bold text-foreground nums-tabular leading-none tracking-tight">
                  {value}
                </span>
                {trend && !loading && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold nums-tabular',
                      trendColor,
                    )}
                    aria-label={`Variação: ${trendVal >= 0 ? '+' : ''}${trendVal}%${trend.label ? ` ${trend.label}` : ''}`}
                  >
                    {isFlat ? <Minus className="h-3 w-3" aria-hidden="true" />
                      : isUp ? <TrendingUp className="h-3 w-3" aria-hidden="true" />
                      : <TrendingDown className="h-3 w-3" aria-hidden="true" />}
                    <span>{trendVal > 0 ? '+' : ''}{trendVal}%</span>
                  </span>
                )}
              </div>
            )}

            {hint && !loading && (
              <span className="text-xs text-muted-foreground">{hint}</span>
            )}
            {trend?.label && !loading && (
              <span className="text-xs text-muted-foreground">{trend.label}</span>
            )}
          </div>

          {sparkline && sparkline.length >= 2 && !loading && (
            <div className="shrink-0 self-end -mb-1">
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
