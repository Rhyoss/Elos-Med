'use client';

import { Badge, Bar, Glass, Mono, T } from '@dermaos/ui/ds';
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

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TabProtocolos({ patientId }: TabProtocolosProps) {
  const listQ = trpc.clinical.protocols.listByPatient.useQuery({ patientId });

  if (listQ.isLoading) {
    return <p style={{ fontSize: 12, color: T.textMuted }}>Carregando protocolos…</p>;
  }
  const items = listQ.data?.protocols ?? [];
  if (items.length === 0) {
    return <p style={{ fontSize: 12, color: T.textMuted }}>Nenhum protocolo registrado.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((p) => (
        <Glass key={p.id} style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary }}>{p.name}</p>
              <Mono size={9}>{p.id.slice(0, 8).toUpperCase()} · {p.type}</Mono>
            </div>
            <Badge variant={STATUS_VARIANT[p.status] ?? 'default'}>
              {STATUS_LABEL[p.status] ?? p.status}
            </Badge>
          </div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
            <div>
              <Mono size={7}>SESSÕES</Mono>
              <p style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, marginTop: 3 }}>
                {p.sessionsDone}
                <span style={{ fontSize: 14, color: T.textMuted }}>/{p.totalSessions}</span>
              </p>
            </div>
            <div>
              <Mono size={7}>INÍCIO</Mono>
              <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 3 }}>{formatDate(p.startedAt)}</p>
            </div>
            {p.expectedEndDate && (
              <div>
                <Mono size={7}>PREVISÃO</Mono>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.primary, marginTop: 3 }}>
                  {formatDate(p.expectedEndDate)}
                </p>
              </div>
            )}
            {p.intervalDays && (
              <div>
                <Mono size={7}>INTERVALO</Mono>
                <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 3 }}>{p.intervalDays}d</p>
              </div>
            )}
          </div>
          <Bar
            pct={(p.sessionsDone / Math.max(1, p.totalSessions)) * 100}
            color={T.clinical.color}
            height={6}
          />
        </Glass>
      ))}
    </div>
  );
}
