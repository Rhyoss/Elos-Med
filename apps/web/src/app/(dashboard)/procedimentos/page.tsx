'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Btn, Glass, Ico, Mono, PageHero, Skeleton, EmptyState, T } from '@dermaos/ui/ds';
import { PROTOCOL_TYPE_LABELS, PROTOCOL_STATUS_LABELS, type ProtocolStatus, type ProtocolType } from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { PROCEDURE_TYPES } from '../pacientes/[id]/prontuario/_components/procedures/procedure-form';

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  ativo: 'success', pausado: 'warning', concluido: 'default', cancelado: 'danger',
};

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ProcedimentosPage() {
  const router = useRouter();
  const [tab, setTab] = React.useState<'protocolos' | 'procedimentos'>('protocolos');
  const [statusFilter, setStatusFilter] = React.useState<ProtocolStatus | 'all'>('all');

  const protocolsQ = trpc.clinical.protocols.listActive.useQuery(undefined, { staleTime: 30_000 });
  const protocols = protocolsQ.data?.protocols ?? [];

  const filteredProtocols = statusFilter === 'all'
    ? protocols
    : protocols.filter((p) => p.status === statusFilter);

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
          {/* Status filters */}
          {protocols.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              {(['all', 'ativo', 'pausado', 'concluido', 'cancelado'] as const).map((s) => {
                const active = statusFilter === s;
                const label = s === 'all' ? 'Todos' : PROTOCOL_STATUS_LABELS[s];
                const count = s === 'all' ? protocols.length : protocols.filter((p) => p.status === s).length;
                if (s !== 'all' && count === 0) return null;
                return (
                  <button
                    key={s}
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
          )}

          {protocolsQ.isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height={120} delay={i * 80} />
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
            {filteredProtocols.map((p) => {
              const pct = (p.sessionsDone / Math.max(1, p.totalSessions)) * 100;
              return (
                <Glass
                  key={p.id}
                  hover
                  style={{ padding: '18px 22px', cursor: 'pointer' }}
                  onClick={() => router.push(`/pacientes/${p.patientId}/prontuario`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: T.r.md,
                        background: p.status === 'ativo' ? T.successBg : p.status === 'pausado' ? T.warningBg : T.glass,
                        border: `1px solid ${p.status === 'ativo' ? T.successBorder : p.status === 'pausado' ? T.warningBorder : T.glassBorder}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ico name="layers" size={17} color={p.status === 'ativo' ? T.success : p.status === 'pausado' ? T.warning : T.textMuted} />
                      </div>
                      <div>
                        <p style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>
                          {p.name}
                        </p>
                        <Mono size={10} color={T.textMuted}>
                          {PROTOCOL_TYPE_LABELS[p.type as ProtocolType] ?? p.type}
                          {' · Paciente '}{p.patientId.slice(0, 8).toUpperCase()}
                        </Mono>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Badge variant={STATUS_VARIANT[p.status] ?? 'default'}>
                        {PROTOCOL_STATUS_LABELS[p.status as ProtocolStatus] ?? p.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                    <div>
                      <Mono size={9} color={T.textMuted}>SESSÕES</Mono>
                      <p style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>
                        {p.sessionsDone}<span style={{ fontSize: 14, color: T.textMuted }}>/{p.totalSessions}</span>
                      </p>
                    </div>
                    <div>
                      <Mono size={9} color={T.textMuted}>INÍCIO</Mono>
                      <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 4 }}>
                        {formatDate(p.startedAt)}
                      </p>
                    </div>
                    {p.expectedEndDate && (
                      <div>
                        <Mono size={9} color={T.textMuted}>PREVISÃO</Mono>
                        <p style={{ fontSize: 13, color: T.primary, fontWeight: 500, marginTop: 4 }}>
                          {formatDate(p.expectedEndDate)}
                        </p>
                      </div>
                    )}
                    {p.intervalDays && (
                      <div>
                        <Mono size={9} color={T.textMuted}>INTERVALO</Mono>
                        <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 4 }}>
                          {p.intervalDays} dias
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      flex: 1, height: 5, borderRadius: 3,
                      background: T.glassBorder, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        background: T.clinical.color,
                        width: `${Math.min(100, pct)}%`,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    <Mono size={11} color={T.clinical.color}>{Math.round(pct)}%</Mono>
                  </div>
                </Glass>
              );
            })}
          </div>

          {filteredProtocols.length === 0 && protocols.length > 0 && (
            <Glass style={{ padding: '20px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: T.textMuted }}>
                Nenhum protocolo com status "{statusFilter === 'all' ? 'Todos' : PROTOCOL_STATUS_LABELS[statusFilter]}".
              </p>
            </Glass>
          )}
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
  const [search, setSearch] = React.useState('');

  // TODO: quando endpoint de listagem global de procedimentos existir, usar query dedicada.
  // Por enquanto, direcionamos o usuário ao prontuário do paciente.

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search */}
      <Glass style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Ico name="search" size={16} color={T.textMuted} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar paciente para ver procedimentos…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', fontSize: 14,
              fontFamily: "'IBM Plex Sans', sans-serif",
              color: T.textPrimary,
            }}
          />
          {search && (
            <Btn variant="glass" small icon="arrowRight" onClick={() => router.push(`/pacientes?q=${encodeURIComponent(search)}`)}>
              Buscar
            </Btn>
          )}
        </div>
      </Glass>

      {/* Quick access */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        {PROCEDURE_TYPES.map((pt) => (
          <Glass
            key={pt.id}
            hover
            style={{
              padding: '16px 14px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 8, textAlign: 'center',
            }}
            onClick={() => router.push('/pacientes')}
          >
            <div style={{
              width: 40, height: 40, borderRadius: T.r.md,
              background: T.accentMod.bg, border: `1px solid ${T.accentMod.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Ico name={pt.icon} size={18} color={T.accentMod.color} />
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary }}>
              {pt.label}
            </p>
          </Glass>
        ))}
      </div>

      {/* Info */}
      <div style={{
        padding: '14px 18px', borderRadius: T.r.md,
        background: T.infoBg, border: `1px solid ${T.infoBorder}`,
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <Ico name="alert" size={16} color={T.info} style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 13, color: T.info, fontWeight: 500, marginBottom: 4 }}>
            Procedimentos por paciente
          </p>
          <p style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5 }}>
            Procedimentos são registrados dentro do prontuário de cada paciente, na aba "Procedimentos".
            Selecione um paciente para visualizar, registrar procedimentos e acompanhar protocolos seriados.
          </p>
        </div>
      </div>
    </div>
  );
}
