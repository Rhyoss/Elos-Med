'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@dermaos/ui';
import { Btn, PageHero } from '@dermaos/ui/ds';
import { Package, CheckCircle, AlertTriangle } from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import { ORDER_STATUS_LABELS, type PurchaseOrder } from '@dermaos/shared';
import { SuprimentosTabs } from '../_components/suprimentos-tabs';
import { ReceiptConference } from './_components/receipt-conference';

function SkeletonRow() {
  return (
    <tr className="border-b animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-muted" style={{ width: `${50 + i * 8}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function RecebimentoPage() {
  const params   = useSearchParams();
  const router   = useRouter();

  const orderId     = params.get('orderId') ?? null;
  const [toast, setToast] = React.useState<string | null>(null);

  // Lista de pedidos aguardando recebimento
  const pendingQuery = trpc.supply.purchaseOrders.list.useQuery(
    { status: 'enviado', page: 1, limit: 50 },
    { enabled: !orderId, staleTime: 15_000 },
  );
  const partialQuery = trpc.supply.purchaseOrders.list.useQuery(
    { status: 'parcialmente_recebido', page: 1, limit: 50 },
    { enabled: !orderId, staleTime: 15_000 },
  );

  // Detalhes do pedido selecionado
  const orderQuery = trpc.supply.purchaseOrders.get.useQuery(
    { orderId: orderId! },
    { enabled: !!orderId, staleTime: 10_000 },
  );

  const pendingOrders: PurchaseOrder[] = [
    ...(pendingQuery.data?.items ?? []),
    ...(partialQuery.data?.items ?? []),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Auto-dismiss toast
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleSuccess(message: string) {
    setToast(message);
    router.replace('/suprimentos/recebimento');
  }

  const isListLoading = pendingQuery.isLoading || partialQuery.isLoading;
  const order = orderQuery.data;

  return (
    <div className="flex flex-col gap-0">
      <SuprimentosTabs />

      {/* Toast de sucesso */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg text-sm text-emerald-700"
        >
          <CheckCircle className="size-4 shrink-0" aria-hidden="true" />
          <span>{toast}</span>
        </div>
      )}

      <div style={{ padding: '20px 26px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <PageHero
          eyebrow="CONFERÊNCIA DE NOTAS FISCAIS"
          title={
            orderId && order
              ? `Recebimento — Pedido ${order.orderNumber ?? order.id.slice(0, 8)}`
              : 'Recebimento de NF'
          }
          module="supply"
          icon="box"
          description={
            orderId
              ? `Fornecedor: ${order?.supplierName ?? '…'}`
              : 'Pedidos aguardando conferência de recebimento'
          }
          actions={
            orderId ? (
              <Btn
                variant="glass"
                small
                icon="arrowLeft"
                onClick={() => router.replace('/suprimentos/recebimento')}
                aria-label="Voltar para lista de recebimentos"
              >
                Voltar
              </Btn>
            ) : null
          }
        />

        {/* Lista de pedidos pendentes */}
        {!orderId && (
          <>
            {!isListLoading && pendingOrders.length === 0 && (
              <div
                role="status"
                aria-label="Nenhum pedido aguardando recebimento"
                className="flex flex-col items-center justify-center py-20 text-center gap-3 text-muted-foreground"
              >
                <Package className="size-10 opacity-30" aria-hidden="true" />
                <p className="text-sm">Nenhum pedido aguardando recebimento.</p>
              </div>
            )}

            {(isListLoading || pendingOrders.length > 0) && (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm" role="grid" aria-label="Pedidos aguardando recebimento">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3 text-left">Nº Pedido</th>
                      <th className="px-4 py-3 text-left">Fornecedor</th>
                      <th className="px-4 py-3 text-left">Data Envio</th>
                      <th className="px-4 py-3 text-center">Qtd Itens</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isListLoading
                      ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                      : pendingOrders.map((po) => (
                          <tr
                            key={po.id}
                            className="border-b transition-colors hover:bg-muted/20"
                          >
                            <td className="px-4 py-3 font-mono text-xs">
                              {po.orderNumber ?? po.id.slice(0, 8)}
                            </td>
                            <td className="px-4 py-3 font-medium">{po.supplierName}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {po.sentAt
                                ? new Date(po.sentAt).toLocaleDateString('pt-BR')
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {po.items?.length ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                po.status === 'parcialmente_recebido'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {po.status === 'parcialmente_recebido' && (
                                  <AlertTriangle className="size-3" aria-hidden="true" />
                                )}
                                {ORDER_STATUS_LABELS[po.status]}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                size="sm"
                                onClick={() =>
                                  router.push(`/suprimentos/recebimento?orderId=${po.id}`)
                                }
                                aria-label={`Conferir recebimento do pedido ${po.orderNumber ?? po.id.slice(0, 8)}`}
                              >
                                <Package className="mr-1 size-4" aria-hidden="true" />
                                Conferir
                              </Button>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Formulário de conferência */}
        {orderId && (
          <>
            {orderQuery.isLoading && (
              <div
                role="status"
                aria-label="Carregando pedido"
                className="flex items-center justify-center py-12"
              >
                <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}

            {orderQuery.isError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                Pedido não encontrado ou você não tem permissão para acessá-lo.
              </div>
            )}

            {order?.items && order.items.length > 0 && (
              <ReceiptConference
                order={order as PurchaseOrder & { items: NonNullable<PurchaseOrder['items']> }}
                onSuccess={handleSuccess}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
