'use client';

import * as React from 'react';
import { cn } from '@dermaos/ui';
import { Badge, Glass, Ico, Mono, T } from '@dermaos/ui/ds';
import {
  isDelayed,
  delayMinutes,
  type FreeSlot,
} from '@/lib/agenda-utils';
import type { AppointmentCardData } from './appointment-detail-sheet';

/* ── Queue entry type ────────────────────────────────────────────────────── */

export interface QueueEntry {
  appointmentId: string;
  patientName: string;
  waitingSinceMin: number;
  status: string;
}

interface AgendaRightPanelProps {
  queueEntries: QueueEntry[];
  appointments: AppointmentCardData[];
  nextFree: FreeSlot | null;
  onEntryClick?: (apptId: string) => void;
  onNewAppointment?: () => void;
}

export function AgendaRightPanel({
  queueEntries,
  appointments,
  nextFree,
  onEntryClick,
  onNewAppointment,
}: AgendaRightPanelProps) {
  const delayedAppts = React.useMemo(
    () =>
      appointments.filter((a) => isDelayed(a.scheduledAt, a.status)).sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      ),
    [appointments],
  );

  return (
    <aside
      className="flex flex-col gap-2.5 shrink-0 overflow-y-auto px-2.5 py-3"
      style={{
        width: 190,
        borderLeft: `1px solid ${T.divider}`,
      }}
    >
      {/* Queue */}
      <section>
        <Mono size={8} spacing="1.2px">FILA DE ESPERA</Mono>
        <div className="flex flex-col gap-1.5 mt-2">
          {queueEntries.length === 0 ? (
            <div
              className="text-center py-3 rounded-md"
              style={{
                background: T.glass,
                border: `1px dashed ${T.glassBorder}`,
              }}
            >
              <Ico name="check" size={16} color={T.textMuted} />
              <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>
                Nenhum paciente em espera.
              </p>
            </div>
          ) : (
            queueEntries.map((q) => (
              <button
                key={q.appointmentId}
                type="button"
                onClick={() => onEntryClick?.(q.appointmentId)}
                className="w-full text-left border-none bg-transparent p-0 cursor-pointer"
              >
                <Glass style={{ padding: '8px 10px', borderRadius: T.r.md }}>
                  <p
                    className="text-[11px] font-semibold truncate mb-1"
                    style={{ color: T.textPrimary }}
                  >
                    {q.patientName}
                  </p>
                  <div className="flex justify-between items-center">
                    <Mono size={8}>
                      {q.waitingSinceMin} min
                    </Mono>
                    <Badge
                      variant={q.status === 'in_progress' ? 'success' : 'warning'}
                      dot={false}
                    >
                      {q.status === 'in_progress' ? 'Em sala' : 'Espera'}
                    </Badge>
                  </div>
                </Glass>
              </button>
            ))
          )}
        </div>
      </section>

      {/* Delayed */}
      {delayedAppts.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5">
            <Mono size={8} spacing="1.2px" color="#ef4444">ATRASADOS</Mono>
            <span
              className="text-[9px] font-bold px-1 py-0.5 rounded"
              style={{ background: '#fef2f2', color: '#ef4444' }}
            >
              {delayedAppts.length}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            {delayedAppts.slice(0, 5).map((ap) => {
              const mins = delayMinutes(ap.scheduledAt);
              return (
                <button
                  key={ap.id}
                  type="button"
                  onClick={() => onEntryClick?.(ap.id)}
                  className="w-full text-left p-0 border-none bg-transparent cursor-pointer"
                >
                  <div
                    className="rounded-md px-2.5 py-2 border-l-2"
                    style={{
                      borderLeftColor: '#ef4444',
                      background: '#fef2f2',
                    }}
                  >
                    <p className="text-[11px] font-semibold truncate" style={{ color: T.textPrimary }}>
                      {ap.patient?.name ?? '—'}
                    </p>
                    <div className="flex justify-between items-center mt-0.5">
                      <Mono size={8} color="#ef4444">
                        +{mins}min
                      </Mono>
                      <Mono size={8}>
                        {new Date(ap.scheduledAt).getHours().toString().padStart(2, '0')}:
                        {new Date(ap.scheduledAt).getMinutes().toString().padStart(2, '0')}
                      </Mono>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Next free slot */}
      {nextFree && (
        <section className="mt-auto">
          <Glass
            style={{
              padding: '10px',
              borderRadius: T.r.md,
              background: T.primaryBg,
              border: `1px solid ${T.primaryBorder}`,
            }}
          >
            <Mono size={8} color={T.primary} spacing="0.8px">
              PRÓXIMO LIVRE
            </Mono>
            <p className="text-base font-bold mt-1" style={{ color: T.textPrimary }}>
              {nextFree.time}
            </p>
            <p className="text-[10px]" style={{ color: T.textMuted }}>
              {nextFree.durationMin} min disponíveis
            </p>
            <button
              type="button"
              onClick={onNewAppointment}
              className="w-full mt-2 text-[11px] font-medium py-1 rounded transition-colors hover:opacity-80"
              style={{
                background: T.primary,
                color: '#fff',
              }}
            >
              Agendar neste horário
            </button>
          </Glass>
        </section>
      )}
    </aside>
  );
}
