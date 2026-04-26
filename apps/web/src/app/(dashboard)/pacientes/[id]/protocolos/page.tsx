'use client';

import * as React from 'react';
import { CalendarClock, CheckCircle2, Circle, XCircle, CircleAlert } from 'lucide-react';
import {
  Button,
  Badge,
  EmptyState,
  LoadingSkeleton,
  useToast,
} from '@dermaos/ui';
import { Btn, Mono, T } from '@dermaos/ui/ds';
import {
  PROTOCOL_STATUS_LABELS,
  PROTOCOL_TYPE_LABELS,
  type ProtocolStatus,
} from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { cn } from '@/lib/utils';
import { NewProtocolModal } from './_components/new-protocol-modal';
import { SessionDetailSheet } from './_components/session-detail-sheet';
import { RegisterSessionSheet } from './_components/register-session-sheet';

type StatusFilter = 'all' | ProtocolStatus;

type PageParams = Promise<{ id: string }>;

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

  return (
    <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <Mono size={9} spacing="1.2px" color={T.clinical.color}>TRATAMENTOS &amp; EVOLUÇÃO</Mono>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 2, color: T.textPrimary, letterSpacing: '-0.01em' }}>
            Protocolos &amp; Sessões
          </h2>
          <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
            Tratamentos ativos, sessões realizadas e evolução.
          </p>
        </div>
        <Btn small icon="plus" onClick={() => setNewOpen(true)} disabled={!providerId}>
          Novo protocolo
        </Btn>
      </div>

      <div className="flex gap-2 text-sm">
        {(['all', 'ativo', 'pausado', 'concluido', 'cancelado'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={cn(
              'px-3 py-1 rounded-md border text-sm transition-colors',
              filter === s
                ? 'border-primary-600 bg-primary-50 text-primary-700 font-medium'
                : 'border-border hover:border-primary-300',
            )}
            aria-pressed={filter === s}
          >
            {s === 'all' ? 'Todos' : PROTOCOL_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {listQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-36 w-full rounded-md" />
          ))}
        </div>
      ) : protocols.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-8 w-8" aria-hidden="true" />}
          title="Nenhum protocolo registrado"
          description="Clique em 'Novo protocolo' para iniciar um tratamento."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

/* ── Card de protocolo com barra de progresso + timeline ────────────────── */

function ProtocolCard({
  protocol,
  expanded,
  onToggleTimeline,
  onOpenSession,
  onRegisterSession,
  onCancel,
}: {
  protocol: {
    id: string;
    type: keyof typeof PROTOCOL_TYPE_LABELS;
    status: ProtocolStatus;
    name: string;
    totalSessions: number;
    sessionsDone: number;
    intervalDays: number | null;
    startedAt: Date | null;
    expectedEndDate: Date | null;
  };
  expanded: boolean;
  onToggleTimeline: () => void;
  onOpenSession: (sessionId: string) => void;
  onRegisterSession: () => void;
  onCancel: () => void;
}) {
  const percent = protocol.totalSessions > 0
    ? Math.round((protocol.sessionsDone / protocol.totalSessions) * 100)
    : 0;

  return (
    <article className="rounded-md border border-border bg-card p-4 space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {PROTOCOL_TYPE_LABELS[protocol.type]}
          </p>
          <h3 className="font-semibold truncate">{protocol.name}</h3>
        </div>
        <Badge variant={statusVariant(protocol.status)}>
          {PROTOCOL_STATUS_LABELS[protocol.status]}
        </Badge>
      </header>

      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Sessões: {protocol.sessionsDone}/{protocol.totalSessions}</span>
          <span>{percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 rounded-full bg-muted overflow-hidden"
        >
          <div className="h-full bg-primary-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <dl className="grid grid-cols-2 text-xs text-muted-foreground gap-y-1">
        <dt>Início</dt>
        <dd className="text-foreground text-right">
          {protocol.startedAt ? new Intl.DateTimeFormat('pt-BR').format(protocol.startedAt) : '—'}
        </dd>
        <dt>Previsão término</dt>
        <dd className="text-foreground text-right">
          {protocol.expectedEndDate ? new Intl.DateTimeFormat('pt-BR').format(protocol.expectedEndDate) : '—'}
        </dd>
        <dt>Intervalo</dt>
        <dd className="text-foreground text-right">
          {protocol.intervalDays ? `${protocol.intervalDays} dias` : '—'}
        </dd>
      </dl>

      <div className="flex items-center justify-between pt-2 border-t border-border gap-2">
        <Button size="sm" variant="ghost" onClick={onToggleTimeline}>
          {expanded ? 'Ocultar timeline' : 'Ver timeline'}
        </Button>
        <div className="flex items-center gap-1">
          {protocol.status === 'ativo' && protocol.sessionsDone < protocol.totalSessions && (
            <Button size="sm" onClick={onRegisterSession}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Registrar sessão
            </Button>
          )}
          {protocol.status !== 'cancelado' && protocol.status !== 'concluido' && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              <XCircle className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {expanded && <ProtocolTimeline protocolId={protocol.id} onOpenSession={onOpenSession} />}
    </article>
  );
}

function statusVariant(status: ProtocolStatus): 'success' | 'warning' | 'info' | 'danger' {
  switch (status) {
    case 'ativo':     return 'success';
    case 'pausado':   return 'warning';
    case 'concluido': return 'info';
    case 'cancelado': return 'danger';
  }
}

/* ── Timeline visual: ○ próxima  ● concluída  ✖ cancelada ────────────── */

function ProtocolTimeline({
  protocolId,
  onOpenSession,
}: {
  protocolId: string;
  onOpenSession: (id: string) => void;
}) {
  const sessionsQuery = trpc.clinical.protocols.listSessions.useQuery(
    { protocolId },
    { staleTime: 10_000 },
  );
  const suggestQuery = trpc.clinical.protocols.suggestNextSession.useQuery({ protocolId });

  if (sessionsQuery.isLoading) {
    return <LoadingSkeleton className="h-20 w-full rounded-md" />;
  }

  const sessions = sessionsQuery.data?.sessions ?? [];

  return (
    <div className="pt-2">
      <ol className="space-y-1 text-sm">
        {sessions.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onOpenSession(s.id)}
              className="w-full flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/20 text-left"
            >
              {s.flagMedicalReview ? (
                <CircleAlert className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-primary-600 shrink-0" aria-hidden="true" />
              )}
              <span className="text-xs text-muted-foreground">#{s.sessionNumber}</span>
              <span>
                {new Intl.DateTimeFormat('pt-BR').format(s.performedAt)}
              </span>
              {s.insufficientStock && (
                <Badge variant="warning" className="ml-auto text-xs">est. insuf.</Badge>
              )}
            </button>
          </li>
        ))}
        {suggestQuery.data?.suggestedAt && (
          <li className="flex items-center gap-2 px-2 py-1 text-muted-foreground">
            <Circle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Próxima sugerida: {new Intl.DateTimeFormat('pt-BR').format(suggestQuery.data.suggestedAt)}</span>
          </li>
        )}
      </ol>
    </div>
  );
}
