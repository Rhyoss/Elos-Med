'use client';

import Link from 'next/link';
import {
  Cake, Calendar, CalendarCheck, Phone, Plus, UserPlus, AlertCircle,
} from 'lucide-react';
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle,
  EmptyState, PageHeader, cn,
} from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { useRealtime } from '@/hooks/use-realtime';
import { CardError, KpiCardSkeleton, ListCardSkeleton } from './card-states';
import { formatTime } from './formatters';
import { KpiCard } from './kpi-card';
import { WaitQueueCard } from './wait-queue-card';

export function ReceptionDashboard() {
  const dashQuery = trpc.dashboard.reception.useQuery({}, {
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  useRealtime(
    [
      'appointment.created', 'appointment.updated', 'appointment.cancelled',
      'appointment.checked_in', 'appointment.completed', 'patient.created',
    ],
    () => { void dashQuery.refetch(); },
  );

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        eyebrow="Recepção"
        title="Sua estação de hoje"
        description="Agenda do dia, fila de espera e ações rápidas."
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link href="/agenda"><Plus className="h-4 w-4" /> Novo agendamento</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/pacientes/novo"><UserPlus className="h-4 w-4" /> Novo paciente</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/comunicacoes"><Phone className="h-4 w-4" /> Comunicações</Link>
            </Button>
          </div>
        }
      />

      {/* KPIs / alertas — números grandes do dia */}
      <section aria-label="Alertas do dia" className="px-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {dashQuery.isLoading ? (
            <>
              <KpiCardSkeleton /><KpiCardSkeleton /><KpiCardSkeleton /><KpiCardSkeleton />
            </>
          ) : dashQuery.isError ? (
            <CardError title="Alertas do dia" onRetry={() => dashQuery.refetch()} />
          ) : (
            <>
              <KpiCard
                label="Agendamentos hoje"
                value={dashQuery.data!.agenda.length}
                trendPct={null}
                unit="count"
                icon={<Calendar />}
              />
              <KpiCard
                label="Confirmações pendentes (amanhã)"
                value={dashQuery.data!.alerts.pendingConfirmations}
                trendPct={null}
                unit="count"
                icon={<CalendarCheck />}
              />
              <KpiCard
                label="Pacientes com débito"
                value={dashQuery.data!.alerts.pendingDebts}
                trendPct={null}
                unit="count"
                icon={<AlertCircle />}
              />
              <KpiCard
                label="Aniversariantes hoje"
                value={dashQuery.data!.alerts.birthdaysToday}
                trendPct={null}
                unit="count"
                icon={<Cake />}
              />
            </>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6">
        <div className="lg:col-span-2">
          <AgendaListCard
            isLoading={dashQuery.isLoading}
            isError={dashQuery.isError}
            onRetry={() => dashQuery.refetch()}
            agenda={dashQuery.data?.agenda ?? []}
          />
        </div>
        <div>
          <WaitQueueCard />
        </div>
      </div>
    </div>
  );
}

function AgendaListCard({
  isLoading, isError, onRetry, agenda,
}: {
  isLoading: boolean; isError: boolean; onRetry: () => void;
  agenda: NonNullable<ReturnType<typeof trpc.dashboard.reception.useQuery>['data']>['agenda'];
}) {
  if (isLoading) return <ListCardSkeleton rows={6} />;
  if (isError) return <CardError title="Agenda do dia" onRetry={onRetry} />;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" aria-hidden="true" />
          Agenda do dia
          <Badge variant="secondary">{agenda.length}</Badge>
        </CardTitle>
        <Link href="/agenda" className="text-sm text-primary-700 hover:underline">Abrir agenda</Link>
      </CardHeader>
      <CardContent>
        {agenda.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-8 w-8" />}
            title="Nenhum agendamento hoje"
            description="Comece criando um novo agendamento."
          />
        ) : (
          <ol className="flex flex-col divide-y" aria-label="Agenda completa do dia">
            {agenda.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <span className="text-sm font-medium tabular-nums w-14 shrink-0">{formatTime(a.scheduledAt)}</span>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/pacientes/${a.patientId}/perfil`}
                    className="text-sm font-medium hover:underline truncate block"
                  >
                    {a.patientName}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.providerName} {a.serviceName ? `• ${a.serviceName}` : `• ${a.type}`}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    a.status === 'waiting' && 'bg-warning-100 text-warning-800 border-warning-200',
                    a.status === 'in_progress' && 'bg-primary-100 text-primary-800 border-primary-200',
                    a.status === 'completed' && 'bg-success-100 text-success-800 border-success-200',
                    a.status === 'no_show' && 'bg-danger-100 text-danger-800 border-danger-200',
                  )}
                >
                  {STATUS_LABEL[a.status] ?? a.status}
                </Badge>
              </li>
            ))}
          </ol>
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
