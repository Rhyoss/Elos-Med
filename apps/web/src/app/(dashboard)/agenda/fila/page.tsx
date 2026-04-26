'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, PlayCircle, CheckCircle2, UserCheck } from 'lucide-react';
import { cn, useToast } from '@dermaos/ui';
import {
  Btn, Glass, Mono, EmptyState,
  PageHero, formatHeroDate, T,
} from '@dermaos/ui/ds';
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
    <div style={{ overflowY: 'auto', height: '100%', padding: '22px 26px' }}>
      <PageHero
        eyebrow={formatHeroDate(new Date())}
        title="Fila de Espera"
        module="clinical"
        icon="clock"
        description={`${entries.length} paciente${entries.length === 1 ? '' : 's'} aguardando atendimento`}
        actions={
          <Link href="/agenda" style={{ textDecoration: 'none' }}>
            <Btn variant="glass" small icon="arrowLeft">Voltar à Agenda</Btn>
          </Link>
        }
      />

      {queueQuery.isLoading ? (
        <Glass style={{ padding: 32, textAlign: 'center' }}>
          <Mono size={9} color={T.textMuted}>CARREGANDO FILA…</Mono>
        </Glass>
      ) : entries.length === 0 ? (
        <EmptyState
          icon="users"
          title="Fila vazia"
          description="Nenhum paciente fez check-in. Eles aparecerão aqui automaticamente."
        />
      ) : (
        <div role="list" aria-label="Fila de espera" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((entry, index) => {
            const isInProgress = entry.status === 'in_progress';
            const waiting = entry.waitingMinutes;
            const isOverdue = waiting > 30 && !isInProgress;
            const checkedInAt = new Date(entry.checkedInAt);
            const scheduledAt = new Date(entry.scheduledAt);

            const accentColor = isInProgress
              ? T.success
              : isOverdue
                ? T.danger
                : T.clinical.color;

            return (
              <Glass
                key={entry.appointmentId}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 16,
                  padding: 16,
                  borderLeft: `3px solid ${accentColor}`,
                }}
              >
                {/* Posição na fila */}
                <div
                  aria-label={`Posição ${index + 1} na fila`}
                  style={{
                    width: 40,
                    height: 40,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    background: isInProgress ? T.success : T.clinical.bg,
                    color: isInProgress ? '#fff' : T.clinical.color,
                    fontWeight: 700,
                    fontSize: 14,
                    border: isInProgress ? 'none' : `1px solid ${T.clinical.color}30`,
                  }}
                >
                  {isInProgress ? <PlayCircle className="h-5 w-5" aria-hidden="true" /> : index + 1}
                </div>

                {/* Paciente */}
                <div style={{ flex: 1, minWidth: 220 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, lineHeight: 1.2 }}>
                    {entry.patientName}
                  </p>
                  <Mono size={9}>
                    {entry.providerName}
                    {entry.serviceName ? ` · ${entry.serviceName}` : ''}
                  </Mono>
                </div>

                {/* Horários */}
                <div style={{ minWidth: 150, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Mono size={9}>
                    CHECK-IN {format(checkedInAt, 'HH:mm', { locale: ptBR })}
                  </Mono>
                  <Mono size={9} color={T.textTertiary}>
                    AGENDADO {format(scheduledAt, 'HH:mm', { locale: ptBR })}
                  </Mono>
                </div>

                {/* Tempo de espera */}
                <div
                  style={{
                    minWidth: 90,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600,
                    color: accentColor,
                    fontFamily: "'IBM Plex Sans', sans-serif",
                  }}
                  aria-label={isInProgress ? 'Em atendimento' : `Aguardando há ${waiting} minutos`}
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

                {/* Ações */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {isInProgress ? (
                    <Link href={`/pacientes/${entry.patientId}/prontuario`} style={{ textDecoration: 'none' }}>
                      <Btn variant="glass" small icon="arrowRight">Continuar</Btn>
                    </Link>
                  ) : (
                    <Btn
                      small
                      icon="check"
                      onClick={() => handleStart(entry.appointmentId, entry.patientId)}
                      loading={
                        startMut.isPending &&
                        startMut.variables?.id === entry.appointmentId
                      }
                    >
                      Iniciar
                    </Btn>
                  )}
                </div>
              </Glass>
            );
          })}
        </div>
      )}
    </div>
  );
}
