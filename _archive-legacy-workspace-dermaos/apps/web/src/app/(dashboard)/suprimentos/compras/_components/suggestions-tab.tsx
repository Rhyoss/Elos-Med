'use client';

import * as React from 'react';
import { Button } from '@dermaos/ui';
import { ShoppingCart, AlertTriangle, Zap } from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import type { PurchaseSuggestion } from '@dermaos/shared';

interface SuggestionsTabProps {
  onCreateFromSelected: (items: PurchaseSuggestion[]) => void;
}

function StockStatusBadge({ status }: { status: PurchaseSuggestion['stockStatus'] }) {
  const styles = {
    RUPTURA: 'bg-red-100 text-red-700 border-red-200',
    CRITICO: 'bg-orange-100 text-orange-700 border-orange-200',
    ATENCAO: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  } as const;
  const labels = { RUPTURA: 'Ruptura', CRITICO: 'Crítico', ATENCAO: 'Atenção' } as const;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b animate-pulse">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-muted" style={{ width: `${60 + i * 5}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function SuggestionsTab({ onCreateFromSelected }: SuggestionsTabProps) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [page, setPage] = React.useState(1);

  const query = trpc.supply.purchaseOrders.suggestions.useQuery(
    { page, limit: 50 },
    { staleTime: 30_000 },
  );

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  function toggleSelect(productId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.productId)));
    }
  }

  const selectedItems = items.filter((i) => selected.has(i.productId));

  if (!query.isLoading && items.length === 0) {
    return (
      <div
        role="status"
        aria-label="Nenhuma sugestão disponível"
        className="flex flex-col items-center justify-center py-20 text-center gap-3 text-muted-foreground"
      >
        <ShoppingCart className="size-10 opacity-30" aria-hidden="true" />
        <p className="text-sm">Estoque dentro dos parâmetros. Nenhuma sugestão no momento.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2">
          <span className="text-sm text-muted-foreground">
            {selected.size} produto{selected.size !== 1 ? 's' : ''} selecionado{selected.size !== 1 ? 's' : ''}
          </span>
          <Button
            size="sm"
            onClick={() => {
              onCreateFromSelected(selectedItems);
              setSelected(new Set());
            }}
            aria-label={`Criar requisição com ${selected.size} produto${selected.size !== 1 ? 's' : ''} selecionado${selected.size !== 1 ? 's' : ''}`}
          >
            <ShoppingCart className="mr-2 size-4" aria-hidden="true" />
            Criar Requisição com Selecionados
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm" role="grid" aria-label="Sugestões de compra">
          <thead>
            <tr className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selected.size === items.length && items.length > 0}
                  onChange={toggleAll}
                  aria-label="Selecionar todos"
                  className="size-4 rounded border-border"
                />
              </th>
              <th className="px-4 py-3 text-left">Produto</th>
              <th className="px-4 py-3 text-right">Qty Atual</th>
              <th className="px-4 py-3 text-right">Pto. Pedido</th>
              <th className="px-4 py-3 text-right">Qty Sugerida</th>
              <th className="px-4 py-3 text-left">Fornecedor Sugerido</th>
              <th className="px-4 py-3 text-right">Último Preço</th>
              <th className="px-4 py-3 text-center">Demanda</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Ação</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              : items.map((item) => (
                  <tr
                    key={item.productId}
                    className="border-b transition-colors hover:bg-muted/20"
                    aria-selected={selected.has(item.productId)}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(item.productId)}
                        onChange={() => toggleSelect(item.productId)}
                        aria-label={`Selecionar ${item.productName}`}
                        className="size-4 rounded border-border"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.productName}</div>
                      {item.sku && (
                        <div className="font-mono text-xs text-muted-foreground">{item.sku}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={item.qtyAtual === 0 ? 'font-semibold text-red-600' : ''}>
                        {item.qtyAtual.toLocaleString('pt-BR')} {item.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {item.reorderPoint.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {item.qtySugerida.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      {item.suggestedSupplierName ? (
                        <div>
                          <div className="text-sm">{item.suggestedSupplierName}</div>
                          {item.lastOrderDate && (
                            <div className="text-xs text-muted-foreground">
                              Último pedido:{' '}
                              {new Date(item.lastOrderDate).toLocaleDateString('pt-BR')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {item.lastUnitCost != null
                        ? item.lastUnitCost.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.demandaProxima ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
                          title={`${item.procedureCount} procedimento${item.procedureCount !== 1 ? 's' : ''} nos próximos 7 dias`}
                        >
                          <Zap className="size-3" aria-hidden="true" />
                          {item.procedureCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StockStatusBadge status={item.stockStatus} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCreateFromSelected([item])}
                        aria-label={`Criar requisição para ${item.productName}`}
                      >
                        <ShoppingCart className="size-4" aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} produtos com estoque abaixo do ponto de pedido</span>
          <div className="flex gap-2">
            <Button
              size="sm" variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Página anterior"
            >
              Anterior
            </Button>
            <Button
              size="sm" variant="outline"
              disabled={page * 50 >= total}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Próxima página"
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
