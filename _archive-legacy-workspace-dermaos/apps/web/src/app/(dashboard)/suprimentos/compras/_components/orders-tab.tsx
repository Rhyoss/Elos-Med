'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@dermaos/ui';
import {
  Send, CheckCircle, Package, Eye, Pencil, Trash2, AlertCircle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import {
  ORDER_STATUS_LABELS,
  ORDER_URGENCY_LABELS,
  EDITABLE_STATUSES,
  type PurchaseOrder,
  type OrderStatus,
  type OrderUrgency,
} from '@dermaos/shared';
import { ApprovalSheet } from './approval-sheet';
import { PurchaseOrderSheet } from './purchase-order-sheet';

const STATUS_BADGE: Record<OrderStatus, string> = {
  rascunho:              'bg-gray-100 text-gray-600',
  pendente_aprovacao:    'bg-yellow-100 text-yellow-700',
  aprovado:              'bg-green-100 text-green-700',
  rejeitado:             'bg-red-100 text-red-600',
  devolvido:             'bg-orange-100 text-orange-700',
  enviado:               'bg-blue-100 text-blue-700',
  parcialmente_recebido: 'bg-purple-100 text-purple-700',
  recebido:              'bg-emerald-100 text-emerald-700',
  cancelado:             'bg-gray-100 text-gray-400',
};

const URGENCY_BADGE: Record<OrderUrgency, string> = {
  normal:     'bg-gray-100 text-gray-600',
  urgente:    'bg-orange-100 text-orange-700',
  emergencia: 'bg-red-100 text-red-700',
};

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[status]}`}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

function UrgencyBadge({ urgency }: { urgency: OrderUrgency }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${URGENCY_BADGE[urgency]}`}>
      {ORDER_URGENCY_LABELS[urgency]}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-muted" style={{ width: `${50 + i * 6}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function OrdersTab() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();
  const utils    = trpc.useUtils();

  const page       = Number(params.get('page') ?? '1');
  const statusFilter = (params.get('status') ?? '') as OrderStatus | '';

  const [approvalOrder, setApprovalOrder] = React.useState<PurchaseOrder | null>(null);
  const [editOrder,     setEditOrder]     = React.useState<PurchaseOrder | null>(null);
  const [sheetOpen,     setSheetOpen]     = React.useState(false);

  const query = trpc.supply.purchaseOrders.list.useQuery(
    {
      status: statusFilter || undefined,
      page,
      limit: 20,
    },
    { staleTime: 15_000, placeholderData: (prev) => prev },
  );

  const submitMutation = trpc.supply.purchaseOrders.submit.useMutation({
    onSuccess: () => utils.supply.purchaseOrders.list.invalidate(),
  });
  const sendMutation = trpc.supply.purchaseOrders.send.useMutation({
    onSuccess: () => utils.supply.purchaseOrders.list.invalidate(),
  });

  const items      = query.data?.items ?? [];
  const total      = query.data?.total ?? 0;
  const totalPages = query.data?.totalPages ?? 1;

  function setPageParam(p: number) {
    const next = new URLSearchParams(params.toString());
    p === 1 ? next.delete('page') : next.set('page', String(p));
    router.replace(`${pathname}?${next.toString()}`);
  }

  if (!query.isLoading && items.length === 0) {
    return (
      <div
        role="status"
        aria-label="Nenhum pedido encontrado"
        className="flex flex-col items-center justify-center py-20 text-center gap-3 text-muted-foreground"
      >
        <Package className="size-10 opacity-30" aria-hidden="true" />
        <p className="text-sm">Nenhum pedido de compra encontrado.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm" role="grid" aria-label="Pedidos de compra">
          <thead>
            <tr className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 text-left">Nº</th>
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3 text-left">Criador</th>
              <th className="px-4 py-3 text-left">Fornecedor</th>
              <th className="px-4 py-3 text-right">Valor Total</th>
              <th className="px-4 py-3 text-center">Urgência</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : items.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b transition-colors hover:bg-muted/20"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {order.orderNumber ?? order.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">{order.createdByName ?? '—'}</td>
                    <td className="px-4 py-3 font-medium">{order.supplierName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {order.totalAmount.toLocaleString('pt-BR', {
                        style: 'currency', currency: 'BRL',
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <UrgencyBadge urgency={order.urgency} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {/* Editar (rascunho / devolvido) */}
                        {EDITABLE_STATUSES.includes(order.status) && (
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => { setEditOrder(order); setSheetOpen(true); }}
                            aria-label={`Editar pedido ${order.orderNumber ?? order.id.slice(0, 8)}`}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </Button>
                        )}
                        {/* Submeter (rascunho / devolvido) */}
                        {EDITABLE_STATUSES.includes(order.status) && (
                          <Button
                            size="sm" variant="outline"
                            disabled={submitMutation.isPending}
                            onClick={() => submitMutation.mutate({ orderId: order.id })}
                            aria-label={`Submeter pedido ${order.orderNumber ?? order.id.slice(0, 8)} para aprovação`}
                          >
                            <Send className="mr-1 size-4" aria-hidden="true" />
                            Submeter
                          </Button>
                        )}
                        {/* Aprovar/Devolver/Rejeitar (pendente_aprovacao) */}
                        {order.status === 'pendente_aprovacao' && (
                          <Button
                            size="sm"
                            onClick={() => setApprovalOrder(order)}
                            aria-label={`Revisar pedido ${order.orderNumber ?? order.id.slice(0, 8)}`}
                          >
                            <Eye className="mr-1 size-4" aria-hidden="true" />
                            Revisar
                          </Button>
                        )}
                        {/* Marcar como enviado (aprovado) */}
                        {order.status === 'aprovado' && (
                          <Button
                            size="sm" variant="outline"
                            disabled={sendMutation.isPending}
                            onClick={() => sendMutation.mutate({ orderId: order.id })}
                            aria-label={`Marcar pedido ${order.orderNumber ?? order.id.slice(0, 8)} como enviado`}
                          >
                            <Send className="mr-1 size-4" aria-hidden="true" />
                            Enviado
                          </Button>
                        )}
                        {/* Receber (enviado / parcialmente_recebido) */}
                        {(order.status === 'enviado' || order.status === 'parcialmente_recebido') && (
                          <Button
                            size="sm"
                            onClick={() =>
                              router.push(`/suprimentos/recebimento?orderId=${order.id}`)
                            }
                            aria-label={`Registrar recebimento do pedido ${order.orderNumber ?? order.id.slice(0, 8)}`}
                          >
                            <Package className="mr-1 size-4" aria-hidden="true" />
                            Receber
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {total} pedido{total !== 1 ? 's' : ''} · página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPageParam(page - 1)} aria-label="Página anterior">
              Anterior
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPageParam(page + 1)} aria-label="Próxima página">
              Próxima
            </Button>
          </div>
        </div>
      )}

      <ApprovalSheet
        open={!!approvalOrder}
        order={approvalOrder}
        onClose={() => setApprovalOrder(null)}
        onSuccess={() => {
          setApprovalOrder(null);
          query.refetch();
        }}
      />

      <PurchaseOrderSheet
        open={sheetOpen}
        existingOrder={editOrder}
        onClose={() => { setSheetOpen(false); setEditOrder(null); }}
        onSuccess={() => query.refetch()}
      />
    </>
  );
}
