'use client';

import * as React from 'react';
import { Glass, Ico, Mono, EmptyState, Skeleton, T, type IcoName } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';

interface TabTimelineProps {
  patientId: string;
}

type TimelineKind = 'consulta' | 'prescricao' | 'imagem' | 'protocolo' | 'procedimento';

interface TimelineEvent {
  id:     string;
  date:   Date;
  kind:   TimelineKind;
  label:  string;
  detail: string;
}

const KIND_CONFIG: Record<TimelineKind, { icon: IcoName; color: string; bg: string; label: string }> = {
  consulta:      { icon: 'calendar', color: T.clinical.color, bg: T.clinical.bg, label: 'Consultas' },
  prescricao:    { icon: 'file',     color: T.primary,        bg: T.primaryBg,   label: 'Prescrições' },
  imagem:        { icon: 'image',    color: T.supply.color,   bg: T.supply.bg,   label: 'Imagens' },
  protocolo:     { icon: 'layers',   color: T.aiMod.color,    bg: T.aiMod.bg,    label: 'Protocolos' },
  procedimento:  { icon: 'zap',      color: T.accentMod.color, bg: T.accentMod.bg, label: 'Procedimentos' },
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
    day: '2-digit', month: 'short', year: 'numeric',
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
  const proQ = trpc.clinical.protocols.listByPatient.useQuery({ patientId });

  const [filter, setFilter] = React.useState<TimelineKind | null>(null);

  const isLoading = encQ.isLoading || rxQ.isLoading || imgQ.isLoading || proQ.isLoading;

  const events: TimelineEvent[] = [];

  for (const e of encQ.data?.data ?? []) {
    const kind: TimelineKind = e.type === 'aesthetic' ? 'procedimento' : 'consulta';
    events.push({
      id:     e.id,
      date:   new Date(e.signedAt ?? e.createdAt),
      kind,
      label:  `${TYPE_LABEL[e.type] ?? e.type}${e.signedAt ? '' : ' (rascunho)'}`,
      detail: e.chiefComplaint ?? '—',
    });
  }
  for (const r of rxQ.data?.data ?? []) {
    events.push({
      id:     r.id,
      date:   new Date(r.signedAt ?? r.createdAt),
      kind:   'prescricao',
      label:  `Prescrição ${r.prescriptionNumber ?? r.id.slice(0, 8)}`,
      detail: `${r.itemCount} ${r.itemCount === 1 ? 'item' : 'itens'} · ${RX_STATUS_LABEL[r.status] ?? r.status}`,
    });
  }
  for (const i of imgQ.data?.data ?? []) {
    events.push({
      id:     i.id,
      date:   new Date(i.capturedAt),
      kind:   'imagem',
      label:  i.captureType ? `Imagem ${i.captureType}` : 'Imagem clínica',
      detail: i.notes ?? '—',
    });
  }
  for (const p of proQ.data?.protocols ?? []) {
    const protoDate = p.startedAt;
    if (!protoDate) continue;
    events.push({
      id:     p.id,
      date:   new Date(protoDate),
      kind:   'protocolo',
      label:  p.name,
      detail: `${p.sessionsDone}/${p.totalSessions} sessões · ${p.status}`,
    });
  }

  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  const activeKinds = [...new Set(events.map((e) => e.kind))];
  const filtered = filter ? events.filter((e) => e.kind === filter) : events;

  if (isLoading && events.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={60} delay={i * 80} />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        label="TIMELINE"
        icon="clock"
        title="Timeline vazia"
        description="Consultas, prescrições, procedimentos, protocolos e imagens aparecerão aqui em ordem cronológica."
      />
    );
  }

  let lastKey = '';
  return (
    <div>
      {/* Filters */}
      {activeKinds.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setFilter(null)}
            style={{
              padding: '5px 12px', borderRadius: T.r.md,
              background: filter === null ? T.primaryBg : 'transparent',
              border: `1px solid ${filter === null ? T.primaryBorder : 'transparent'}`,
              color: filter === null ? T.primary : T.textMuted,
              fontSize: 12, fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 500, cursor: 'pointer',
            }}
          >
            TODOS ({events.length})
          </button>
          {activeKinds.map((k) => {
            const cfg = KIND_CONFIG[k];
            const count = events.filter((e) => e.kind === k).length;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                style={{
                  padding: '5px 12px', borderRadius: T.r.md,
                  background: filter === k ? cfg.bg : 'transparent',
                  border: `1px solid ${filter === k ? cfg.color + '40' : 'transparent'}`,
                  color: filter === k ? cfg.color : T.textMuted,
                  fontSize: 11, fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: 500, cursor: 'pointer',
                }}
              >
                {cfg.label.toUpperCase()} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div style={{ position: 'relative', paddingLeft: 32 }}>
        {/* Vertical line */}
        <div
          aria-hidden
          style={{
            position: 'absolute', left: 14, top: 8, bottom: 8,
            width: 2, borderRadius: 1,
            background: `linear-gradient(to bottom, ${T.primary}40, ${T.divider})`,
          }}
        />

        {filtered.map((ev, i) => {
          const k = dayKey(ev.date);
          const showDate = k !== lastKey;
          lastKey = k;
          const cfg = KIND_CONFIG[ev.kind];

          return (
            <div key={`${ev.kind}-${ev.id}-${i}`}>
              {showDate && (
                <div style={{ marginBottom: 10, marginLeft: -32, paddingLeft: 4 }}>
                  <Glass style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: T.r.md }}>
                    <Mono size={11} spacing="1px" color={T.primary}>
                      {formatDayHeader(ev.date)}
                    </Mono>
                  </Glass>
                </div>
              )}

              <div style={{ display: 'flex', gap: 14, marginBottom: 16, position: 'relative' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: cfg.bg, border: `2px solid ${cfg.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'absolute', left: -32, top: 2, zIndex: 1,
                }}>
                  <Ico name={cfg.icon} size={13} color={cfg.color} />
                </div>

                <Glass hover style={{ padding: '12px 16px', flex: 1, borderLeft: `3px solid ${cfg.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{ev.label}</p>
                    <Mono size={10} color={T.textMuted}>{formatTime(ev.date)}</Mono>
                  </div>
                  <p style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>{ev.detail}</p>
                </Glass>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
