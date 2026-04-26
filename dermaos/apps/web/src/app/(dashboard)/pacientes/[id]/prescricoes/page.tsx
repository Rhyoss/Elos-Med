'use client';

import * as React from 'react';
import { Download, FileText, Plus, Send, Copy, XCircle } from 'lucide-react';
import {
  Button,
  Badge,
  EmptyState,
  LoadingSkeleton,
  useToast,
} from '@dermaos/ui';
import {
  PRESCRIPTION_STATUS_LABELS,
  PRESCRIPTION_TYPE_LABELS,
} from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { NewPrescriptionModal } from './_components/new-prescription-modal';

type PageParams = Promise<{ id: string }>;

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
    onError: (err) => toast({ title: 'Erro ao gerar PDF', description: err.message, variant: 'destructive' }),
  });

  const duplicateMut = trpc.clinical.prescriptions.duplicate.useMutation({
    onSuccess: () => {
      toast({ title: 'Prescrição duplicada', description: 'Editar a nova prescrição antes de assinar.' });
      void utils.clinical.prescriptions.listByPatient.invalidate({ patientId });
    },
    onError: (err) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const sendMut = trpc.clinical.prescriptions.send.useMutation({
    onSuccess: () => {
      toast({ title: 'Enviada', description: 'Prescrição enviada ao paciente (mock).' });
      void utils.clinical.prescriptions.listByPatient.invalidate({ patientId });
    },
    onError: (err) => toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' }),
  });

  const cancelMut = trpc.clinical.prescriptions.cancel.useMutation({
    onSuccess: () => {
      toast({ title: 'Prescrição cancelada' });
      void utils.clinical.prescriptions.listByPatient.invalidate({ patientId });
    },
    onError: (err) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const prescriptions = listQuery.data?.data ?? [];
  const patientName = patientQuery.data?.patient.name;

  function confirmCancel(id: string) {
    const reason = window.prompt('Motivo do cancelamento:');
    if (!reason || reason.length < 3) return;
    cancelMut.mutate({ id, reason });
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Prescrições</h2>
          <p className="text-sm text-muted-foreground">
            Histórico de receitas emitidas para o paciente.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} size="sm">
          <Plus className="h-4 w-4" aria-hidden="true" /> Nova prescrição
        </Button>
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : prescriptions.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" aria-hidden="true" />}
          title="Nenhuma prescrição registrada"
          description="Clique em 'Nova prescrição' para iniciar."
        />
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Data</th>
                <th className="px-4 py-2 text-left font-medium">Nº</th>
                <th className="px-4 py-2 text-left font-medium">Tipo</th>
                <th className="px-4 py-2 text-left font-medium">Itens</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {prescriptions.map((p) => {
                const signed = p.status === 'assinada' || p.status === 'enviada_digital';
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-2">
                      {new Intl.DateTimeFormat('pt-BR').format(p.createdAt)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {p.prescriptionNumber ?? '—'}
                    </td>
                    <td className="px-4 py-2">{PRESCRIPTION_TYPE_LABELS[p.type]}</td>
                    <td className="px-4 py-2">{p.itemCount}</td>
                    <td className="px-4 py-2">
                      <Badge variant={statusVariant(p.status)}>
                        {PRESCRIPTION_STATUS_LABELS[p.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => pdfMut.mutate({ id: p.id })}
                        disabled={!signed || pdfMut.isPending}
                        aria-label="Baixar PDF"
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => sendMut.mutate({ id: p.id, channel: 'email' })}
                        disabled={!signed || sendMut.isPending}
                        aria-label="Enviar"
                      >
                        <Send className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => duplicateMut.mutate({ id: p.id })}
                        aria-label="Duplicar"
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => confirmCancel(p.id)}
                        disabled={p.status === 'cancelada'}
                        aria-label="Cancelar"
                      >
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {listQuery.data && listQuery.data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Anterior
          </Button>
          <span>
            Página {page} de {listQuery.data.totalPages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPage((p) => Math.min(listQuery.data!.totalPages, p + 1))}
            disabled={page >= listQuery.data.totalPages}
          >
            Próxima
          </Button>
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

function statusVariant(status: string): 'success' | 'info' | 'danger' | 'neutral' {
  switch (status) {
    case 'assinada':
    case 'enviada_digital':
      return 'success';
    case 'cancelada':
    case 'expirada':
      return 'danger';
    case 'rascunho':
      return 'neutral';
    default:
      return 'info';
  }
}
