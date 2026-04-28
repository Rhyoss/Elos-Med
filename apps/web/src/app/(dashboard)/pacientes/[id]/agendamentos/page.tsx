'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Btn,
  EmptyState,
  Glass,
  Ico,
  Mono,
  PageHero,
  Skeleton,
  T,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';

type PageParams = Promise<{ id: string }>;

const STATUS_LABEL: Record<string, string> = {
  confirmed:  'Confirmado',
  pending:    'Aguardando',
  in_room:    'Em sala',
  completed:  'Realizado',
  cancelled:  'Cancelado',
  no_show:    'Faltou',
};

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  confirmed:  'success',
  pending:    'warning',
  in_room:    'default',
  completed:  'success',
  cancelled:  'danger',
  no_show:    'danger',
};

function fmtDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day:     '2-digit',
    month:   'short',
    year:    'numeric',
  }).format(date);
}

function fmtTime(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat('pt-BR', {
    hour:   '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Patient appointments tab. Today's agenda comes from
 * `scheduling.agendaDay`; the result is filtered client-side to the
 * current patient. For the full historical list, the user is routed to the
 * main `/agenda` view filtered by patient.
 */
export default function PatientAgendamentosPage({ params }: { params: PageParams }) {
  const { id: patientId } = React.use(params);
  const router = useRouter();

  const today = React.useMemo(() => new Date(), []);

  const agendaQ = trpc.scheduling.agendaDay.useQuery(
    { date: today },
    { staleTime: 30_000 },
  );

  const allAppts = agendaQ.data?.appointments ?? [];
  const patientAppts = allAppts.filter((a) => a.patient.id === patientId);

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
        eyebrow="AGENDAMENTOS DO PACIENTE"
        title="Próximos compromissos"
        module="clinical"
        icon="calendar"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn
              variant="glass"
              small
              icon="calendar"
              onClick={() => router.push(`/agenda?paciente=${patientId}`)}
            >
              Histórico completo
            </Btn>
            <Btn
              small
              icon="plus"
              onClick={() => router.push(`/agenda?paciente=${patientId}&novo=1`)}
            >
              Novo agendamento
            </Btn>
          </div>
        }
      />

      <div>
        <Mono size={9} spacing="1.1px" color={T.primary}>
          HOJE — {fmtDate(today).toUpperCase()}
        </Mono>
        <div style={{ marginTop: 8 }}>
          {agendaQ.isLoading ? (
            <Skeleton height={120} radius={16} />
          ) : patientAppts.length === 0 ? (
            <Glass style={{ padding: 20 }}>
              <EmptyState
                icon="calendar"
                title="Sem compromissos hoje"
                description="O paciente não tem nenhum agendamento na data de hoje."
                action={
                  <Btn
                    variant="glass"
                    small
                    icon="plus"
                    onClick={() => router.push(`/agenda?paciente=${patientId}&novo=1`)}
                  >
                    Agendar consulta
                  </Btn>
                }
              />
            </Glass>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {patientAppts.map((appt) => (
                <Glass key={appt.id} hover style={{ padding: '14px 18px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div
                        style={{
                          width: 60,
                          textAlign: 'center',
                          padding: '4px 0',
                          borderRadius: T.r.md,
                          background: T.clinical.bg,
                          border: `1px solid ${T.clinical.color}18`,
                        }}
                      >
                        <p
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: T.clinical.color,
                            margin: 0,
                            fontFamily: "'IBM Plex Mono', monospace",
                          }}
                        >
                          {fmtTime(appt.scheduledAt)}
                        </p>
                      </div>
                      <div>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: T.textPrimary,
                            margin: 0,
                          }}
                        >
                          {appt.service?.name ?? 'Consulta'}
                        </p>
                        <Mono size={9}>{fmtDate(appt.scheduledAt)}</Mono>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Badge
                        variant={STATUS_VARIANT[appt.status] ?? 'default'}
                        dot={false}
                      >
                        {STATUS_LABEL[appt.status] ?? appt.status}
                      </Badge>
                      <Btn
                        variant="ghost"
                        small
                        icon="arrowRight"
                        onClick={() =>
                          router.push(`/agenda?paciente=${patientId}&id=${appt.id}`)
                        }
                      >
                        Abrir
                      </Btn>
                    </div>
                  </div>
                </Glass>
              ))}
            </div>
          )}
        </div>
      </div>

      <Glass style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: T.r.md,
              background: T.glass,
              border: `1px solid ${T.glassBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Ico name="clock" size={15} color={T.textMuted} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: 0 }}>
              Histórico de agendamentos passados
            </p>
            <p style={{ fontSize: 11, color: T.textMuted, margin: '2px 0 0' }}>
              Veja consultas anteriores na aba <strong>Prontuário</strong> ou navegue para a Agenda
              filtrada por este paciente.
            </p>
          </div>
        </div>
      </Glass>
    </div>
  );
}
