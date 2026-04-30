'use client';

import * as React from 'react';
import { Ico, Mono, T } from '@dermaos/ui/ds';

interface MiniCalendarProps {
  /** Mês a renderizar */
  date:        Date;
  /** Dia atualmente selecionado (yyyy-mm-dd) */
  selected:    Date;
  /** Conjunto de dias do mês com agendamentos (1..31) */
  apptDays:    Set<number>;
  onDayClick:  (newDate: Date) => void;
  onMonthChange: (delta: number) => void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril',
  'Maio', 'Junho', 'Julho', 'Agosto',
  'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const WDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export function MiniCalendar({
  date,
  selected,
  apptDays,
  onDayClick,
  onMonthChange,
}: MiniCalendarProps) {
  const year  = date.getFullYear();
  const month = date.getMonth();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDay = isCurrentMonth ? today.getDate() : -1;

  const isSelectedMonth = selected.getFullYear() === year && selected.getMonth() === month;
  const selectedDay = isSelectedMonth ? selected.getDate() : -1;

  const firstDay     = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const prevDays     = new Date(year, month, 0).getDate();

  const cells: Array<{ day: number; outside: boolean }> = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: prevDays - firstDay + 1 + i, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, outside: false });
  }
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, outside: true });
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <button
          type="button"
          onClick={() => onMonthChange(-1)}
          aria-label="Mês anterior"
          style={{
            width: 22,
            height: 22,
            borderRadius: T.r.sm,
            background: T.glass,
            border: `1px solid ${T.glassBorder}`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ico name="arrowLeft" size={10} color={T.textMuted} />
        </button>
        <Mono size={9} spacing="0.8px" color={T.textPrimary}>
          {MONTH_NAMES[month]?.toUpperCase()} {year}
        </Mono>
        <button
          type="button"
          onClick={() => onMonthChange(1)}
          aria-label="Próximo mês"
          style={{
            width: 22,
            height: 22,
            borderRadius: T.r.sm,
            background: T.glass,
            border: `1px solid ${T.glassBorder}`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ico name="arrowRight" size={10} color={T.textMuted} />
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 1,
          marginBottom: 4,
        }}
      >
        {WDAYS.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', padding: '3px 0' }}>
            <Mono size={7} color={i === 0 ? T.danger : T.textMuted}>
              {w}
            </Mono>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {cells.map((c, i) => {
          const isSel   = !c.outside && c.day === selectedDay;
          const isToday = !c.outside && c.day === todayDay;
          const hasAppt = !c.outside && apptDays.has(c.day);

          return (
            <button
              key={i}
              type="button"
              onClick={() => !c.outside && onDayClick(new Date(year, month, c.day))}
              disabled={c.outside}
              style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: T.r.sm,
                border: isSel
                  ? `1.5px solid ${T.primary}`
                  : isToday
                  ? `1px solid ${T.primaryBorder}`
                  : '1px solid transparent',
                background: isSel
                  ? T.primaryBg
                  : isToday
                  ? T.glass
                  : 'transparent',
                cursor: c.outside ? 'default' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                transition: 'all 0.12s',
                padding: 0,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: isSel || isToday ? 700 : 400,
                  color: c.outside
                    ? T.divider
                    : isSel
                    ? T.primary
                    : isToday
                    ? T.primary
                    : T.textPrimary,
                  fontFamily: "'IBM Plex Sans', sans-serif",
                }}
              >
                {c.day}
              </span>
              {hasAppt && !c.outside && (
                <div
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: '50%',
                    background: isSel ? T.primary : T.clinical.color,
                    flexShrink: 0,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
