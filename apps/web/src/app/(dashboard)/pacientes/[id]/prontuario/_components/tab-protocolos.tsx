'use client';

import { Badge, Bar, Btn, Glass, Ico, Mono, EmptyState, Skeleton, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';

interface TabProtocolosProps {
  patientId: string;
}

const STATUS_LABEL: Record<string, string> = {
  ativo:     'Em andamento',
  pausado:   'Pausado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  ativo:     'success',
  pausado:   'warning',
  concluido: 'default',
  cancelado: 'danger',
};

const STATUS_ICON: Record<string, 'zap' | 'clock' | 'check' | 'x'> = {
  ativo:     'zap',
  pausado:   'clock',
  concluido: 'check',
  cancelado: 'x',
};

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TabProtocolos({ patientId }: TabProtocolosProps) {
  const listQ = trpc.clinical.protocols.listByPatient.useQuery({ patientId });

  if (listQ.isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} height={140} delay={i * 80} />
        ))}
      </div>
    );
  }

  const items = listQ.data?.protocols ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        label="PROTOCOLOS"
        icon="layers"
        title="Nenhum protocolo"
        description="Protocolos de tratamento seriados (peeling, laser, fototerapia, rejuvenescimento) aparecerão aqui quando criados."
        action={
          <Btn small icon="layers" disabled>
            Novo protocolo
          </Btn>
        }
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Mono size={11} spacing="1.2px" color={T.primary}>
        {items.length} {items.length === 1 ? 'PROTOCOLO' : 'PROTOCOLOS'}
      </Mono>

      {items.map((p) => {
        const pct = (p.sessionsDone / Math.max(1, p.totalSessions)) * 100;
        const statusIcon = STATUS_ICON[p.status] ?? 'layers';
        return (
          <Glass key={p.id} hover style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: T.r.md,
                    background: p.status === 'ativo' ? T.successBg : p.status === 'pausado' ? T.warningBg : T.glass,
                    border: `1px solid ${p.status === 'ativo' ? T.successBorder : p.status === 'pausado' ? T.warningBorder : T.glassBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Ico name={statusIcon} size={18} color={p.status === 'ativo' ? T.success : p.status === 'pausado' ? T.warning : T.textMuted} />
                </div>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary }}>{p.name}</p>
                  <Mono size={11}>{p.id.slice(0, 8).toUpperCase()} · {p.type}</Mono>
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[p.status] ?? 'default'}>
                {STATUS_LABEL[p.status] ?? p.status}
              </Badge>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: T.r.md,
                  background: T.glass,
                  border: `1px solid ${T.glassBorder}`,
                  textAlign: 'center',
                }}
              >
                <Mono size={9}>SESSÕES</Mono>
                <p style={{ fontSize: 26, fontWeight: 700, color: T.textPrimary, marginTop: 3 }}>
                  {p.sessionsDone}
                  <span style={{ fontSize: 16, color: T.textMuted }}>/{p.totalSessions}</span>
                </p>
              </div>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: T.r.md,
                  background: T.primaryBg,
                  border: `1px solid ${T.primaryBorder}`,
                  textAlign: 'center',
                }}
              >
                <Mono size={9} color={T.primary}>INÍCIO</Mono>
                <p style={{ fontSize: 15, color: T.textPrimary, marginTop: 5, fontWeight: 500 }}>
                  {formatDate(p.startedAt)}
                </p>
              </div>
              {p.expectedEndDate && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: T.r.md,
                    background: T.glass,
                    border: `1px solid ${T.glassBorder}`,
                    textAlign: 'center',
                  }}
                >
                  <Mono size={9}>PREVISÃO</Mono>
                  <p style={{ fontSize: 15, fontWeight: 600, color: T.primary, marginTop: 5 }}>
                    {formatDate(p.expectedEndDate)}
                  </p>
                </div>
              )}
              {p.intervalDays && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: T.r.md,
                    background: T.glass,
                    border: `1px solid ${T.glassBorder}`,
                    textAlign: 'center',
                  }}
                >
                  <Mono size={9}>INTERVALO</Mono>
                  <p style={{ fontSize: 15, color: T.textSecondary, marginTop: 5 }}>
                    {p.intervalDays} dias
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Bar pct={pct} color={T.clinical.color} height={6} />
              </div>
              <Mono size={11} color={T.clinical.color}>{Math.round(pct)}%</Mono>
            </div>
          </Glass>
        );
      })}
    </div>
  );
}
