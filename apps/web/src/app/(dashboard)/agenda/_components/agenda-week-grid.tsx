'use client';

import * as React from 'react';
import { isSameDay } from 'date-fns';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@dermaos/ui';
import { Mono, T } from '@dermaos/ui/ds';
import {
  type Density,
  DENSITY,
  viewConfigFor,
  weekDays,
  positionFor,
  heightFor,
  totalSlots,
  slotLabels,
} from '@/lib/agenda-utils';
import { AppointmentCard } from './appointment-card';
import type { AppointmentCardData } from './appointment-detail-sheet';

const WDAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

/* ── Droppable day column cell ───────────────────────────────────────────── */

function DroppableCell({
  id,
  height,
  isHour,
  isSel,
}: {
  id: string;
  height: number;
  isHour: boolean;
  isSel: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'border-l border-t',
        isHour ? 'border-gray-200/80' : 'border-gray-100/50',
        isSel && 'bg-primary-50/30',
        isOver && 'bg-primary-100/40',
      )}
      style={{ height }}
    />
  );
}

/* ── Week Grid ───────────────────────────────────────────────────────────── */

interface AgendaWeekGridProps {
  weekStart: Date;
  appointments: AppointmentCardData[];
  selectedDate: Date;
  density: Density;
  onDaySelect: (d: Date) => void;
  onCardClick: (a: AppointmentCardData, ev?: React.MouseEvent) => void;
  onEmptyClick?: (start: Date) => void;
}

export function AgendaWeekGrid({
  weekStart,
  appointments,
  selectedDate,
  density,
  onDaySelect,
  onCardClick,
  onEmptyClick,
}: AgendaWeekGridProps) {
  const cfg = viewConfigFor(density);
  const days = React.useMemo(() => weekDays(weekStart), [weekStart]);
  const labels = slotLabels(cfg);
  const total = totalSlots(cfg);
  const gridHeight = total * cfg.pxPerSlot;
  const today = new Date();

  const byDay = React.useMemo(() => {
    const map = new Map<number, AppointmentCardData[]>();
    for (let i = 0; i < 7; i++) map.set(i, []);
    for (const a of appointments) {
      const d = new Date(a.scheduledAt);
      for (let i = 0; i < 7; i++) {
        if (isSameDay(d, days[i]!)) {
          map.get(i)!.push(a);
          break;
        }
      }
    }
    return map;
  }, [appointments, days]);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!scrollRef.current) return;
    const now = new Date();
    const top = positionFor(now, days[0]!, cfg);
    scrollRef.current.scrollTop = Math.max(0, top - 200);
  }, [days, cfg]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Day headers */}
      <div
        className="grid shrink-0"
        style={{
          gridTemplateColumns: '48px repeat(7, 1fr)',
          borderBottom: `1px solid ${T.divider}`,
        }}
      >
        <div />
        {days.map((d, i) => {
          const isSel = isSameDay(d, selectedDate);
          const isTod = isSameDay(d, today);
          const count = byDay.get(i)?.length ?? 0;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDaySelect(d)}
              className={cn(
                'py-2 text-center transition-colors border-l',
                isSel ? 'bg-primary-50' : 'hover:bg-gray-50/50',
              )}
              style={{ borderColor: T.divider }}
            >
              <p
                className="text-[9px] font-medium tracking-wider"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: isSel ? T.primary : T.textMuted,
                }}
              >
                {WDAY_LABELS[i]}
              </p>
              <p
                className={cn('text-base font-bold leading-tight', isTod && 'text-primary-700')}
                style={{ color: isTod ? T.primary : T.textPrimary }}
              >
                {d.getDate()}
              </p>
              {count > 0 && (
                <div className="flex justify-center gap-0.5 mt-1">
                  {[...Array(Math.min(count, 4))].map((_, j) => (
                    <div
                      key={j}
                      className="w-1 h-1 rounded-full"
                      style={{ background: isSel ? T.primary : T.divider }}
                    />
                  ))}
                  {count > 4 && (
                    <span className="text-[7px]" style={{ color: T.textMuted }}>+{count - 4}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="relative" style={{ minHeight: gridHeight }}>
          {/* Grid background (labels + cells) */}
          <div
            className="grid"
            style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}
          >
            {labels.map((slot, slotIdx) => (
              <React.Fragment key={slot.hhmm}>
                {/* Time label */}
                <div
                  className="text-right pr-2 -mt-1.5"
                  style={{ height: cfg.pxPerSlot }}
                >
                  {slot.isHour && <Mono size={9} color={T.textMuted}>{slot.hhmm}</Mono>}
                </div>
                {/* Day columns */}
                {days.map((d, dayIdx) => (
                  <DroppableCell
                    key={dayIdx}
                    id={`week-${dayIdx}-${slot.hhmm}`}
                    height={cfg.pxPerSlot}
                    isHour={slot.isHour}
                    isSel={isSameDay(d, selectedDate)}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>

          {/* Appointment cards overlaid */}
          {days.map((day, dayIdx) => {
            const dayAppts = byDay.get(dayIdx) ?? [];
            const colLeft = `calc(48px + ${dayIdx} * ((100% - 48px) / 7) + 2px)`;
            const colWidth = `calc((100% - 48px) / 7 - 4px)`;
            return dayAppts.map((ap) => {
              const apDate = new Date(ap.scheduledAt);
              const top = positionFor(apDate, day, cfg);
              const h = heightFor(ap.durationMin, cfg);
              return (
                <div
                  key={ap.id}
                  className="absolute z-[1]"
                  style={{
                    top,
                    left: colLeft,
                    width: colWidth,
                    height: Math.max(h, 20),
                  }}
                >
                  <AppointmentCard
                    appointment={ap}
                    onClick={onCardClick}
                    variant={h < 30 ? 'mini' : 'compact'}
                  />
                </div>
              );
            });
          })}
        </div>
      </div>
    </div>
  );
}
