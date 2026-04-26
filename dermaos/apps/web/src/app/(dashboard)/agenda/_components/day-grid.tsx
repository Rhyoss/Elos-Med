'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { cn } from '@dermaos/ui';
import {
  DEFAULT_VIEW,
  heightFor,
  positionFor,
  slotLabels,
  STATUS_BG,
  STATUS_BORDER,
  STATUS_LABEL,
  totalSlots,
  formatSlotRange,
  type AgendaViewConfig,
} from '@/lib/agenda-utils';
import type { AppointmentCardData } from './appointment-detail-sheet';

interface Provider {
  id:   string;
  name: string;
}

interface Break {
  startHhmm: string;
  endHhmm:   string;
}

interface Props {
  date:          Date;
  providers:     Provider[];
  appointments:  AppointmentCardData[];
  breaksByProvider?: Record<string, Break[]>;
  onCardClick:   (a: AppointmentCardData) => void;
  onEmptyClick:  (providerId: string, start: Date) => void;
  view?:         AgendaViewConfig;
}

function parseHhmmOn(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const d = new Date(date);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

export function DayGrid({
  date,
  providers,
  appointments,
  breaksByProvider = {},
  onCardClick,
  onEmptyClick,
  view = DEFAULT_VIEW,
}: Props) {
  const rowCount = totalSlots(view);
  const gridHeight = rowCount * view.pxPerSlot;

  const byProvider = useMemo(() => {
    const map = new Map<string, AppointmentCardData[]>();
    for (const p of providers) map.set(p.id, []);
    for (const a of appointments) {
      const arr = map.get(a.providerId);
      if (arr) arr.push(a);
    }
    return map;
  }, [appointments, providers]);

  const labels = slotLabels(view);

  return (
    <div className="relative w-full overflow-auto border rounded-lg bg-card">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `80px repeat(${providers.length}, minmax(220px, 1fr))`,
        }}
      >
        {/* Header — hora + médicos */}
        <div className="sticky top-0 z-20 bg-card border-b border-r px-2 py-2 text-xs font-semibold text-muted-foreground">
          Hora
        </div>
        {providers.map((p) => (
          <div
            key={p.id}
            className="sticky top-0 z-20 bg-card border-b border-r last:border-r-0 px-3 py-2 text-sm font-semibold text-foreground"
          >
            {p.name}
          </div>
        ))}

        {/* Coluna de horários */}
        <div className="border-r" style={{ height: gridHeight }}>
          {labels.map((l, i) => (
            <div
              key={i}
              className={cn(
                'flex items-start justify-end pr-2 text-[11px] text-muted-foreground',
                l.isHour ? 'font-medium text-foreground' : 'opacity-60',
              )}
              style={{ height: view.pxPerSlot, lineHeight: `${view.pxPerSlot}px` }}
            >
              {l.isHour ? l.hhmm : ''}
            </div>
          ))}
        </div>

        {/* Uma coluna por provider */}
        {providers.map((provider) => {
          const providerAppointments = byProvider.get(provider.id) ?? [];
          const breaks = breaksByProvider[provider.id] ?? [];

          return (
            <div
              key={provider.id}
              className="relative border-r last:border-r-0"
              style={{ height: gridHeight }}
            >
              {/* Linhas de grade e slots clicáveis */}
              {labels.map((l, i) => {
                const slotStart = parseHhmmOn(date, l.hhmm);
                const isOccupied = providerAppointments.some((a) => {
                  const start = new Date(a.scheduledAt);
                  const end   = new Date(start.getTime() + a.durationMin * 60_000);
                  return slotStart >= start && slotStart < end;
                });
                const inBreak = breaks.some((b) => {
                  const bs = parseHhmmOn(date, b.startHhmm);
                  const be = parseHhmmOn(date, b.endHhmm);
                  return slotStart >= bs && slotStart < be;
                });

                return (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Novo agendamento às ${l.hhmm} para ${provider.name}`}
                    disabled={isOccupied || inBreak}
                    onClick={() => onEmptyClick(provider.id, slotStart)}
                    className={cn(
                      'absolute inset-x-0 border-b border-border/50 disabled:cursor-default',
                      l.isHour ? 'border-border' : 'border-border/30',
                      !isOccupied && !inBreak && 'hover:bg-hover/60',
                      inBreak && 'bg-muted/60 cursor-not-allowed',
                    )}
                    style={{
                      top:      i * view.pxPerSlot,
                      height:   view.pxPerSlot,
                      backgroundImage: inBreak
                        ? 'repeating-linear-gradient(45deg, transparent 0 4px, rgba(0,0,0,0.04) 4px 8px)'
                        : undefined,
                    }}
                  />
                );
              })}

              {/* Cards sobrepostos */}
              {providerAppointments.map((a) => {
                const start = new Date(a.scheduledAt);
                const end   = new Date(start.getTime() + a.durationMin * 60_000);
                const top   = positionFor(start, date, view);
                const h     = heightFor(a.durationMin, view);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onCardClick(a)}
                    className={cn(
                      'absolute left-1 right-1 rounded-md border-l-4 border border-border/60 shadow-sm',
                      'px-2 py-1 text-left text-xs overflow-hidden hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      STATUS_BORDER[a.status] ?? 'border-l-slate-300',
                      STATUS_BG[a.status] ?? 'bg-card',
                    )}
                    style={{ top, height: Math.max(h - 2, 24) }}
                    aria-label={`${a.patient.name} — ${STATUS_LABEL[a.status] ?? a.status} ${format(start, 'HH:mm')}`}
                  >
                    <div className="font-semibold leading-tight truncate">
                      {format(start, 'HH:mm')} {a.patient.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {a.service?.name ?? a.type} • {formatSlotRange(start, end)}
                    </div>
                    {a.patient.allergiesCount > 0 && (
                      <div className="text-[10px] font-semibold text-danger-700 truncate mt-0.5">
                        ⚠ {a.patient.allergiesSummary}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
