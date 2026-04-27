'use client';

import * as React from 'react';
import { TooltipRoot, TooltipContent, TooltipProvider, TooltipTrigger } from '@dermaos/ui';
import type { BodyRegion, LesionStatus } from '@dermaos/shared';
import { BODY_REGION_DEFS, regionLabel } from './body-regions';
import { cn } from '@/lib/utils';

interface RegionSummary {
  region: string;
  total:  number;
  byStatus: Record<LesionStatus, number>;
}

interface BodyMapProps {
  /** Mapa pré-agregado por região (aggregated on the server ou hook). */
  regionSummary:  Record<string, RegionSummary>;
  selected?:      string | null;
  onSelectRegion: (region: BodyRegion) => void;
  /** Se quiser habilitar "criar lesão aqui" em região vazia. */
  allowEmpty?:    boolean;
}

const STATUS_COLORS: Record<LesionStatus, string> = {
  active:     'fill-[var(--color-danger-500)]',
  monitoring: 'fill-[var(--color-warning-500)]',
  resolved:   'fill-[var(--color-success-500)]',
};

function dominantStatus(summary: RegionSummary | undefined): LesionStatus | null {
  if (!summary || summary.total === 0) return null;
  if (summary.byStatus.active     > 0) return 'active';
  if (summary.byStatus.monitoring > 0) return 'monitoring';
  return 'resolved';
}

function BodyMapView({
  view,
  regionSummary,
  selected,
  onSelectRegion,
  allowEmpty,
}: BodyMapProps & { view: 'front' | 'back' }) {
  const regions = React.useMemo(
    () => BODY_REGION_DEFS.filter((r) => r.view === view),
    [view],
  );

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full select-none"
      role="img"
      aria-label={`Body map — vista ${view === 'front' ? 'frontal' : 'posterior'}`}
    >
      {/* Silhueta simplificada — uma forma alongada que sugere o corpo */}
      <g className="text-muted-foreground/40" aria-hidden="true">
        {/* Cabeça */}
        <ellipse cx="50" cy="10" rx="8"  ry="9"   className="fill-current opacity-30" />
        {/* Tronco */}
        <rect    x="38" y="19" width="24" height="27" rx="6" className="fill-current opacity-30" />
        {/* Quadril */}
        <rect    x="39" y="43" width="22" height="10" rx="4" className="fill-current opacity-30" />
        {/* Braço esq + dir */}
        <rect    x="28" y="22" width="8"  height="30" rx="4" className="fill-current opacity-25" />
        <rect    x="64" y="22" width="8"  height="30" rx="4" className="fill-current opacity-25" />
        {/* Antebraço */}
        <rect    x="22" y="42" width="8"  height="18" rx="4" className="fill-current opacity-25" />
        <rect    x="70" y="42" width="8"  height="18" rx="4" className="fill-current opacity-25" />
        {/* Mão */}
        <ellipse cx="23" cy="56" rx="3"   ry="3.5" className="fill-current opacity-25" />
        <ellipse cx="77" cy="56" rx="3"   ry="3.5" className="fill-current opacity-25" />
        {/* Pernas */}
        <rect    x="40" y="52" width="8"  height="33" rx="4" className="fill-current opacity-25" />
        <rect    x="52" y="52" width="8"  height="33" rx="4" className="fill-current opacity-25" />
        {/* Pés */}
        <ellipse cx="44" cy="93" rx="3.5" ry="3"   className="fill-current opacity-25" />
        <ellipse cx="56" cy="93" rx="3.5" ry="3"   className="fill-current opacity-25" />
      </g>

      {/* Hit-targets por região */}
      <g>
        {regions.map((r) => {
          const summary  = regionSummary[r.key];
          const status   = dominantStatus(summary);
          const count    = summary?.total ?? 0;
          const isActive = selected === r.key;
          const hasLesions = count > 0;
          const clickable  = hasLesions || allowEmpty;
          const colorClass = status ? STATUS_COLORS[status] : 'fill-transparent';
          const pulse      = status === 'active' ? 'animate-pulse' : '';

          return (
            <TooltipProvider key={r.key} delayDuration={150}>
              <TooltipRoot>
                <TooltipTrigger asChild>
                  <g
                    role="button"
                    tabIndex={clickable ? 0 : -1}
                    aria-label={
                      hasLesions
                        ? `${r.label}: ${count} ${count === 1 ? 'lesão' : 'lesões'}`
                        : `${r.label}: nenhuma lesão${allowEmpty ? ', clique para adicionar' : ''}`
                    }
                    aria-pressed={isActive}
                    onClick={() => { if (clickable) onSelectRegion(r.key); }}
                    onKeyDown={(e) => {
                      if (!clickable) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectRegion(r.key);
                      }
                    }}
                    className={cn(
                      'outline-none',
                      clickable ? 'cursor-pointer' : 'cursor-default',
                      'focus-visible:[&>circle:first-of-type]:stroke-primary-500 focus-visible:[&>circle:first-of-type]:stroke-[0.7]',
                    )}
                  >
                    {/* Anel de hover/foco */}
                    <circle
                      cx={r.cx}
                      cy={r.cy}
                      r={r.r + 0.6}
                      className={cn(
                        'transition-all fill-transparent',
                        isActive
                          ? 'stroke-primary-500 stroke-[0.6]'
                          : hasLesions
                            ? 'stroke-foreground/10 stroke-[0.3]'
                            : 'stroke-transparent',
                      )}
                    />
                    {/* Marker */}
                    {hasLesions && (
                      <circle
                        cx={r.cx}
                        cy={r.cy}
                        r={r.r}
                        className={cn(colorClass, pulse, 'transition-opacity')}
                      />
                    )}
                    {/* Cluster numérico quando > 1 */}
                    {count > 1 && (
                      <text
                        x={r.cx}
                        y={r.cy}
                        dy="0.9"
                        textAnchor="middle"
                        className="fill-white text-[2.2px] font-semibold pointer-events-none"
                      >
                        {count > 99 ? '99+' : count}
                      </text>
                    )}
                  </g>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  <div className="font-medium">{r.label}</div>
                  {hasLesions ? (
                    <div className="mt-0.5 text-muted-foreground">
                      {count} {count === 1 ? 'lesão' : 'lesões'}
                    </div>
                  ) : (
                    <div className="mt-0.5 text-muted-foreground">Sem lesões</div>
                  )}
                </TooltipContent>
              </TooltipRoot>
            </TooltipProvider>
          );
        })}
      </g>
    </svg>
  );
}

export function BodyMap(props: BodyMapProps) {
  const [view, setView] = React.useState<'front' | 'back'>('front');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setView('front')}
          className={cn(
            'px-3 py-1.5 text-sm rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            view === 'front'
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-card text-foreground border-border hover:bg-hover',
          )}
          aria-pressed={view === 'front'}
        >
          Frente
        </button>
        <button
          type="button"
          onClick={() => setView('back')}
          className={cn(
            'px-3 py-1.5 text-sm rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            view === 'back'
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-card text-foreground border-border hover:bg-hover',
          )}
          aria-pressed={view === 'back'}
        >
          Costas
        </button>
      </div>

      <div className="relative mx-auto w-full max-w-[320px] aspect-[1/1.6] bg-background rounded-lg border border-border">
        <BodyMapView {...props} view={view} />
      </div>

      <div className="flex justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-danger-500)]" />
          Ativa
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-warning-500)]" />
          Monitoramento
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-success-500)]" />
          Resolvida
        </div>
      </div>
    </div>
  );
}

export function aggregateLesionsByRegion(
  lesions: Array<{ bodyRegion: string; status: LesionStatus }>,
): Record<string, RegionSummary> {
  const out: Record<string, RegionSummary> = {};
  for (const l of lesions) {
    const existing = out[l.bodyRegion] ?? {
      region: l.bodyRegion,
      total:  0,
      byStatus: { active: 0, monitoring: 0, resolved: 0 },
    };
    existing.total += 1;
    existing.byStatus[l.status] += 1;
    out[l.bodyRegion] = existing;
  }
  return out;
}

export { regionLabel };
