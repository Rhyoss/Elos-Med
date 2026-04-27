'use client';

import { useEffect, useState } from 'react';
import { Clock, Users } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, cn } from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { useRealtime } from '@/hooks/use-realtime';
import { ListCardSkeleton, CardError } from './card-states';
import { formatTime } from './formatters';

/**
 * Fila de espera em tempo real — nunca cacheada.
 * Atualiza via Socket.io eventos: appointment.checked_in / completed / cancelled / updated /
 * dashboard:waitQueue:updated (broadcast do server quando handler de cache invalida).
 *
 * Tick de 1 minuto força recálculo do tempo de espera exibido (mesmo sem evento novo).
 */
export function WaitQueueCard() {
  const [, setTick] = useState(0);

  const queueQuery = trpc.dashboard.waitQueue.list.useQuery(undefined, {
    refetchInterval: 30_000, // safety net — ainda assim apoiado em socket
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  useRealtime(
    [
      'appointment.checked_in',
      'appointment.updated',
      'appointment.completed',
      'appointment.cancelled',
      'dashboard:waitQueue:updated',
    ],
    () => { void queueQuery.refetch(); },
  );

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (queueQuery.isLoading) return <ListCardSkeleton rows={4} />;
  if (queueQuery.isError) {
    return (
      <CardError
        title="Fila de espera"
        message="Não foi possível carregar a fila."
        onRetry={() => queueQuery.refetch()}
      />
    );
  }

  const rows = queueQuery.data ?? [];
  const longWaitThreshold = 30; // minutos

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" aria-hidden="true" />
          Fila de espera
          <Badge variant="secondary" className="ml-1" aria-label={`${rows.length} pacientes na fila`}>
            {rows.length}
          </Badge>
        </CardTitle>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          Atualizado em tempo real
        </span>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="Nenhum paciente em espera"
            description="Pacientes aparecem aqui após o check-in."
          />
        ) : (
          <ol className="flex flex-col gap-2" aria-label="Pacientes em espera">
            {rows.map((row) => {
              const isLongWait = row.waitingMinutes >= longWaitThreshold;
              return (
                <li
                  key={row.appointmentId}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border bg-card p-3',
                    isLongWait && 'border-warning-300 bg-warning-50/40',
                  )}
                >
                  <div className="size-9 rounded-full bg-muted shrink-0 grid place-items-center text-xs font-medium" aria-hidden="true">
                    {row.patientPhotoUrl
                      ? <img src={row.patientPhotoUrl} alt="" className="size-9 rounded-full object-cover" />
                      : row.patientName.split(' ').slice(0,2).map((p) => p[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{row.patientName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {row.providerName} {row.serviceName ? `• ${row.serviceName}` : ''}
                    </p>
                  </div>
                  <div
                    className={cn(
                      'flex items-center gap-1 text-xs font-medium tabular-nums shrink-0',
                      isLongWait ? 'text-warning-800' : 'text-muted-foreground',
                    )}
                    aria-label={`Aguardando há ${row.waitingMinutes} minutos desde ${formatTime(row.checkedInAt)}`}
                  >
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {row.waitingMinutes} min
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
