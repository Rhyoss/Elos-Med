'use client';

import * as React from 'react';
import { Badge, Mono, T } from '@dermaos/ui/ds';
import type { AppointmentCardData } from './appointment-detail-sheet';

const HOURS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
];

interface AgendaTimelineProps {
  /** Lista de appointments para o dia (já filtrados). */
  appointments: AppointmentCardData[];
  /** Click handler para abrir o detail sheet. */
  onCardClick:  (a: AppointmentCardData) => void;
  /** Click em slot vazio para criar agendamento. */
  onEmptyClick?: (start: Date) => void;
  /** Data do dia (usada para criar Date completos no click empty). */
  date: Date;
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  scheduled:    'default',
  confirmed:    'success',
  waiting:      'warning',
  checked_in:   'success',
  in_progress:  'success',
  completed:    'default',
  cancelled:    'danger',
  no_show:      'warning',
};

const STATUS_LABEL: Record<string, string> = {
  scheduled:    'Agendado',
  confirmed:    'Confirmado',
  waiting:      'Aguardando',
  checked_in:   'Check-in',
  in_progress:  'Em sala',
  completed:    'Finalizado',
  cancelled:    'Cancelado',
  no_show:      'Falta',
};

/**
 * Deriva a "cor de módulo" do appointment a partir do tipo de procedimento.
 * Mapping conservador — types desconhecidos caem em "clinical".
 */
function moduleFor(type: string): keyof Pick<typeof T, 'clinical' | 'aiMod' | 'supply' | 'financial' | 'accentMod'> {
  if (type.includes('botox') || type.includes('procedimento') || type.includes('aplicac')) return 'supply';
  if (type.includes('ia') || type.includes('aurora') || type.includes('analise'))           return 'aiMod';
  return 'clinical';
}

function bucketHour(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getHours().toString().padStart(2, '0')}:00`;
}

function formatTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function AgendaTimeline({
  appointments,
  onCardClick,
  onEmptyClick,
  date,
}: AgendaTimelineProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', columnGap: 4 }}>
      {HOURS.map((h) => {
        const hourAppts = appointments.filter((a) => bucketHour(a.scheduledAt) === h);
        return (
          <React.Fragment key={h}>
            <div style={{ paddingTop: 6, paddingRight: 8, textAlign: 'right' }}>
              <Mono size={9}>{h}</Mono>
            </div>
            <div
              style={{
                borderTop: `1px solid ${T.divider}`,
                minHeight: 56,
                paddingBottom: 4,
                paddingLeft: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {hourAppts.length > 0 ? (
                hourAppts.map((ap) => {
                  const m = T[moduleFor(ap.type ?? ap.service?.name ?? '')];
                  const variant = STATUS_VARIANT[ap.status] ?? 'default';
                  const label   = STATUS_LABEL[ap.status]   ?? ap.status;
                  const heightPx = Math.max(50, (ap.durationMin ?? 30) * 0.9);
                  return (
                    <button
                      key={ap.id}
                      type="button"
                      onClick={() => onCardClick(ap)}
                      style={{
                        height: heightPx,
                        borderRadius: T.r.md,
                        padding: '8px 12px',
                        background: m.bg,
                        border: `1px solid ${m.color}18`,
                        borderLeft: `3px solid ${m.color}`,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 6,
                        }}
                      >
                        <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontSize: 12,
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
                              fontSize: 10,
                              color: T.textTertiary,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {ap.service?.name ?? ap.type}
                          </p>
                        </div>
                        <Badge variant={variant} dot={false}>
                          {label}
                        </Badge>
                      </div>
                      {(ap.durationMin ?? 30) > 40 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Mono size={8}>{formatTime(ap.scheduledAt)}</Mono>
                          <Mono size={8} color={m.color}>
                            {ap.provider?.name ? ap.provider.name.toUpperCase() : ''}
                          </Mono>
                        </div>
                      )}
                    </button>
                  );
                })
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!onEmptyClick) return;
                    const start = new Date(date);
                    const [hh, mm] = h.split(':').map(Number);
                    start.setHours(hh ?? 0, mm ?? 0, 0, 0);
                    onEmptyClick(start);
                  }}
                  disabled={!onEmptyClick}
                  style={{
                    height: 50,
                    borderRadius: T.r.md,
                    border: `1px dashed ${T.divider}`,
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 12,
                    cursor: onEmptyClick ? 'pointer' : 'default',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => {
                    if (onEmptyClick) (e.currentTarget.style.background = T.glass);
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Mono size={8} color={T.divider}>LIVRE</Mono>
                </button>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
