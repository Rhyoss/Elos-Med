'use client';

import * as React from 'react';
import {
  SheetRoot,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Button,
  Badge,
  ConfirmDialog,
} from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { formatBRL, formatDate, formatTime } from './format-brl';
import { InvoiceStatusBadge } from './invoice-status-badge';
import { PAYMENT_METHOD_LABELS } from '@dermaos/shared';
import { Input, Label } from '@dermaos/ui';
import { Loader2, X } from 'lucide-react';

interface InvoiceSheetProps {
  invoiceId:  string | null;
  onClose:    () => void;
  onChanged:  () => void;
}

export function InvoiceSheet({ invoiceId, onClose, onChanged }: InvoiceSheetProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [cancelReason, setCancelReason]         = React.useState('');
  const utils = trpc.useUtils();

  const invoiceQuery = trpc.financial.invoices.getById.useQuery(
    { id: invoiceId! },
    { enabled: !!invoiceId },
  );

  const itemsQuery = trpc.financial.invoices.items.useQuery(
    { invoiceId: invoiceId! },
    { enabled: !!invoiceId },
  );

  const paymentsQuery = trpc.financial.payments.forInvoice.useQuery(
    { invoiceId: invoiceId! },
    { enabled: !!invoiceId },
  );

  const emitMutation = trpc.financial.invoices.emit.useMutation({
    onSuccess() {
      utils.financial.invoices.list.invalidate();
      invoiceQuery.refetch();
      onChanged();
    },
  });

  const cancelMutation = trpc.financial.invoices.cancel.useMutation({
    onSuccess() {
      utils.financial.invoices.list.invalidate();
      invoiceQuery.refetch();
      setCancelDialogOpen(false);
      setCancelReason('');
      onChanged();
    },
  });

  const invoice  = invoiceQuery.data;
  const items    = itemsQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];

  const canPay    = invoice && ['emitida', 'parcial', 'vencida'].includes(invoice.status) && invoice.amount_due > 0;
  const canCancel = invoice && ['emitida', 'parcial', 'vencida', 'rascunho'].includes(invoice.status);
  const canEmit   = invoice?.status === 'rascunho';

  return (
    <>
      <SheetRoot open={!!invoiceId} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="pb-4 border-b border-border">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SheetTitle className="font-mono text-base">
                  {invoice?.invoice_number ?? '–'}
                </SheetTitle>
                {invoice && (
                  <div className="flex items-center gap-2 mt-1">
                    <InvoiceStatusBadge status={invoice.status as any} />
                    <span className="text-xs text-muted-foreground">
                      {invoice.patient_name}
                    </span>
                  </div>
                )}
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
                <X className="size-5" />
              </button>
            </div>
          </SheetHeader>

          {invoiceQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : invoice ? (
            <div className="py-4 space-y-6">

              {/* Ações */}
              <div className="flex gap-2 flex-wrap">
                {canEmit && (
                  <Button
                    size="sm"
                    onClick={() => emitMutation.mutate({ id: invoice.id })}
                    disabled={emitMutation.isPending}
                  >
                    {emitMutation.isPending ? 'Emitindo...' : 'Emitir Fatura'}
                  </Button>
                )}
                {canCancel && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setCancelDialogOpen(true)}
                  >
                    Cancelar Fatura
                  </Button>
                )}
              </div>

              {/* Resumo financeiro */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Resumo</h3>
                <div className="rounded-lg border border-border divide-y divide-border text-sm">
                  <Row label="Total Bruto"    value={formatBRL(invoice.subtotal)} />
                  {invoice.discount_amount > 0 && (
                    <Row
                      label={`Desconto (${invoice.discount_reason ?? ''})`}
                      value={`− ${formatBRL(invoice.discount_amount)}`}
                      valueClass="text-orange-600"
                    />
                  )}
                  <Row label="Total Líquido"  value={formatBRL(invoice.total_amount)} bold />
                  <Row label="Total Pago"     value={formatBRL(invoice.amount_paid)} />
                  <Row
                    label="Saldo Devedor"
                    value={formatBRL(invoice.amount_due)}
                    valueClass={invoice.amount_due > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}
                  />
                </div>
              </section>

              {/* Itens */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Itens</h3>
                <div className="rounded-lg border border-border overflow-hidden text-sm">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Serviço</th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground w-12">Qtd</th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground w-28">Unit.</th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground w-28">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatBRL(item.unit_price)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{formatBRL(item.total_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Pagamentos */}
              {payments.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Pagamentos</h3>
                  <div className="rounded-lg border border-border overflow-hidden text-sm">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Método</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {payments.map((pay) => (
                          <tr key={pay.id} className={pay.payment_type === 'estorno' ? 'bg-red-50/50' : ''}>
                            <td className="px-3 py-2 text-muted-foreground">
                              {pay.received_at ? formatTime(pay.received_at) : '–'}
                            </td>
                            <td className="px-3 py-2">
                              {PAYMENT_METHOD_LABELS[pay.method as any] ?? pay.method}
                            </td>
                            <td className="px-3 py-2">
                              <Badge className={
                                pay.payment_type === 'estorno'
                                  ? 'bg-red-100 text-red-700 border-red-200 text-xs'
                                  : 'bg-green-100 text-green-700 border-green-200 text-xs'
                              }>
                                {pay.payment_type === 'estorno' ? 'Estorno' : 'Pagamento'}
                              </Badge>
                            </td>
                            <td className={`px-3 py-2 text-right tabular-nums font-medium ${pay.payment_type === 'estorno' ? 'text-red-600' : ''}`}>
                              {pay.payment_type === 'estorno' ? '−' : ''}{formatBRL(pay.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Informações */}
              {invoice.notes && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Observações</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                </section>
              )}

              {invoice.cancellation_reason && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Motivo do Cancelamento</h3>
                  <p className="text-sm text-muted-foreground">{invoice.cancellation_reason}</p>
                </section>
              )}
            </div>
          ) : null}
        </SheetContent>
      </SheetRoot>

      {/* Diálogo de cancelamento */}
      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={(o) => { setCancelDialogOpen(o); if (!o) setCancelReason(''); }}
        title="Cancelar fatura"
        description="Esta ação é irreversível. A fatura será marcada como cancelada e não poderá ser reaberta."
        confirmLabel="Cancelar Fatura"
        cancelLabel="Voltar"
        isLoading={cancelMutation.isPending}
        onConfirm={() => invoice && cancelMutation.mutate({ id: invoice.id, reason: cancelReason })}
      >
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">Motivo obrigatório</Label>
          <Input
            id="cancel-reason"
            placeholder="Descreva o motivo do cancelamento..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          {cancelMutation.error && (
            <p className="text-xs text-destructive">{cancelMutation.error.message}</p>
          )}
        </div>
      </ConfirmDialog>
    </>
  );
}

function Row({
  label, value, bold, valueClass,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? 'font-semibold' : ''} ${valueClass ?? ''}`}>{value}</span>
    </div>
  );
}
