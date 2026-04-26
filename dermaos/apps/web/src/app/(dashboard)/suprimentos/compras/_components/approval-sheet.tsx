'use client';

import * as React from 'react';
import {
  Button,
  SheetRoot, SheetContent, SheetHeader, SheetTitle, SheetFooter,
  DialogRoot, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@dermaos/ui';
import { CheckCircle, XCircle, RotateCcw, AlertCircle, Clock } from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import {
  ORDER_STATUS_LABELS,
  ORDER_URGENCY_LABELS,
  type PurchaseOrder,
} from '@dermaos/shared';

interface ApprovalSheetProps {
  open:      boolean;
  onClose:   () => void;
  onSuccess: () => void;
  order:     PurchaseOrder | null;
}

type ActionType = 'approve' | 'reject' | 'return';

export function ApprovalSheet({ open, onClose, onSuccess, order }: ApprovalSheetProps) {
  const utils = trpc.useUtils();

  const [action,  setAction]  = React.useState<ActionType | null>(null);
  const [reason,  setReason]  = React.useState('');
  const [confirm, setConfirm] = React.useState(false);
  const [error,   setError]   = React.useState<string | null>(null);

  const orderQuery = trpc.supply.purchaseOrders.get.useQuery(
    { orderId: order?.id ?? '' },
    { enabled: open && !!order?.id, staleTime: 10_000 },
  );

  const approveMutation = trpc.supply.purchaseOrders.approve.useMutation({
    onSuccess: () => { invalidate(); onSuccess(); closeAll(); },
    onError:   (e) => setError(e.message),
  });
  const rejectMutation = trpc.supply.purchaseOrders.reject.useMutation({
    onSuccess: () => { invalidate(); onSuccess(); closeAll(); },
    onError:   (e) => setError(e.message),
  });
  const returnMutation = trpc.supply.purchaseOrders.return.useMutation({
    onSuccess: () => { invalidate(); onSuccess(); closeAll(); },
    onError:   (e) => setError(e.message),
  });

  function invalidate() {
    utils.supply.purchaseOrders.list.invalidate();
    if (order?.id) utils.supply.purchaseOrders.get.invalidate({ orderId: order.id });
  }

  function closeAll() {
    setAction(null);
    setReason('');
    setConfirm(false);
    setError(null);
    onClose();
  }

  async function executeAction() {
    if (!order) return;
    setError(null);
    try {
      if (action === 'approve') {
        await approveMutation.mutateAsync({ orderId: order.id });
      } else if (action === 'reject') {
        await rejectMutation.mutateAsync({ orderId: order.id, reason });
      } else if (action === 'return') {
        await returnMutation.mutateAsync({ orderId: order.id, reason });
      }
    } catch {
      // error handled via onError
    }
  }

  const detail  = orderQuery.data;
  const items   = detail?.items ?? order?.items ?? [];
  const history = detail?.history ?? [];

  const reasonRequired = action === 'reject' || action === 'return';
  const reasonValid    = !reasonRequired || reason.trim().length >= 10;

  const isPending = approveMutation.isPending || rejectMutation.isPending || returnMutation.isPending;

  if (!order) return null;

  return (
    <>
      <SheetRoot open={open && !confirm} onOpenChange={(o: boolean) => !o && closeAll()}>
        <SheetContent
          side="right"
          className="w-full max-w-2xl overflow-y-auto"
          aria-label="Detalhes do pedido para aprovação"
        >
          <SheetHeader>
            <SheetTitle>
              Pedido {order.orderNumber ?? order.id.slice(0, 8)}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-6 py-6">
            {/* Metadados */}
            <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Fornecedor</span>
                <p className="font-medium">{order.supplierName}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Urgência</span>
                <p className="font-medium">{ORDER_URGENCY_LABELS[order.urgency]}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Criado por</span>
                <p className="font-medium">{order.createdByName ?? '—'}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Submetido em</span>
                <p className="font-medium">
                  {order.submittedAt
                    ? new Date(order.submittedAt).toLocaleString('pt-BR')
                    : '—'}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground">Valor Total</span>
                <p className="text-lg font-bold">
                  {order.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            </div>

            {/* Itens com contexto de estoque */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Itens do Pedido
              </h3>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm" aria-label="Itens do pedido">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 text-left">Produto</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Pr. Unit.</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-3 py-2">
                          <div className="font-medium">{item.productName}</div>
                          {item.sku && (
                            <div className="font-mono text-xs text-muted-foreground">{item.sku}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {item.quantityOrdered.toLocaleString('pt-BR')} {item.unit}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {item.unitCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {item.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/20">
                      <td colSpan={3} className="px-3 py-2 text-right font-semibold">Total</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">
                        {order.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Histórico */}
            {history.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Histórico
                </h3>
                <ol className="flex flex-col gap-2" aria-label="Histórico de status">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-start gap-2 text-sm">
                      <Clock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div>
                        <span className="font-medium">
                          {h.fromStatus
                            ? `${ORDER_STATUS_LABELS[h.fromStatus]} → ${ORDER_STATUS_LABELS[h.toStatus]}`
                            : ORDER_STATUS_LABELS[h.toStatus]}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          por {h.changedByLabel ?? h.changedByName ?? 'Sistema'} ·{' '}
                          {new Date(h.changedAt).toLocaleString('pt-BR')}
                        </span>
                        {h.reason && <p className="mt-0.5 text-xs text-muted-foreground">{h.reason}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Motivo (para devolver ou rejeitar) */}
            {action && action !== 'approve' && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="reason" className="text-sm font-medium leading-none">
                  {action === 'reject' ? 'Motivo da rejeição *' : 'Motivo da devolução *'}
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Descreva o motivo (mínimo 10 caracteres)..."
                  aria-required="true"
                  aria-invalid={reason.trim().length > 0 && reason.trim().length < 10}
                />
                {reason.trim().length > 0 && reason.trim().length < 10 && (
                  <p className="text-xs text-red-600" role="alert">
                    Mínimo de 10 caracteres ({reason.trim().length}/10)
                  </p>
                )}
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <SheetFooter className="flex flex-wrap gap-2 pt-4">
            {!action ? (
              <>
                <Button
                  type="button" variant="outline"
                  onClick={() => { setAction('return'); setReason(''); }}
                  aria-label="Devolver pedido para correção"
                >
                  <RotateCcw className="mr-2 size-4" aria-hidden="true" />
                  Devolver
                </Button>
                <Button
                  type="button" variant="destructive"
                  onClick={() => { setAction('reject'); setReason(''); }}
                  aria-label="Rejeitar pedido"
                >
                  <XCircle className="mr-2 size-4" aria-hidden="true" />
                  Rejeitar
                </Button>
                <Button
                  type="button"
                  onClick={() => setConfirm(true)}
                  aria-label="Aprovar pedido"
                >
                  <CheckCircle className="mr-2 size-4" aria-hidden="true" />
                  Aprovar
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => { setAction(null); setReason(''); }}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant={action === 'reject' ? 'destructive' : 'default'}
                  disabled={!reasonValid || isPending}
                  aria-busy={isPending}
                  onClick={executeAction}
                >
                  {isPending
                    ? 'Processando...'
                    : action === 'reject'
                      ? 'Confirmar Rejeição'
                      : 'Confirmar Devolução'}
                </Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </SheetRoot>

      {/* Confirmação de aprovação */}
      <DialogRoot open={confirm} onOpenChange={(o: boolean) => !o && setConfirm(false)}>
        <DialogContent aria-label="Confirmar aprovação">
          <DialogHeader>
            <DialogTitle>Confirmar aprovação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Confirma a aprovação do pedido no valor de{' '}
            <strong>
              {order.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </strong>
            ?
          </p>
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              onClick={executeAction}
              disabled={isPending}
              aria-busy={isPending}
            >
              {isPending ? 'Aprovando...' : 'Sim, Aprovar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </>
  );
}
