'use client';

import Link from 'next/link';
import { Calendar, ClipboardList, Microscope, Sparkles, UserMinus, ArrowRight } from 'lucide-react';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  cn,
} from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { useRealtime } from '@/hooks/use-realtime';
import { CardError, KpiCardSkeleton, ListCardSkeleton } from './card-states';
import { formatDate, formatTime } from './formatters';
import { KpiCard } from './kpi-card';

export function DoctorDashboard() {
  const dashQuery = trpc.dashboard.doctor.useQuery({}, {
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  // Eventos que invalidam o dashboard do médico
  useRealtime(
    [
      'appointment.checked_in', 'appointment.updated', 'appointment.completed',
      'appointment.cancelled', 'appointment.created',
    ],
    () => { void dashQuery.refetch(); },
  );

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        eyebrow="Hoje"
        title={dashQuery.data?.greeting.text ?? 'Carregando...'}
        description="Sua agenda, prioridades clínicas e alertas do dia."
      />

      {/* Stats do mês */}
      <section aria-label="Estatísticas do mês" className="px-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {dashQuery.isLoading ? (
            <>
              <KpiCardSkeleton />
              <KpiCardSkeleton />
              <KpiCardSkeleton />
            </>
          ) : dashQuery.isError ? (
            <CardError
              title="Estatísticas do mês"
              onRetry={() => dashQuery.refetch()}
            />
          ) : (
            <>
              <KpiCard
                label="Consultas no mês"
                value={dashQuery.data!.monthStats.consultations}
                trendPct={null}
                unit="count"
                icon={<Calendar />}
              />
              <KpiCard
                label="Pacientes novos"
                value={dashQuery.data!.monthStats.newPatients}
                trendPct={null}
                unit="count"
              />
              <KpiCard
                label="Procedimentos"
                value={dashQuery.data!.monthStats.procedures}
                trendPct={null}
                unit="count"
                icon={<Sparkles />}
              />
            </>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6">
        {/* Agenda + próximo paciente */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <NextPatientCard
            isLoading={dashQuery.isLoading}
            isError={dashQuery.isError}
            onRetry={() => dashQuery.refetch()}
            data={dashQuery.data?.nextPatient ?? null}
          />
          <AgendaCard
            isLoading={dashQuery.isLoading}
            isError={dashQuery.isError}
            onRetry={() => dashQuery.refetch()}
            agenda={dashQuery.data?.agenda ?? []}
          />
        </div>

        {/* Coluna lateral: biópsias + protocolos + sem retorno */}
        <div className="flex flex-col gap-6">
          <BiopsiesCard
            isLoading={dashQuery.isLoading}
            isError={dashQuery.isError}
            onRetry={() => dashQuery.refetch()}
            data={dashQuery.data?.pendingBiopsies}
          />
          <ProtocolsCard
            isLoading={dashQuery.isLoading}
            isError={dashQuery.isError}
            onRetry={() => dashQuery.refetch()}
            data={dashQuery.data?.protocolsToday ?? []}
          />
          <NoReturnCard
            isLoading={dashQuery.isLoading}
            isError={dashQuery.isError}
            onRetry={() => dashQuery.refetch()}
            data={dashQuery.data?.noReturn30d ?? []}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Sub-cards ────────────────────────────────────────────────────────────── */

function NextPatientCard({
  isLoading, isError, onRetry, data,
}: {
  isLoading: boolean; isError: boolean; onRetry: () => void;
  data: NonNullable<ReturnType<typeof trpc.dashboard.doctor.useQuery>['data']>['nextPatient'] | null;
}) {
  if (isLoading) return <ListCardSkeleton rows={1} />;
  if (isError) return <CardError title="Próximo paciente" onRetry={onRetry} />;

  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Próximo paciente</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<Calendar className="h-8 w-8" />}
            title="Sem próximos atendimentos"
            description="Aproveite para revisar prontuários ou ajustar protocolos."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="accent" className="surface-brand-soft">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Próximo paciente</CardTitle>
          <Badge variant="primary" size="sm" pulse>{formatTime(data.scheduledAt)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <div className="size-14 rounded-full bg-card ring-2 ring-primary-200 shrink-0 grid place-items-center text-sm font-semibold overflow-hidden text-primary-700" aria-hidden="true">
          {data.patientPhotoUrl
            ? <img src={data.patientPhotoUrl} alt="" className="size-14 object-cover" />
            : data.patientName.split(' ').slice(0,2).map((p) => p[0]).join('')}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold truncate tracking-tight">{data.patientName}</p>
          <p className="text-sm text-muted-foreground truncate">
            {data.serviceName ?? data.type}
          </p>
        </div>
        <Link
          href={`/pacientes/${data.patientId}/prontuario`}
          className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Abrir prontuário
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}

function AgendaCard({
  isLoading, isError, onRetry, agenda,
}: {
  isLoading: boolean; isError: boolean; onRetry: () => void;
  agenda: NonNullable<ReturnType<typeof trpc.dashboard.doctor.useQuery>['data']>['agenda'];
}) {
  if (isLoading) return <ListCardSkeleton rows={5} />;
  if (isError) return <CardError title="Agenda de hoje" onRetry={onRetry} />;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" aria-hidden="true" />
          Agenda de hoje
          <Badge variant="secondary">{agenda.length}</Badge>
        </CardTitle>
        <Link href="/agenda" className="text-sm text-primary-700 hover:underline">Ver agenda</Link>
      </CardHeader>
      <CardContent>
        {agenda.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-8 w-8" />}
            title="Nenhum atendimento hoje"
            description="Sua agenda está livre."
          />
        ) : (
          <ol className="flex flex-col divide-y" aria-label="Lista de atendimentos do dia">
            {agenda.map((a) => {
              const inProgress = a.status === 'in_progress';
              const waiting    = a.status === 'waiting';
              const completed  = a.status === 'completed';
              return (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <span className="text-sm font-medium tabular-nums w-14 shrink-0">{formatTime(a.scheduledAt)}</span>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/pacientes/${a.patientId}/prontuario`}
                      className="text-sm font-medium hover:underline truncate block"
                    >
                      {a.patientName}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.serviceName ?? a.type}
                    </p>
                  </div>
                  <Badge
                    variant={inProgress ? 'primary' : waiting ? 'warning' : completed ? 'success' : 'neutral'}
                    size="sm"
                    dot={inProgress || waiting}
                    pulse={inProgress}
                  >
                    {STATUS_LABEL[a.status] ?? a.status}
                  </Badge>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function BiopsiesCard({
  isLoading, isError, onRetry, data,
}: {
  isLoading: boolean; isError: boolean; onRetry: () => void;
  data: NonNullable<ReturnType<typeof trpc.dashboard.doctor.useQuery>['data']>['pendingBiopsies'] | undefined;
}) {
  if (isLoading) return <ListCardSkeleton rows={3} />;
  if (isError) return <CardError title="Biópsias pendentes" onRetry={onRetry} />;

  const items = data?.items ?? [];
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Microscope className="h-4 w-4" aria-hidden="true" />
          Biópsias pendentes
          <Badge variant="secondary">{data?.count ?? 0}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma biópsia pendente.</p>
        ) : (
          <ul className="flex flex-col divide-y" aria-label="Biópsias pendentes do médico">
            {items.map((b) => (
              <li key={b.id} className="py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <Link href={`/pacientes/${b.patientId}/prontuario`} className="text-sm font-medium hover:underline truncate block">
                    {b.patientName}
                  </Link>
                  <p className="text-xs text-muted-foreground">{formatDate(b.collectedAt)} • {b.type}</p>
                </div>
                <Badge variant="outline" className="text-xs">{b.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ProtocolsCard({
  isLoading, isError, onRetry, data,
}: {
  isLoading: boolean; isError: boolean; onRetry: () => void;
  data: NonNullable<ReturnType<typeof trpc.dashboard.doctor.useQuery>['data']>['protocolsToday'];
}) {
  if (isLoading) return <ListCardSkeleton rows={3} />;
  if (isError) return <CardError title="Protocolos de hoje" onRetry={onRetry} />;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          Protocolos hoje
          <Badge variant="secondary">{data.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem sessões de protocolo agendadas.</p>
        ) : (
          <ul className="flex flex-col divide-y" aria-label="Sessões de protocolo de hoje">
            {data.map((p) => (
              <li key={`${p.protocolId}-${p.sessionN}`} className="py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.patientName}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.protocolName}</p>
                </div>
                <Badge variant="outline" className="text-xs tabular-nums">
                  Sessão {p.sessionN}/{p.totalSessions}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function NoReturnCard({
  isLoading, isError, onRetry, data,
}: {
  isLoading: boolean; isError: boolean; onRetry: () => void;
  data: NonNullable<ReturnType<typeof trpc.dashboard.doctor.useQuery>['data']>['noReturn30d'];
}) {
  if (isLoading) return <ListCardSkeleton rows={3} />;
  if (isError) return <CardError title="Sem retorno" onRetry={onRetry} />;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <UserMinus className="h-4 w-4" aria-hidden="true" />
          Sem retorno &gt; 30 dias
          <Badge variant="secondary">{data.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos os pacientes em dia. ✓</p>
        ) : (
          <ul className="flex flex-col divide-y" aria-label="Pacientes sem retorno há mais de 30 dias">
            {data.map((p) => (
              <li key={p.patientId} className="py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <Link href={`/pacientes/${p.patientId}/prontuario`} className="text-sm font-medium hover:underline truncate block">
                    {p.patientName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {p.lastVisitAt ? `Último em ${formatDate(p.lastVisitAt)}` : 'Sem histórico de visita'}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs tabular-nums">
                  {p.daysSinceVisit}d
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const STATUS_LABEL: Record<string, string> = {
  scheduled:    'Agendado',
  confirmed:    'Confirmado',
  waiting:      'Aguardando',
  in_progress:  'Em atendimento',
  completed:    'Concluído',
  cancelled:    'Cancelado',
  no_show:      'Faltou',
  rescheduled:  'Remarcado',
};
