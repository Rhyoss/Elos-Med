'use client';

import * as React from 'react';
import {
  Badge,
  Btn,
  DataTable,
  EmptyState,
  Glass,
  Mono,
  PageHero,
  Skeleton,
  T,
} from '@dermaos/ui/ds';
import { useToast } from '@dermaos/ui';
import {
  PRESCRIPTION_STATUS_LABELS,
  PRESCRIPTION_TYPE_LABELS,
} from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { NewPrescriptionModal } from './_components/new-prescription-modal';

type PageParams = Promise<{ id: string }>;

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'info'> = {
  assinada:        'success',
  enviada_digital: 'success',
  cancelada:       'danger',
  expirada:        'danger',
  rascunho:        'default',
};

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  }).format(date);
}

interface PrescriptionRow {
  id:                 string;
  prescriptionNumber: string | null;
  type:               keyof typeof PRESCRIPTION_TYPE_LABELS;
  status:             keyof typeof PRESCRIPTION_STATUS_LABELS;
  itemCount:          number;
  createdAt:          Date;
}

export default function PrescricoesPage({ params }: { params: PageParams }) {
  const { id: patientId } = React.use(params);
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [modalOpen, setModalOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);

  const patientQuery = trpc.patients.getById.useQuery({ id: patientId });
  const listQuery = trpc.clinical.prescriptions.listByPatient.useQuery(
    { patientId, page, pageSize: 20 },
    { staleTime: 10_000 },
  );

  const pdfMut = trpc.clinical.prescriptions.requestPdf.useMutation({
    onSuccess: (data) => window.open(data.url, '_blank', 'noopener,noreferrer'),
    onError: (err) =>
      toast({ title: 'Erro ao gerar PDF', description: err.message, variant: 'destructive' }),
  });

  const duplicateMut = trpc.clinical.prescriptions.duplicate.useMutation({
    onSuccess: () => {
      toast({
        title:       'Prescrição duplicada',
        description: 'Editar a nova prescrição antes de assinar.',
      });
      void utils.clinical.prescriptions.listByPatient.invalidate({ patientId });
    },
    onError: (err) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const sendMut = trpc.clinical.prescriptions.send.useMutation({
    onSuccess: () => {
      toast({
        title:       'Enviada',
        description: 'Prescrição enviada ao paciente (mock).',
      });
      void utils.clinical.prescriptions.listByPatient.invalidate({ patientId });
    },
    onError: (err) =>
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' }),
  });

  const cancelMut = trpc.clinical.prescriptions.cancel.useMutation({
    onSuccess: () => {
      toast({ title: 'Prescrição cancelada' });
      void utils.clinical.prescriptions.listByPatient.invalidate({ patientId });
    },
    onError: (err) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const prescriptions = (listQuery.data?.data ?? []) as PrescriptionRow[];
  const patientName = patientQuery.data?.patient.name;
  const totalPages = listQuery.data?.totalPages ?? 1;

  function confirmCancel(id: string) {
    const reason = window.prompt('Motivo do cancelamento:');
    if (!reason || reason.length < 3) return;
    cancelMut.mutate({ id, reason });
  }

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
        eyebrow="RECEITUÁRIO ELETRÔNICO"
        title="Prescrições"
        actions={
          <Btn small icon="plus" onClick={() => setModalOpen(true)}>
            Nova prescrição
          </Btn>
        }
      />

      <Glass style={{ padding: 0, overflow: 'hidden' }}>
        {listQuery.isLoading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={40} radius={6} delay={60 * i} />
            ))}
          </div>
        ) : prescriptions.length === 0 ? (
          <EmptyState
            icon="file"
            title="Nenhuma prescrição registrada"
            description="Clique em 'Nova prescrição' para iniciar o receituário do paciente."
            action={
              <Btn variant="glass" small icon="plus" onClick={() => setModalOpen(true)}>
                Nova prescrição
              </Btn>
            }
          />
        ) : (
          <DataTable
            columns={[
              {
                header: 'Data',
                cell: (rx: PrescriptionRow) => <Mono size={9}>{fmtDate(rx.createdAt)}</Mono>,
              },
              {
                header: 'Nº',
                cell: (rx: PrescriptionRow) => (
                  <Mono size={9}>{rx.prescriptionNumber ?? '—'}</Mono>
                ),
              },
              {
                header: 'Tipo',
                cell: (rx: PrescriptionRow) => (
                  <span style={{ fontSize: 12, color: T.textPrimary }}>
                    {PRESCRIPTION_TYPE_LABELS[rx.type]}
                  </span>
                ),
              },
              {
                header: 'Itens',
                align: 'center',
                cell: (rx: PrescriptionRow) => (
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>
                    {rx.itemCount}
                  </span>
                ),
              },
              {
                header: 'Status',
                cell: (rx: PrescriptionRow) => (
                  <Badge variant={STATUS_VARIANT[rx.status] ?? 'default'} dot={false}>
                    {PRESCRIPTION_STATUS_LABELS[rx.status]}
                  </Badge>
                ),
              },
              {
                header: 'Ações',
                align: 'right',
                cell: (rx: PrescriptionRow) => {
                  const signed = rx.status === 'assinada' || rx.status === 'enviada_digital';
                  return (
                    <div style={{ display: 'inline-flex', gap: 4, justifyContent: 'flex-end' }}>
                      <Btn
                        variant="ghost"
                        small
                        icon="download"
                        iconOnly
                        aria-label="Baixar PDF"
                        disabled={!signed || pdfMut.isPending}
                        onClick={() => pdfMut.mutate({ id: rx.id })}
                      >
                        PDF
                      </Btn>
                      <Btn
                        variant="ghost"
                        small
                        icon="mail"
                        iconOnly
                        aria-label="Enviar"
                        disabled={!signed || sendMut.isPending}
                        onClick={() => sendMut.mutate({ id: rx.id, channel: 'email' })}
                      >
                        Enviar
                      </Btn>
                      <Btn
                        variant="ghost"
                        small
                        icon="copy"
                        iconOnly
                        aria-label="Duplicar"
                        onClick={() => duplicateMut.mutate({ id: rx.id })}
                      >
                        Duplicar
                      </Btn>
                      <Btn
                        variant="ghost"
                        small
                        icon="x"
                        iconOnly
                        aria-label="Cancelar"
                        disabled={rx.status === 'cancelada'}
                        onClick={() => confirmCancel(rx.id)}
                      >
                        Cancelar
                      </Btn>
                    </div>
                  );
                },
              },
            ]}
            rows={prescriptions}
            rowKey={(rx) => rx.id}
          />
        )}
      </Glass>

      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Btn
            variant="ghost"
            small
            icon="arrowLeft"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Btn>
          <Mono size={9}>
            PÁGINA {page} DE {totalPages}
          </Mono>
          <Btn
            variant="ghost"
            small
            icon="arrowRight"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Próxima
          </Btn>
        </div>
      )}

      <NewPrescriptionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        patientId={patientId}
        patientName={patientName}
      />
    </div>
  );
}
