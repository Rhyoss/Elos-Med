'use client';

import * as React from 'react';
import { Badge, Mono, T } from '@dermaos/ui/ds';
import type { AppointmentCardData } from './appointment-detail-sheet';

const HOURS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00',
];

const WDAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  scheduled:   'default',
  confirmed:   'success',
  waiting:     'warning',
  checked_in:  'success',
  in_progress: 'success',
  completed:   'default',
  cancelled:   'danger',
  no_show:     'warning',
};

const STATUS_LABEL: Record<string, string> = {
  scheduled:   'Agendado',
  confirmed:   'Confirmado',
  waiting:     'Aguardando',
  checked_in:  'Check-in',
  in_progress: 'Em sala',
  completed:   'Finalizado',
  cancelled:   'Cancelado',
  no_show:     'Falta',
};

function moduleFor(type: string): keyof Pick<typeof T, 'clinical' | 'aiMod' | 'supply' | 'financial' | 'accentMod'> {
  if (type.includes('botox') || type.includes('procedimento') || type.includes('aplicac')) return 'supply';
  if (type.includes('ia') || type.includes('aurora') || type.includes('analise')) return 'aiMod';
  return 'clinical';
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function bucketHour(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getHours().toString().padStart(2, '0')}:00`;
}

interface AgendaWeekGridProps {
  weekStart: Date;
  appointments: AppointmentCardData[];
  selectedDate: Date;
  onDaySelect: (d: Date) => void;
  onCardClick: (a: AppointmentCardData) => void;
  onEmptyClick?: (start: Date) => void;
}

export function AgendaWeekGrid({
  weekStart,
  appointments,
  selectedDate,
  onDaySelect,
  onCardClick,
  onEmptyClick,
}: AgendaWeekGridProps) {
  const days: Date[] = React.useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [weekStart]);

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

  const today = new Date();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Day headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '42px repeat(7, 1fr)',
          borderBottom: `1px solid ${T.divider}`,
          flexShrink: 0,
        }}
      >
        <div />
        {days.map((d, i) => {
          const isSel = isSameDay(d, selectedDate);
          const isToday = isSameDay(d, today);
          const count = byDay.get(i)?.length ?? 0;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDaySelect(d)}
              style={{
                padding: '7px 4px',
                textAlign: 'center',
                background: isSel ? T.primaryBg : 'transparent',
                borderTop: isSel ? `1px solid ${T.primaryBorder}` : '1px solid transparent',
                borderRight: isSel ? `1px solid ${T.primaryBorder}` : '1px solid transparent',
                borderBottom: isSel ? `1px solid ${T.primaryBorder}` : '1px solid transparent',
                borderLeft: `1px solid ${T.divider}`,
                borderRadius: 0,
                cursor: 'pointer',
              }}
            >
              <p
                style={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: isSel ? T.primary : T.textMuted,
                }}
              >
                {WDAY_LABELS[i]}
              </p>
              <p
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: isToday ? T.primary : T.textPrimary,
                  lineHeight: 1.3,
                }}
              >
                {d.getDate()}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 3, minHeight: 3 }}>
                {[...Array(Math.min(count, 5))].map((_, j) => (
                  <div
                    key={j}
                    style={{
                      width: 3,
                      height: 3,
                      borderRadius: '50%',
                      background: isSel ? T.primary : T.divider,
                    }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Time grid */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '42px repeat(7, 1fr)' }}>
          {HOURS.map((h) => (
            <React.Fragment key={h}>
              {/* Hour label */}
              <div style={{ paddingTop: 3, paddingRight: 6, textAlign: 'right', borderTop: `1px solid ${T.divider}` }}>
                <Mono size={9}>{h}</Mono>
              </div>

              {/* Day cells */}
              {days.map((d, dayIdx) => {
                const dayAppts = byDay.get(dayIdx) ?? [];
                const hourAppts = dayAppts.filter((a) => bucketHour(a.scheduledAt) === h);
                const isSel = isSameDay(d, selectedDate);

                return (
                  <div
                    key={dayIdx}
                    style={{
                      borderLeft: `1px solid ${T.divider}`,
                      borderTop: `1px solid ${T.divider}`,
                      padding: '2px 2px',
                      background: isSel ? `${T.primaryBg}` : 'transparent',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      minWidth: 0,
                      minHeight: 46,
                      overflow: 'hidden',
                    }}
                  >
                    {hourAppts.length > 0
                      ? hourAppts.map((ap) => {
                          const m = T[moduleFor(ap.type ?? ap.service?.name ?? '')];
                          const variant = STATUS_VARIANT[ap.status] ?? 'default';
                          const label = STATUS_LABEL[ap.status] ?? ap.status;
                          return (
                            <button
                              key={ap.id}
                              type="button"
                              onClick={() => onCardClick(ap)}
                              style={{
                                borderRadius: T.r.sm,
                                padding: '4px 5px',
                                background: m.bg,
                                borderTop: `1px solid ${m.color}18`,
                                borderRight: `1px solid ${m.color}18`,
                                borderBottom: `1px solid ${m.color}18`,
                                borderLeft: `3px solid ${m.color}`,
                                cursor: 'pointer',
                                textAlign: 'left',
                                width: '100%',
                                overflow: 'hidden',
                              }}
                            >
                              <p
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  color: T.textPrimary,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {ap.patient?.name ?? '—'}
                              </p>
                              <p
                                style={{
                                  fontSize: 8,
                                  color: T.textTertiary,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {formatTime(ap.scheduledAt)} · {ap.service?.name ?? ap.type}
                              </p>
                            </button>
                          );
                        })
                      : null}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
