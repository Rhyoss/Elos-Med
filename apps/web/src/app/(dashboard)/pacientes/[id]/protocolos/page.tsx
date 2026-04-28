'use client';

import * as React from 'react';
import {
  Badge,
  Bar,
  Btn,
  EmptyState,
  Glass,
  Ico,
  Mono,
  PageHero,
  Skeleton,
  T,
  Timeline,
  type TimelineEvent,
} from '@dermaos/ui/ds';
import { useToast } from '@dermaos/ui';
import {
  PROTOCOL_STATUS_LABELS,
  PROTOCOL_TYPE_LABELS,
  type ProtocolStatus,
} from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { NewProtocolModal } from './_components/new-protocol-modal';
import { SessionDetailSheet } from './_components/session-detail-sheet';
import { RegisterSessionSheet } from './_components/register-session-sheet';

type StatusFilter = 'all' | ProtocolStatus;
type PageParams = Promise<{ id: string }>;

const STATUS_VARIANT: Record<ProtocolStatus, 'success' | 'warning' | 'info' | 'danger'> = {
  ativo:     'success',
  pausado:   'warning',
  concluido: 'info',
  cancelado: 'danger',
};

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

export default function ProtocolosPage({ params }: { params: PageParams }) {
  const { id: patientId } = React.use(params);
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [filter, setFilter] = React.useState<StatusFilter>('all');
  const [newOpen, setNewOpen] = React.useState(false);
  const [expandedProtocolId, setExpandedProtocolId] = React.useState<string | null>(null);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [registerProtocolId, setRegisterProtocolId] = React.useState<string | null>(null);

  const meQuery = trpc.auth.me.useQuery();
  const providerId = meQuery.data?.user?.id ?? '';

  const listQuery = trpc.clinical.protocols.listByPatient.useQuery(
    { patientId, status: filter === 'all' ? undefined : filter },
    { staleTime: 10_000 },
  );
  const protocols = listQuery.data?.protocols ?? [];

  const cancelMut = trpc.clinical.protocols.cancel.useMutation({
    onSuccess: () => {
      toast({ title: 'Protocolo cancelado' });
      void utils.clinical.protocols.listByPatient.invalidate({ patientId });
    },
    onError: (err) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  function onCancel(id: string) {
    const reason = window.prompt('Motivo do cancelamento:');
    if (!reason || reason.length < 3) return;
    cancelMut.mutate({ id, reason });
  }

  const filterOptions: Array<{ id: StatusFilter; label: string }> = [
    { id: 'all',       label: 'Todos'      },
    { id: 'ativo',     label: PROTOCOL_STATUS_LABELS.ativo     },
    { id: 'pausado',   label: PROTOCOL_STATUS_LABELS.pausado   },
    { id: 'concluido', label: PROTOCOL_STATUS_LABELS.concluido },
    { id: 'cancelado', label: PROTOCOL_STATUS_LABELS.cancelado },
  ];

  return (
    <div
      style={{
        padding: '22px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <PageHero
        eyebrow="TRATAMENTOS · EVOLUÇÃO"
        title="Protocolos & Sessões"
        module="clinical"
        icon="layers"
        actions={
          <Btn small icon="plus" onClick={() => setNewOpen(true)} disabled={!providerId}>
            Novo protocolo
          </Btn>
        }
      />

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {filterOptions.map((opt) => {
          const active = filter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilter(opt.id)}
              aria-pressed={active}
              style={{
                padding: '6px 12px',
                borderRadius: T.r.pill,
                border: `1px solid ${active ? T.primary : T.glassBorder}`,
                background: active ? T.primaryBg : T.glass,
                color: active ? T.primary : T.textSecondary,
                fontSize: 11,
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                letterSpacing: '0.02em',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {listQuery.isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          {[0, 1].map((i) => (
            <Skeleton key={i} height={170} radius={16} delay={60 * i} />
          ))}
        </div>
      ) : protocols.length === 0 ? (
        <Glass style={{ padding: 32 }}>
          <EmptyState
            icon="layers"
            title="Nenhum protocolo registrado"
            description={
              filter === 'all'
                ? 'Clique em "Novo protocolo" para iniciar um tratamento.'
                : 'Nenhum protocolo nesse status. Tente outro filtro acima.'
            }
            action={
              <Btn variant="glass" small icon="plus" onClick={() => setNewOpen(true)}>
                Novo protocolo
              </Btn>
            }
          />
        </Glass>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          {protocols.map((p) => (
            <ProtocolCard
              key={p.id}
              protocol={p}
              expanded={expandedProtocolId === p.id}
              onToggleTimeline={() =>
                setExpandedProtocolId((prev) => (prev === p.id ? null : p.id))
              }
              onOpenSession={(id) => setSessionId(id)}
              onRegisterSession={() => setRegisterProtocolId(p.id)}
              onCancel={() => onCancel(p.id)}
            />
          ))}
        </div>
      )}

      <NewProtocolModal
        open={newOpen}
        onOpenChange={setNewOpen}
        patientId={patientId}
        providerId={providerId}
      />

      <SessionDetailSheet
        sessionId={sessionId}
        open={sessionId !== null}
        onOpenChange={(o) => !o && setSessionId(null)}
      />

      <RegisterSessionSheet
        protocolId={registerProtocolId}
        patientId={patientId}
        open={registerProtocolId !== null}
        onOpenChange={(o) => !o && setRegisterProtocolId(null)}
      />
    </div>
  );
}

/* ── ProtocolCard ────────────────────────────────────────────────────────── */

function ProtocolCard({
  protocol,
  expanded,
  onToggleTimeline,
  onOpenSession,
  onRegisterSession,
  onCancel,
}: {
  protocol: {
    id:               string;
    type:             keyof typeof PROTOCOL_TYPE_LABELS;
    status:           ProtocolStatus;
    name:             string;
    totalSessions:    number;
    sessionsDone:     number;
    intervalDays:     number | null;
    startedAt:        Date | string | null;
    expectedEndDate:  Date | string | null;
  };
  expanded:          boolean;
  onToggleTimeline:  () => void;
  onOpenSession:     (sessionId: string) => void;
  onRegisterSession: () => void;
  onCancel:          () => void;
}) {
  const percent = protocol.totalSessions > 0
    ? Math.round((protocol.sessionsDone / protocol.totalSessions) * 100)
    : 0;
  const canRegister = protocol.status === 'ativo' && protocol.sessionsDone < protocol.totalSessions;
  const canCancel = protocol.status !== 'cancelado' && protocol.status !== 'concluido';

  return (
    <Glass style={{ padding: '16px 18px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Mono size={9} spacing="1.1px" color={T.clinical.color}>
            {PROTOCOL_TYPE_LABELS[protocol.type].toUpperCase()}
          </Mono>
          <p
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: T.textPrimary,
              margin: '4px 0 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {protocol.name}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[protocol.status]} dot={false}>
          {PROTOCOL_STATUS_LABELS[protocol.status]}
        </Badge>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 5,
          }}
        >
          <Mono size={8}>
            SESSÕES {protocol.sessionsDone}/{protocol.totalSessions}
          </Mono>
          <Mono size={9} color={T.clinical.color}>
            {percent}%
          </Mono>
        </div>
        <Bar pct={percent} color={T.clinical.color} height={5} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          marginBottom: 12,
          padding: '10px 12px',
          borderRadius: T.r.md,
          background: T.glass,
          border: `1px solid ${T.glassBorder}`,
        }}
      >
        <div>
          <Mono size={7}>INÍCIO</Mono>
          <p style={{ fontSize: 11, color: T.textPrimary, margin: '2px 0 0' }}>
            {fmtDate(protocol.startedAt)}
          </p>
        </div>
        <div>
          <Mono size={7}>PREVISÃO</Mono>
          <p style={{ fontSize: 11, color: T.textPrimary, margin: '2px 0 0' }}>
            {fmtDate(protocol.expectedEndDate)}
          </p>
        </div>
        <div>
          <Mono size={7}>INTERVALO</Mono>
          <p style={{ fontSize: 11, color: T.textPrimary, margin: '2px 0 0' }}>
            {protocol.intervalDays ? `${protocol.intervalDays} dias` : '—'}
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 10,
          borderTop: `1px solid ${T.divider}`,
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        <Btn
          variant="ghost"
          small
          icon={expanded ? 'chevDown' : 'eye'}
          onClick={onToggleTimeline}
        >
          {expanded ? 'Ocultar timeline' : 'Ver timeline'}
        </Btn>
        <div style={{ display: 'flex', gap: 6 }}>
          {canRegister && (
            <Btn small icon="plus" onClick={onRegisterSession}>
              Registrar sessão
            </Btn>
          )}
          {canCancel && (
            <Btn variant="danger" small icon="x" iconOnly aria-label="Cancelar protocolo" onClick={onCancel}>
              Cancelar
            </Btn>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.divider}` }}>
          <ProtocolTimeline protocolId={protocol.id} onOpenSession={onOpenSession} />
        </div>
      )}
    </Glass>
  );
}

/* ── Timeline DS-based ───────────────────────────────────────────────────── */

function ProtocolTimeline({
  protocolId,
  onOpenSession,
}: {
  protocolId:    string;
  onOpenSession: (id: string) => void;
}) {
  const sessionsQuery = trpc.clinical.protocols.listSessions.useQuery(
    { protocolId },
    { staleTime: 10_000 },
  );
  const suggestQuery = trpc.clinical.protocols.suggestNextSession.useQuery({ protocolId });

  if (sessionsQuery.isLoading) {
    return <Skeleton height={70} radius={6} />;
  }

  const sessions = sessionsQuery.data?.sessions ?? [];

  const events: TimelineEvent[] = sessions.map((s) => ({
    id:    s.id,
    date:  fmtDate(s.performedAt),
    label: `Sessão #${s.sessionNumber}${s.flagMedicalReview ? ' · Revisão médica' : ''}`,
    detail: s.insufficientStock ? 'Estoque insuficiente' : undefined,
    icon:   s.flagMedicalReview ? 'alert' : 'check',
    color:  s.flagMedicalReview ? T.danger : T.primary,
  }));

  if (suggestQuery.data?.suggestedAt) {
    events.push({
      id:    'next-suggested',
      date:  fmtDate(suggestQuery.data.suggestedAt),
      label: 'Próxima sessão sugerida',
      icon:  'clock',
      color: T.textMuted,
    });
  }

  if (events.length === 0) {
    return (
      <p style={{ fontSize: 11, color: T.textMuted, textAlign: 'center', padding: 12 }}>
        Nenhuma sessão registrada ainda.
      </p>
    );
  }

  return (
    <div onClick={(e) => {
      const target = (e.target as HTMLElement).closest('[data-session-id]');
      const id = target?.getAttribute('data-session-id');
      if (id) onOpenSession(id);
    }}>
      {/* Render timeline with click handlers via wrapping spans */}
      <Timeline events={events} />
      {/* Hidden invisible buttons for keyboard accessibility on each session */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            data-session-id={s.id}
            onClick={() => onOpenSession(s.id)}
          >
            Abrir sessão {s.sessionNumber}
          </button>
        ))}
      </div>
    </div>
  );
}
