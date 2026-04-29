'use client';

import { Mono, T } from '@dermaos/ui/ds';

interface AgendaWeekStripProps {
  /** Início da semana (segunda-feira). */
  weekStart: Date;
  /** Dia atualmente selecionado. */
  selected:  Date;
  /** Map dayOfWeek (0..6) → contagem de agendamentos. */
  counts:    Record<number, number>;
  onSelect:  (date: Date) => void;
}

const WDAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

export function AgendaWeekStrip({ weekStart, selected, counts, onSelect }: AgendaWeekStripProps) {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  return (
    <div
      style={{
        display: 'flex',
        padding: '8px 16px',
        borderBottom: `1px solid ${T.divider}`,
        gap: 4,
        flexShrink: 0,
      }}
    >
      {days.map((d, idx) => {
        const isSel = isSameDay(d, selected);
        const dots  = Math.min(7, counts[idx] ?? 0);
        return (
          <button
            key={d.toISOString()}
            type="button"
            onClick={() => onSelect(d)}
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: T.r.md,
              background: isSel ? T.primaryBg : 'transparent',
              border: isSel ? `1px solid ${T.primaryBorder}` : '1px solid transparent',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontSize: 9,
                fontFamily: "'IBM Plex Mono', monospace",
                color: isSel ? T.primary : T.textMuted,
              }}
            >
              {WDAY_LABELS[idx]}
            </p>
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: isSel ? T.primary : T.textPrimary,
              }}
            >
              {d.getDate()}
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 2,
                marginTop: 4,
                minHeight: 5,
              }}
            >
              {[...Array(dots)].map((_, j) => (
                <div
                  key={j}
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: '50%',
                    background: isSel ? T.primary : T.clinical.color,
                  }}
                />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
