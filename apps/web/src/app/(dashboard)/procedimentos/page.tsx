'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Btn, Glass, Ico, Mono, PageHero, Skeleton, EmptyState, T } from '@dermaos/ui/ds';
import { PROTOCOL_TYPE_LABELS, PROTOCOL_STATUS_LABELS, type ProtocolStatus, type ProtocolType } from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  ativo: 'success', pausado: 'warning', concluido: 'default', cancelado: 'danger',
};

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ProcedimentosPage() {
  const router = useRouter();
  const [tab, setTab] = React.useState<'protocolos' | 'procedimentos'>('protocolos');

  const protocolsQ = trpc.clinical.protocols.listActive.useQuery(undefined, { staleTime: 30_000 });
  const protocols = protocolsQ.data?.protocols ?? [];

  return (
    <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
      <PageHero
        eyebrow="Clínico"
        title="Procedimentos & Protocolos"
        description="Catálogo de protocolos seriados e histórico de procedimentos realizados"
      />

      {/* Tab switch */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['protocolos', 'procedimentos'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: '8px 18px', borderRadius: T.r.md,
              background: tab === t ? T.primaryBg : 'transparent',
              border: `1px solid ${tab === t ? T.primaryBorder : 'transparent'}`,
              color: tab === t ? T.primary : T.textMuted,
              fontSize: 13, fontWeight: tab === t ? 600 : 400,
              fontFamily: "'IBM Plex Sans', sans-serif",
              cursor: 'pointer',
            }}
          >
            {t === 'protocolos' ? 'Protocolos ativos' : 'Procedimentos recentes'}
          </button>
        ))}
      </div>

      {tab === 'protocolos' && (
        <div>
          {protocolsQ.isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height={100} delay={i * 80} />
              ))}
            </div>
          )}

          {!protocolsQ.isLoading && protocols.length === 0 && (
            <EmptyState
              label="PROTOCOLOS"
              icon="layers"
              title="Nenhum protocolo ativo"
              description="Protocolos seriados aparecem aqui quando estão em andamento. Crie protocolos a partir do prontuário de cada paciente."
            />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {protocols.map((p) => {
              const pct = (p.sessionsDone / Math.max(1, p.totalSessions)) * 100;
              return (
                <Glass
                  key={p.id}
                  hover
                  style={{ padding: '16px 20px', cursor: 'pointer' }}
                  onClick={() => router.push(`/pacientes/${p.patientId}/prontuario`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: T.r.md,
                        background: T.clinical.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ico name="layers" size={17} color={T.clinical.color} />
                      </div>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
                          {p.name}
                        </p>
                        <Mono size={10} color={T.textMuted}>
                          {PROTOCOL_TYPE_LABELS[p.type as ProtocolType] ?? p.type}
                          {' · '}{p.patientId.slice(0, 8)}
                        </Mono>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Badge variant={STATUS_VARIANT[p.status] ?? 'default'}>
                        {PROTOCOL_STATUS_LABELS[p.status as ProtocolStatus] ?? p.status}
                      </Badge>
                      <Mono size={11} color={T.clinical.color}>
                        {p.sessionsDone}/{p.totalSessions}
                      </Mono>
                    </div>
                  </div>

                  {/* Progress */}
                  <div style={{
                    height: 4, borderRadius: 2,
                    background: T.glassBorder, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      background: T.clinical.color,
                      width: `${Math.min(100, pct)}%`,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <Mono size={9} color={T.textMuted}>
                      Início: {formatDate(p.startedAt)}
                    </Mono>
                    {p.expectedEndDate && (
                      <Mono size={9} color={T.textMuted}>
                        Previsão: {formatDate(p.expectedEndDate)}
                      </Mono>
                    )}
                  </div>
                </Glass>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'procedimentos' && (
        <RecentProcedures />
      )}
    </div>
  );
}

function RecentProcedures() {
  const router = useRouter();

  // TODO: when a dedicated procedures listing endpoint exists, use it.
  // For now we show a guidance message since procedures are encounter-based.
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '60px 24px', textAlign: 'center', gap: 12,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: T.accentBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Ico name="zap" size={24} color={T.accent} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
        Procedimentos por paciente
      </p>
      <p style={{ fontSize: 13, color: T.textSecondary, maxWidth: 420 }}>
        Procedimentos dermatológicos são registrados dentro do prontuário de cada paciente, na aba "Procedimentos". Acesse o prontuário do paciente para visualizar e registrar procedimentos.
      </p>
      <Btn variant="glass" small icon="search" onClick={() => router.push('/pacientes')}>
        Buscar paciente
      </Btn>
    </div>
  );
}
