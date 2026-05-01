'use client';

import * as React from 'react';
import { isSameDay } from 'date-fns';
import { cn } from '@dermaos/ui';
import { Mono, T } from '@dermaos/ui/ds';
import { monthGridDays, STATUS_DOT_COLOR } from '@/lib/agenda-utils';
import type { AppointmentCardData } from './appointment-detail-sheet';

const WDAY_LABELS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

interface AgendaMonthGridProps {
  year: number;
  month: number;
  appointments: AppointmentCardData[];
  selectedDate: Date;
  onDaySelect: (d: Date) => void;
  onCardClick?: (a: AppointmentCardData, ev?: React.MouseEvent) => void;
}

export function AgendaMonthGrid({
  year,
  month,
  appointments,
  selectedDate,
  onDaySelect,
  onCardClick,
}: AgendaMonthGridProps) {
  const cells = React.useMemo(() => monthGridDays(year, month), [year, month]);
  const today = new Date();

  const byDay = React.useMemo(() => {
    const map = new Map<string, AppointmentCardData[]>();
    for (const a of appointments) {
      const d = new Date(a.scheduledAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [appointments]);

  function statusCounts(appts: AppointmentCardData[]) {
    const counts: Record<string, number> = {};
    for (const a of appts) {
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    }
    return counts;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Weekday headers */}
      <div
        className="grid grid-cols-7 shrink-0"
        style={{ borderBottom: `1px solid ${T.divider}` }}
      >
        {WDAY_LABELS.map((w) => (
          <div key={w} className="text-center py-2">
            <Mono size={9} color={T.textMuted}>{w}</Mono>
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-hidden">
        {cells.map((cell, i) => {
          const key = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
          const dayAppts = byDay.get(key) ?? [];
          const isSel = isSameDay(cell.date, selectedDate);
          const isTod = isSameDay(cell.date, today);
          const counts = statusCounts(dayAppts);

          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => onDaySelect(cell.date)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onDaySelect(cell.date);
                }
              }}
              className={cn(
                'relative flex flex-col border-r border-b p-1.5 text-left transition-colors min-h-0 cursor-pointer outline-none',
                cell.outside && 'opacity-40',
                isSel && 'bg-primary-50/60',
                !isSel && !cell.outside && 'hover:bg-gray-50/50',
              )}
              style={{
                borderColor: T.divider,
              }}
            >
              {/* Day number */}
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'text-xs font-medium',
                    isTod && 'bg-primary-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                  )}
                  style={{
                    color: isTod ? undefined : isSel ? T.primary : T.textPrimary,
                  }}
                >
                  {cell.date.getDate()}
                </span>
                {dayAppts.length > 0 && (
                  <span
                    className="text-[9px] font-semibold px-1 py-0.5 rounded"
                    style={{ background: T.primaryBg, color: T.primary }}
                  >
                    {dayAppts.length}
                  </span>
                )}
              </div>

              {/* Appointment previews (max 3) */}
              <div className="flex flex-col gap-0.5 mt-1 overflow-hidden flex-1">
                {dayAppts.slice(0, 3).map((ap) => (
                  <button
                    key={ap.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onCardClick?.(ap, e); }}
                    className="text-left rounded px-1 py-0.5 truncate text-[10px] transition-colors hover:opacity-80"
                    style={{
                      background: `${STATUS_DOT_COLOR[ap.status] ?? T.divider}18`,
                      borderLeft: `2px solid ${STATUS_DOT_COLOR[ap.status] ?? T.divider}`,
                      color: T.textPrimary,
                    }}
                  >
                    <span className="font-medium">
                      {new Date(ap.scheduledAt).getHours().toString().padStart(2, '0')}:
                      {new Date(ap.scheduledAt).getMinutes().toString().padStart(2, '0')}
                    </span>
                    {' '}
                    {ap.patient?.name?.split(' ')[0] ?? '—'}
                  </button>
                ))}
                {dayAppts.length > 3 && (
                  <span className="text-[9px] pl-1" style={{ color: T.textMuted }}>
                    +{dayAppts.length - 3} mais
                  </span>
                )}
              </div>

              {/* Status dots */}
              {dayAppts.length > 0 && (
                <div className="flex items-center gap-0.5 mt-auto pt-0.5">
                  {Object.entries(counts).slice(0, 4).map(([status, count]) => (
                    <div
                      key={status}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: STATUS_DOT_COLOR[status] ?? T.divider }}
                      title={`${count} ${status}`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
