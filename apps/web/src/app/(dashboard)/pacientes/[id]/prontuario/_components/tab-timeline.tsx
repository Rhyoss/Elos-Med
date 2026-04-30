'use client';

import { Glass, Ico, Mono, EmptyState, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';

interface TabTimelineProps {
  patientId: string;
}

type TimelineKind = 'consulta' | 'prescricao' | 'imagem';

interface TimelineEvent {
  date:   Date;
  kind:   TimelineKind;
  label:  string;
  detail: string;
}

const KIND_ICON: Record<TimelineKind, 'calendar' | 'file' | 'image'> = {
  consulta:   'calendar',
  prescricao: 'file',
  imagem:     'image',
};

const KIND_COLOR: Record<TimelineKind, string> = {
  consulta:   T.clinical.color,
  prescricao: T.primary,
  imagem:     T.supply.color,
};

const KIND_BG: Record<TimelineKind, string> = {
  consulta:   T.clinical.bg,
  prescricao: T.primaryBg,
  imagem:     T.supply.bg,
};

const TYPE_LABEL: Record<string, string> = {
  clinical:     'Consulta clínica',
  aesthetic:    'Procedimento estético',
  followup:     'Retorno',
  emergency:    'Urgência',
  telemedicine: 'Telemedicina',
};

const RX_STATUS_LABEL: Record<string, string> = {
  rascunho:        'rascunho',
  emitida:         'emitida',
  assinada:        'assinada',
  enviada_digital: 'enviada',
  impressa:        'impressa',
  expirada:        'expirada',
  cancelada:       'cancelada',
};

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).toUpperCase();
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function TabTimeline({ patientId }: TabTimelineProps) {
  const encQ = trpc.clinical.encounters.getByPatient.useQuery({ patientId, page: 1, pageSize: 50 });
  const rxQ  = trpc.clinical.prescriptions.listByPatient.useQuery({ patientId, page: 1, pageSize: 50 });
  const imgQ = trpc.clinical.lesions.listPatientImages.useQuery({ patientId, page: 1, pageSize: 50 });

  const isLoading = encQ.isLoading || rxQ.isLoading || imgQ.isLoading;

  const events: TimelineEvent[] = [];

  for (const e of encQ.data?.data ?? []) {
    events.push({
      date:   new Date(e.signedAt ?? e.createdAt),
      kind:   'consulta',
      label:  `${TYPE_LABEL[e.type] ?? e.type}${e.signedAt ? '' : ' (rascunho)'}`,
      detail: e.chiefComplaint ?? '—',
    });
  }
  for (const r of rxQ.data?.data ?? []) {
    events.push({
      date:   new Date(r.signedAt ?? r.createdAt),
      kind:   'prescricao',
      label:  `Prescrição ${r.prescriptionNumber ?? r.id.slice(0, 8)}`,
      detail: `${r.itemCount} ${r.itemCount === 1 ? 'item' : 'itens'} · ${RX_STATUS_LABEL[r.status] ?? r.status}`,
    });
  }
  for (const i of imgQ.data?.data ?? []) {
    events.push({
      date:   new Date(i.capturedAt),
      kind:   'imagem',
      label:  i.captureType ? `Imagem ${i.captureType}` : 'Imagem clínica',
      detail: i.notes ?? '—',
    });
  }

  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  if (isLoading && events.length === 0) {
    return (
      <Glass style={{ padding: 32, textAlign: 'center' }}>
        <Mono size={11} color={T.textMuted}>CARREGANDO TIMELINE…</Mono>
      </Glass>
    );
  }

  if (events.length === 0) {
    return (
      <Glass style={{ padding: 40 }}>
        <EmptyState
          icon="clock"
          title="Timeline vazia"
          description="Consultas, prescrições e imagens aparecerão aqui em ordem cronológica conforme forem registradas."
          tone="primary"
        />
      </Glass>
    );
  }

  let lastKey = '';
  return (
    <div style={{ position: 'relative', paddingLeft: 32 }}>
      {/* Vertical line */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 14,
          top: 8,
          bottom: 8,
          width: 2,
          borderRadius: 1,
          background: `linear-gradient(to bottom, ${T.primary}40, ${T.divider})`,
        }}
      />

      {events.map((ev, i) => {
        const k = dayKey(ev.date);
        const showDate = k !== lastKey;
        lastKey = k;
        const clr = KIND_COLOR[ev.kind];
        const bg = KIND_BG[ev.kind];
        const ic = KIND_ICON[ev.kind];

        return (
          <div key={i}>
            {showDate && (
              <div style={{ marginBottom: 10, marginLeft: -32, paddingLeft: 4 }}>
                <Glass
                  style={{
                    display: 'inline-flex',
                    padding: '4px 12px',
                    borderRadius: T.r.md,
                  }}
                >
                  <Mono size={11} spacing="1px" color={T.primary}>
                    {formatDayHeader(ev.date)}
                  </Mono>
                </Glass>
              </div>
            )}

            <div style={{ display: 'flex', gap: 14, marginBottom: 16, position: 'relative' }}>
              {/* Node dot */}
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: bg,
                  border: `2px solid ${clr}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'absolute',
                  left: -32,
                  top: 2,
                  flexShrink: 0,
                  zIndex: 1,
                }}
              >
                <Ico name={ic} size={13} color={clr} />
              </div>

              {/* Content card */}
              <Glass hover style={{ padding: '12px 16px', flex: 1, borderLeft: `3px solid ${clr}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>{ev.label}</p>
                  <Mono size={10} color={T.textMuted}>{formatTime(ev.date)}</Mono>
                </div>
                <p style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>{ev.detail}</p>
              </Glass>
            </div>
          </div>
        );
      })}
    </div>
  );
}
