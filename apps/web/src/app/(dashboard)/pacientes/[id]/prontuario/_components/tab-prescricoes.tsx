'use client';

import { useRouter } from 'next/navigation';
import { Badge, Btn, Glass, Ico, Mono, EmptyState, Skeleton, T } from '@dermaos/ui/ds';
import { PRESCRIPTION_STATUS_LABELS, PRESCRIPTION_TYPE_LABELS } from '@dermaos/shared';
import {
  PRESCRIPTION_STATUS_VARIANT,
  useDuplicatePrescription,
  usePrescriptionsByPatient,
} from '@/lib/hooks/use-prescriptions';
import { useToast } from '@dermaos/ui';

interface TabPrescricoesProps {
  patientId: string;
  onNovaPrescrição?: () => void;
}

const DELIVERY_LABEL: Record<string, string> = {
  pending:   'Pendente',
  sent_mock: 'Enviada',
  delivered: 'Entregue',
  failed:    'Falhou',
};

const DELIVERY_ICON: Record<string, 'clock' | 'check' | 'alert'> = {
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

export function TabPrescricoes({ patientId, onNovaPrescrição }: TabPrescricoesProps) {
  const router = useRouter();
  const { toast } = useToast();
  const listQ = usePrescriptionsByPatient(patientId, { pageSize: 50 });
  const duplicateMut = useDuplicatePrescription();

  function goToNew() {
    if (onNovaPrescrição) onNovaPrescrição();
    else router.push(`/prescricoes/nova?patientId=${patientId}`);
  }

  function goToDetail(id: string) {
    router.push(`/prescricoes/${id}`);
  }

  async function handleDuplicate(sourceId: string) {
    try {
      const res = await duplicateMut.mutateAsync({ id: sourceId });
      toast.success('Rascunho duplicado');
      router.push(`/prescricoes/${res.prescription.id}`);
    } catch (err) {
      toast.error('Falha ao duplicar', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    }
  }

  if (listQ.isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height={100} delay={i * 80} />
        ))}
      </div>
    );
  }

  const items = listQ.data?.data ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        label="PRESCRIÇÕES"
        icon="file"
        title="Nenhuma prescrição"
        description="Crie a primeira prescrição deste paciente. Itens podem ser tópicos, sistêmicos, manipulados ou cosmecêuticos, com geração de PDF assinado pelo backend."
        action={
          <Btn variant="primary" small icon="plus" onClick={goToNew}>
            Nova prescrição
          </Btn>
        }
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Mono size={11} spacing="1.2px" color={T.primary}>
          {items.length} {items.length === 1 ? 'PRESCRIÇÃO' : 'PRESCRIÇÕES'}
        </Mono>
        <Btn variant="primary" small icon="plus" onClick={goToNew}>
          Nova prescrição
        </Btn>
      </div>

      {items.map((rx) => (
        <Glass
          key={rx.id}
          hover
          style={{ padding: '16px 18px', cursor: 'pointer' }}
          onClick={() => goToDetail(rx.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              goToDetail(rx.id);
            }
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: T.r.md,
                background: T.primaryBg, border: `1px solid ${T.primaryBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ico name="file" size={18} color={T.primary} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
                  {rx.prescriptionNumber ?? rx.id.slice(0, 8).toUpperCase()}
                </p>
                <Mono size={10}>
                  {formatDate(rx.signedAt ?? rx.createdAt)} · {PRESCRIPTION_TYPE_LABELS[rx.type] ?? rx.type}
                </Mono>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge variant={PRESCRIPTION_STATUS_VARIANT[rx.status] ?? 'default'} dot={false}>
                {PRESCRIPTION_STATUS_LABELS[rx.status] ?? rx.status}
              </Badge>
              <Btn
                variant="ghost"
                small
                iconOnly
                icon="copy"
                aria-label="Duplicar prescrição"
                disabled={duplicateMut.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDuplicate(rx.id);
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div style={{
              padding: '10px 12px', borderRadius: T.r.md,
              background: T.glass, border: `1px solid ${T.glassBorder}`,
            }}>
              <Mono size={9}>ITENS</Mono>
              <p style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary, marginTop: 2 }}>
                {rx.itemCount}
              </p>
              <Mono size={9} color={T.textMuted}>
                {rx.itemCount === 1 ? 'MEDICAMENTO' : 'MEDICAMENTOS'}
              </Mono>
            </div>

            <div style={{
              padding: '10px 12px', borderRadius: T.r.md,
              background: T.glass, border: `1px solid ${T.glassBorder}`,
            }}>
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

            <div style={{
              padding: '10px 12px', borderRadius: T.r.md,
              background: T.primaryBg, border: `1px solid ${T.primaryBorder}`,
            }}>
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
