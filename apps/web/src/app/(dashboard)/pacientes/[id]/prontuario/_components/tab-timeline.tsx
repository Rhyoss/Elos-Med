'use client';

import { Ico, Mono, T } from '@dermaos/ui/ds';
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

const KIND_COLOR = (T: typeof import('@dermaos/ui/ds').T) => ({
  consulta:   T.clinical.color,
  prescricao: T.primary,
  imagem:     T.supply.color,
});

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

  const colors = KIND_COLOR(T);

  if (isLoading && events.length === 0) {
    return <p style={{ fontSize: 12, color: T.textMuted }}>Carregando timeline…</p>;
  }
  if (events.length === 0) {
    return <p style={{ fontSize: 12, color: T.textMuted }}>Nenhum evento clínico ainda.</p>;
  }

  let lastKey = '';
  return (
    <div style={{ position: 'relative', paddingLeft: 24 }}>
      <div
        style={{
          position: 'absolute',
          left: 10,
          top: 0,
          bottom: 0,
          width: 1,
          background: T.divider,
        }}
      />
      {events.map((ev, i) => {
        const k = dayKey(ev.date);
        const showDate = k !== lastKey;
        lastKey = k;
        const ic = KIND_ICON[ev.kind];
        const clr = colors[ev.kind];
        return (
          <div key={i}>
            {showDate && (
              <div style={{ marginBottom: 8, marginLeft: -24 }}>
                <Mono size={9} spacing="1px" color={T.textMuted}>
                  {formatDayHeader(ev.date)}
                </Mono>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, position: 'relative' }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: T.bg,
                  border: `1.5px solid ${clr}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'absolute',
                  left: -24,
                  flexShrink: 0,
                  zIndex: 1,
                }}
              >
                <Ico name={ic} size={10} color={clr} />
              </div>
              <div style={{ marginLeft: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>{ev.label}</p>
                <p style={{ fontSize: 11, color: T.textMuted }}>{ev.detail}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
