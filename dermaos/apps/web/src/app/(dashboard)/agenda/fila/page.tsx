'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, PlayCircle, CheckCircle2, UserCheck } from 'lucide-react';
import {
  Button,
  EmptyState,
  PageHeader,
  cn,
  useToast,
} from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { useRealtime } from '@/hooks/use-realtime';

export default function FilaEsperaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [, setTick] = useState(0);

  const queueQuery = trpc.scheduling.waitQueue.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const startMut = trpc.scheduling.start.useMutation();

  useRealtime(
    ['appointment.checked_in', 'appointment.updated', 'appointment.created'],
    () => {
      void queueQuery.refetch();
    },
  );

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const entries = queueQuery.data?.queue ?? [];

  async function handleStart(appointmentId: string, patientId: string) {
    try {
      await startMut.mutateAsync({ id: appointmentId });
      toast.success('Atendimento iniciado');
      router.push(`/pacientes/${patientId}/prontuario`);
    } catch (err) {
      toast.error('Erro ao iniciar', {
        description: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Fila de Espera"
        description={`${entries.length} paciente${entries.length === 1 ? '' : 's'} aguardando`}
        actions={
          <Link href="/agenda">
            <Button variant="outline" size="sm">Voltar à Agenda</Button>
          </Link>
        }
      />

      {queueQuery.isLoading ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Carregando fila...
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="h-12 w-12" />}
          title="Fila vazia"
          description="Nenhum paciente fez check-in. Eles aparecerão aqui automaticamente."
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Fila de espera">
          {entries.map((entry, index) => {
            const isInProgress = entry.status === 'in_progress';
            const waiting = entry.waitingMinutes;
            const isOverdue = waiting > 30 && !isInProgress;
            const checkedInAt = new Date(entry.checkedInAt);
            const scheduledAt = new Date(entry.scheduledAt);

            return (
              <li
                key={entry.appointmentId}
                className={cn(
                  'flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4 shadow-sm',
                  isInProgress && 'border-green-500/40 bg-green-50/40',
                  isOverdue && 'border-red-300 bg-red-50/30',
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold',
                    isInProgress
                      ? 'bg-green-600 text-white'
                      : 'bg-primary-100 text-primary-900',
                  )}
                  aria-label={`Posição ${index + 1} na fila`}
                >
                  {isInProgress ? (
                    <PlayCircle className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </div>

                <div className="flex-1 min-w-[220px]">
                  <p className="font-semibold text-foreground leading-tight">
                    {entry.patientName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.providerName}
                    {entry.serviceName ? ` • ${entry.serviceName}` : ''}
                  </p>
                </div>

                <div className="flex flex-col items-start text-xs text-muted-foreground min-w-[150px]">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Check-in às {format(checkedInAt, 'HH:mm', { locale: ptBR })}
                  </span>
                  <span>
                    Agendado para {format(scheduledAt, 'HH:mm', { locale: ptBR })}
                  </span>
                </div>

                <div
                  className={cn(
                    'flex items-center gap-1 text-sm font-medium tabular-nums min-w-[90px]',
                    isOverdue && 'text-danger-700',
                    isInProgress && 'text-green-700',
                    !isOverdue && !isInProgress && 'text-foreground',
                  )}
                  aria-label={
                    isInProgress
                      ? 'Em atendimento'
                      : `Aguardando há ${waiting} minutos`
                  }
                >
                  {isInProgress ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Em atendimento
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      {waiting} min
                      {isOverdue && <span className="sr-only"> (atrasado)</span>}
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  {isInProgress ? (
                    <Link href={`/pacientes/${entry.patientId}/prontuario`}>
                      <Button size="sm" variant="outline">
                        Continuar Atendimento
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleStart(entry.appointmentId, entry.patientId)}
                      isLoading={
                        startMut.isPending &&
                        startMut.variables?.id === entry.appointmentId
                      }
                    >
                      Iniciar Atendimento
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
