'use client';

import { Badge, Glass, Ico, Mono, T } from '@dermaos/ui/ds';

export interface QueueEntry {
  appointmentId: string;
  patientName:   string;
  waitingSinceMin: number;
  status:        string;
}

interface AgendaQueueProps {
  entries: QueueEntry[];
  nextFree?: { time: string; durationMin: number } | null;
  onEntryClick?: (apptId: string) => void;
}

export function AgendaQueue({ entries, nextFree, onEntryClick }: AgendaQueueProps) {
  return (
    <aside
      aria-label="Fila de espera"
      style={{
        width: 166,
        borderLeft: `1px solid ${T.divider}`,
        padding: '12px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flexShrink: 0,
        overflowY: 'auto',
      }}
    >
      <Mono size={8} spacing="1.2px">FILA DE ESPERA</Mono>

      {entries.length === 0 ? (
        <div
          style={{
            padding: '14px 10px',
            borderRadius: T.r.md,
            background: T.glass,
            border: `1px dashed ${T.glassBorder}`,
            textAlign: 'center',
          }}
        >
          <Ico name="check" size={16} color={T.textMuted} />
          <p style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>
            Nenhum paciente em espera.
          </p>
        </div>
      ) : (
        entries.map((q) => (
          <button
            key={q.appointmentId}
            type="button"
            onClick={() => onEntryClick?.(q.appointmentId)}
            style={{
              padding: 0,
              border: 'none',
              background: 'none',
              textAlign: 'left',
              cursor: onEntryClick ? 'pointer' : 'default',
              width: '100%',
            }}
          >
            <Glass style={{ padding: '9px 10px', borderRadius: T.r.md }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.textPrimary,
                  marginBottom: 3,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {q.patientName}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Mono size={8}>{q.waitingSinceMin} min</Mono>
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

      {nextFree && (
        <div style={{ marginTop: 'auto' }}>
          <Glass
            style={{
              padding: 10,
              borderRadius: T.r.md,
              background: T.primaryBg,
              border: `1px solid ${T.primaryBorder}`,
            }}
          >
            <Mono size={8} color={T.primary} spacing="0.8px">
              PRÓXIMO LIVRE
            </Mono>
            <p
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: T.textPrimary,
                marginTop: 3,
              }}
            >
              {nextFree.time}
            </p>
            <p style={{ fontSize: 10, color: T.textMuted }}>{nextFree.durationMin} min</p>
          </Glass>
        </div>
      )}
    </aside>
  );
}
