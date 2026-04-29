'use client';

import { Badge, Glass, Ico, Mono, T } from '@dermaos/ui/ds';
import { PRESCRIPTION_STATUS_LABELS, PRESCRIPTION_TYPE_LABELS } from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';

interface TabPrescricoesProps {
  patientId: string;
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  rascunho:        'warning',
  emitida:         'success',
  assinada:        'success',
  enviada_digital: 'success',
  impressa:        'success',
  expirada:        'default',
  cancelada:       'danger',
};

const DELIVERY_LABEL: Record<string, string> = {
  pending:   'Pendente',
  sent_mock: 'Enviada',
  delivered: 'Entregue',
  failed:    'Falhou',
};

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TabPrescricoes({ patientId }: TabPrescricoesProps) {
  const listQ = trpc.clinical.prescriptions.listByPatient.useQuery({
    patientId,
    page:     1,
    pageSize: 50,
  });

  if (listQ.isLoading) {
    return <p style={{ fontSize: 12, color: T.textMuted }}>Carregando prescrições…</p>;
  }
  const items = listQ.data?.data ?? [];
  if (items.length === 0) {
    return <p style={{ fontSize: 12, color: T.textMuted }}>Nenhuma prescrição registrada.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((rx) => (
        <Glass key={rx.id} style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: T.r.md,
                  background: T.primaryBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ico name="file" size={16} color={T.primary} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>
                  {rx.prescriptionNumber ?? rx.id.slice(0, 8).toUpperCase()}
                </p>
                <Mono size={9}>
                  {formatDate(rx.signedAt ?? rx.createdAt)} · {PRESCRIPTION_TYPE_LABELS[rx.type] ?? rx.type}
                </Mono>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Badge variant={STATUS_VARIANT[rx.status] ?? 'default'} dot={false}>
                {PRESCRIPTION_STATUS_LABELS[rx.status] ?? rx.status}
              </Badge>
            </div>
          </div>
          <div
            style={{
              padding: '10px 12px',
              borderRadius: T.r.md,
              background: T.glass,
              border: `1px solid ${T.glassBorder}`,
              display: 'flex',
              gap: 16,
              alignItems: 'baseline',
            }}
          >
            <div>
              <Mono size={7}>ITENS</Mono>
              <p style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginTop: 2 }}>{rx.itemCount}</p>
            </div>
            <div>
              <Mono size={7}>ENVIO</Mono>
              <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
                {DELIVERY_LABEL[rx.deliveryStatus] ?? rx.deliveryStatus}
              </p>
            </div>
          </div>
        </Glass>
      ))}
    </div>
  );
}
