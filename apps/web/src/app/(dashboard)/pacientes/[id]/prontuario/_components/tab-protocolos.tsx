'use client';

import * as React from 'react';
import { Badge, Bar, Btn, Glass, Ico, Mono, EmptyState, Skeleton, T } from '@dermaos/ui/ds';
import { PROTOCOL_TYPE_LABELS, PROTOCOL_STATUS_LABELS, type ProtocolStatus, type ProtocolType } from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { NewProtocolDialog } from './procedures/new-protocol-dialog';
import { ProtocolDetail } from './procedures/protocol-detail';

interface TabProtocolosProps {
  patientId: string;
  patientName?: string;
  onScheduleAppointment?: (suggestedDate: Date) => void;
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  ativo:     'success',
  pausado:   'warning',
  concluido: 'default',
  cancelado: 'danger',
};

const STATUS_ICON: Record<string, 'zap' | 'clock' | 'check' | 'x'> = {
  ativo:     'zap',
  pausado:   'clock',
  concluido: 'check',
  cancelado: 'x',
};

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TabProtocolos({ patientId, patientName, onScheduleAppointment }: TabProtocolosProps) {
  const [showNew, setShowNew] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<ProtocolStatus | null>(null);

  const listQ = trpc.clinical.protocols.listByPatient.useQuery({
    patientId,
    status: statusFilter ?? undefined,
  });

  const patientQ = trpc.patients.getById.useQuery(
    { id: patientId },
    { enabled: !patientName, staleTime: 60_000 },
  );

  const resolvedName = patientName ?? patientQ.data?.patient?.name ?? 'Paciente';

  // Show detail view
  if (detailId) {
    return (
      <ProtocolDetail
        protocolId={detailId}
        patientId={patientId}
        onBack={() => setDetailId(null)}
        onScheduleSession={onScheduleAppointment}
      />
    );
  }

  if (listQ.isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} height={140} delay={i * 80} />
        ))}
      </div>
    );
  }

  const items = listQ.data?.protocols ?? [];

  if (items.length === 0 && !statusFilter) {
    return (
      <>
        <EmptyState
          label="PROTOCOLOS"
          icon="layers"
          title="Nenhum protocolo"
          description="Protocolos de tratamento seriados (peeling, laser, fototerapia, rejuvenescimento) aparecerão aqui quando criados."
          action={
            <Btn small icon="layers" onClick={() => setShowNew(true)}>
              Novo protocolo
            </Btn>
          }
        />
        <NewProtocolDialog
          patientId={patientId}
          patientName={resolvedName}
          open={showNew}
          onClose={() => setShowNew(false)}
          onCreated={(id) => setDetailId(id)}
        />
      </>
    );
  }

  const statusCounts = {
    all: items.length,
    ativo: items.filter((p) => p.status === 'ativo').length,
    pausado: items.filter((p) => p.status === 'pausado').length,
    concluido: items.filter((p) => p.status === 'concluido').length,
    cancelado: items.filter((p) => p.status === 'cancelado').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Mono size={11} spacing="1.2px" color={T.primary}>
          {items.length} {items.length === 1 ? 'PROTOCOLO' : 'PROTOCOLOS'}
        </Mono>
        <Btn variant="glass" small icon="layers" onClick={() => setShowNew(true)}>
          Novo protocolo
        </Btn>
      </div>

      {/* Status filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {([null, 'ativo', 'pausado', 'concluido', 'cancelado'] as const).map((s) => {
          const active = statusFilter === s;
          const label = s === null ? 'Todos' : PROTOCOL_STATUS_LABELS[s];
          const count = s === null ? statusCounts.all : statusCounts[s];
          if (s !== null && count === 0) return null;
          return (
            <button
              key={s ?? 'all'}
              type="button"
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '4px 12px', borderRadius: T.r.md,
                background: active ? T.primaryBg : 'transparent',
                border: `1px solid ${active ? T.primaryBorder : 'transparent'}`,
                color: active ? T.primary : T.textMuted,
                fontSize: 12, fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 500, cursor: 'pointer',
              }}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Protocol cards */}
      {items.map((p) => {
        const pct = (p.sessionsDone / Math.max(1, p.totalSessions)) * 100;
        const statusIcon = STATUS_ICON[p.status] ?? 'layers';
        return (
          <Glass
            key={p.id}
            hover
            style={{ padding: '20px 22px', cursor: 'pointer' }}
            onClick={() => setDetailId(p.id)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40, height: 40, borderRadius: T.r.md,
                    background: p.status === 'ativo' ? T.successBg : p.status === 'pausado' ? T.warningBg : T.glass,
                    border: `1px solid ${p.status === 'ativo' ? T.successBorder : p.status === 'pausado' ? T.warningBorder : T.glassBorder}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Ico name={statusIcon} size={18} color={p.status === 'ativo' ? T.success : p.status === 'pausado' ? T.warning : T.textMuted} />
                </div>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary }}>{p.name}</p>
                  <Mono size={11}>
                    {PROTOCOL_TYPE_LABELS[p.type as ProtocolType] ?? p.type} · {p.id.slice(0, 8).toUpperCase()}
                  </Mono>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <Badge variant={STATUS_VARIANT[p.status] ?? 'default'}>
                  {PROTOCOL_STATUS_LABELS[p.status as ProtocolStatus] ?? p.status}
                </Badge>
                <Ico name="arrowRight" size={16} color={T.textMuted} />
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10, marginBottom: 14 }}>
              <div style={{
                padding: '10px 12px', borderRadius: T.r.md,
                background: T.glass, border: `1px solid ${T.glassBorder}`,
                textAlign: 'center',
              }}>
                <Mono size={9}>SESSÕES</Mono>
                <p style={{ fontSize: 26, fontWeight: 700, color: T.textPrimary, marginTop: 3 }}>
                  {p.sessionsDone}
                  <span style={{ fontSize: 16, color: T.textMuted }}>/{p.totalSessions}</span>
                </p>
              </div>
              <div style={{
                padding: '10px 12px', borderRadius: T.r.md,
                background: T.primaryBg, border: `1px solid ${T.primaryBorder}`,
                textAlign: 'center',
              }}>
                <Mono size={9} color={T.primary}>INÍCIO</Mono>
                <p style={{ fontSize: 15, color: T.textPrimary, marginTop: 5, fontWeight: 500 }}>
                  {formatDate(p.startedAt)}
                </p>
              </div>
              {p.expectedEndDate && (
                <div style={{
                  padding: '10px 12px', borderRadius: T.r.md,
                  background: T.glass, border: `1px solid ${T.glassBorder}`,
                  textAlign: 'center',
                }}>
                  <Mono size={9}>PREVISÃO</Mono>
                  <p style={{ fontSize: 15, fontWeight: 600, color: T.primary, marginTop: 5 }}>
                    {formatDate(p.expectedEndDate)}
                  </p>
                </div>
              )}
              {p.intervalDays && (
                <div style={{
                  padding: '10px 12px', borderRadius: T.r.md,
                  background: T.glass, border: `1px solid ${T.glassBorder}`,
                  textAlign: 'center',
                }}>
                  <Mono size={9}>INTERVALO</Mono>
                  <p style={{ fontSize: 15, color: T.textSecondary, marginTop: 5 }}>
                    {p.intervalDays} dias
                  </p>
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Bar pct={pct} color={T.clinical.color} height={6} />
              </div>
              <Mono size={11} color={T.clinical.color}>{Math.round(pct)}%</Mono>
            </div>
          </Glass>
        );
      })}

      {items.length === 0 && statusFilter && (
        <Glass style={{ padding: '20px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: T.textMuted }}>
            Nenhum protocolo com status "{PROTOCOL_STATUS_LABELS[statusFilter]}".
          </p>
        </Glass>
      )}

      {/* New protocol dialog */}
      <NewProtocolDialog
        patientId={patientId}
        patientName={resolvedName}
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={(id) => setDetailId(id)}
      />
    </div>
  );
}
