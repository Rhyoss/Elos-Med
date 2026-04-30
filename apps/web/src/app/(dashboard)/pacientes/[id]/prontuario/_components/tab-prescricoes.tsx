'use client';

import { Badge, Glass, Ico, Mono, EmptyState, Btn, T } from '@dermaos/ui/ds';
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

const DELIVERY_ICON: Record<string, 'clock' | 'check' | 'check' | 'alert'> = {
  pending:   'clock',
  sent_mock: 'check',
  delivered: 'check',
  failed:    'alert',
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
    return (
      <Glass style={{ padding: 32, textAlign: 'center' }}>
        <Mono size={11} color={T.textMuted}>CARREGANDO PRESCRIÇÕES…</Mono>
      </Glass>
    );
  }

  const items = listQ.data?.data ?? [];

  if (items.length === 0) {
    return (
      <Glass style={{ padding: 40 }}>
        <EmptyState
          icon="file"
          title="Nenhuma prescrição"
          description="As prescrições serão criadas durante os atendimentos e aparecerão aqui automaticamente."
          tone="primary"
        />
      </Glass>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Mono size={11} spacing="1.2px" color={T.primary}>
          {items.length} {items.length === 1 ? 'PRESCRIÇÃO' : 'PRESCRIÇÕES'}
        </Mono>
      </div>

      {items.map((rx) => (
        <Glass key={rx.id} hover style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: T.r.md,
                  background: T.primaryBg,
                  border: `1px solid ${T.primaryBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ico name="file" size={18} color={T.primary} />
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 600, color: T.textPrimary }}>
                  {rx.prescriptionNumber ?? rx.id.slice(0, 8).toUpperCase()}
                </p>
                <Mono size={11}>
                  {formatDate(rx.signedAt ?? rx.createdAt)} · {PRESCRIPTION_TYPE_LABELS[rx.type] ?? rx.type}
                </Mono>
              </div>
            </div>
            <Badge variant={STATUS_VARIANT[rx.status] ?? 'default'} dot={false}>
              {PRESCRIPTION_STATUS_LABELS[rx.status] ?? rx.status}
            </Badge>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 10,
            }}
          >
            <div
              style={{
                padding: '10px 12px',
                borderRadius: T.r.md,
                background: T.glass,
                border: `1px solid ${T.glassBorder}`,
              }}
            >
              <Mono size={9}>ITENS</Mono>
              <p style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary, marginTop: 2 }}>
                {rx.itemCount}
              </p>
              <Mono size={9} color={T.textMuted}>
                {rx.itemCount === 1 ? 'MEDICAMENTO' : 'MEDICAMENTOS'}
              </Mono>
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: T.r.md,
                background: T.glass,
                border: `1px solid ${T.glassBorder}`,
              }}
            >
              <Mono size={9}>ENVIO</Mono>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                <Ico
                  name={DELIVERY_ICON[rx.deliveryStatus] ?? 'clock'}
                  size={12}
                  color={rx.deliveryStatus === 'delivered' ? T.success : rx.deliveryStatus === 'failed' ? T.danger : T.textMuted}
                />
                <p style={{ fontSize: 14, color: T.textSecondary }}>
                  {DELIVERY_LABEL[rx.deliveryStatus] ?? rx.deliveryStatus}
                </p>
              </div>
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: T.r.md,
                background: T.primaryBg,
                border: `1px solid ${T.primaryBorder}`,
              }}
            >
              <Mono size={9} color={T.primary}>DATA</Mono>
              <p style={{ fontSize: 14, fontWeight: 600, color: T.primary, marginTop: 4 }}>
                {formatDate(rx.signedAt ?? rx.createdAt)}
              </p>
            </div>
          </div>
        </Glass>
      ))}
    </div>
  );
}
