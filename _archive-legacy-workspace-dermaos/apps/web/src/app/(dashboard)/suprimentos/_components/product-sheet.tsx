'use client';

import * as React from 'react';
import {
  SheetRoot as Sheet, SheetContent, SheetHeader, SheetTitle,
  Badge, Button,
} from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { StatusBadge } from './status-badge';
import type { StockRow } from './stock-table';

interface ProductSheetProps {
  product:  StockRow | null;
  onClose:  () => void;
  onAdjust: (product: StockRow) => void;
}

export function ProductSheet({ product, onClose, onAdjust }: ProductSheetProps) {
  const [movPage, setMovPage] = React.useState(1);

  const lotsQuery = trpc.supply.stock.lots.useQuery(
    { productId: product?.id ?? '' },
    { enabled: !!product?.id, staleTime: 30_000 },
  );

  const movQuery = trpc.supply.stock.movements.useQuery(
    { productId: product?.id ?? '', page: movPage, limit: 20 },
    { enabled: !!product?.id, staleTime: 30_000 },
  );

  React.useEffect(() => {
    setMovPage(1);
  }, [product?.id]);

  if (!product) return null;

  const lots      = lotsQuery.data ?? [];
  const movements = movQuery.data?.data ?? [];
  const movTotal  = movQuery.data?.total ?? 0;
  const totalPages = Math.ceil(movTotal / 20);

  return (
    <Sheet open={!!product} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-2xl"
        aria-label={`Detalhes de ${product.name}`}
      >
        <SheetHeader className="shrink-0 border-b pb-4">
          <div className="flex items-start justify-between gap-2 pr-8">
            <div className="flex flex-col gap-1">
              <SheetTitle className="text-base">{product.name}</SheetTitle>
              <div className="flex items-center gap-2">
                {product.sku && (
                  <span className="font-mono text-xs text-muted-foreground">{product.sku}</span>
                )}
                <StatusBadge statuses={product.statuses} showAll />
              </div>
            </div>
            <Button
              size="sm" variant="outline"
              onClick={() => onAdjust(product)}
              aria-label="Ajustar estoque"
            >
              Ajustar
            </Button>
          </div>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          {/* Resumo de estoque */}
          <section aria-labelledby="stock-summary-title">
            <h3 id="stock-summary-title" className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Posição Atual
            </h3>
            <dl className="grid grid-cols-3 gap-4">
              <SummaryItem label="Qtd Total" value={`${formatQty(product.qty_total)} ${product.unit}`} />
              <SummaryItem label="Estoque Mín." value={formatQty(product.min_stock)} />
              <SummaryItem
                label="Cobertura"
                value={product.coverage_days != null ? `${product.coverage_days} dias` : 'N/D'}
              />
              <SummaryItem label="Categoria" value={product.category_name ?? '—'} />
              <SummaryItem
                label="Próx. Vencimento"
                value={product.next_expiry
                  ? new Date(product.next_expiry).toLocaleDateString('pt-BR')
                  : '—'}
              />
              {product.is_cold_chain && (
                <SummaryItem label="Cadeia Fria" value="Sim ❄" />
              )}
              {product.is_controlled && (
                <SummaryItem label="Controlado" value="Sim" />
              )}
            </dl>
          </section>

          {/* Lotes */}
          <section aria-labelledby="lots-title">
            <h3 id="lots-title" className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Lotes Ativos
            </h3>
            {lotsQuery.isLoading ? (
              <div className="animate-pulse space-y-2">
                {[1, 2].map(i => (
                  <div key={i} className="h-12 rounded-lg bg-muted" />
                ))}
              </div>
            ) : lots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum lote com estoque disponível.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm" aria-label="Lotes ativos">
                  <thead className="bg-muted/40">
                    <tr>
                      <Th>Lote</Th>
                      <Th>Qtd</Th>
                      <Th>Vencimento</Th>
                      <Th>Local</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((lot) => {
                      const expiry  = lot.expiry_date ? new Date(lot.expiry_date) : null;
                      const daysExp = expiry
                        ? Math.ceil((expiry.getTime() - Date.now()) / 86_400_000)
                        : null;
                      const expiryClass = daysExp != null && daysExp < 30
                        ? 'text-red-600 font-medium'
                        : daysExp != null && daysExp < 60
                        ? 'text-yellow-600'
                        : '';
                      return (
                        <tr key={lot.id} className="border-t last:border-0">
                          <Td>
                            <span className="font-mono text-xs">{lot.lot_number}</span>
                            {lot.batch_number && (
                              <span className="ml-2 text-xs text-muted-foreground">{lot.batch_number}</span>
                            )}
                          </Td>
                          <Td>{formatQty(lot.quantity_current)} {product.unit}</Td>
                          <Td>
                            <span className={expiryClass}>
                              {expiry ? expiry.toLocaleDateString('pt-BR') : '—'}
                            </span>
                          </Td>
                          <Td>{lot.storage_location_name ?? '—'}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Movimentações */}
          <section aria-labelledby="movements-title">
            <h3 id="movements-title" className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Últimas Movimentações
            </h3>
            {movQuery.isLoading ? (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 rounded bg-muted" />
                ))}
              </div>
            ) : movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm" aria-label="Movimentações de estoque">
                  <thead className="bg-muted/40">
                    <tr>
                      <Th>Tipo</Th>
                      <Th>Qtd</Th>
                      <Th>Data</Th>
                      <Th>Responsável</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((mov) => (
                      <tr key={mov.id} className="border-t last:border-0">
                        <Td>
                          <MovTypeBadge type={mov.type} />
                        </Td>
                        <Td className="tabular-nums">
                          {mov.type === 'entrada' || mov.type === 'ajuste'
                            ? `+${formatQty(mov.quantity)}`
                            : `-${formatQty(mov.quantity)}`}
                        </Td>
                        <Td>
                          {new Date(mov.performed_at).toLocaleString('pt-BR', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </Td>
                        <Td>{mov.performed_by_name ?? '—'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                      {movTotal} movimentações · Página {movPage} de {totalPages}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost" size="sm"
                        disabled={movPage <= 1}
                        onClick={() => setMovPage(p => p - 1)}
                        aria-label="Página anterior"
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        disabled={movPage >= totalPages}
                        onClick={() => setMovPage(p => p + 1)}
                        aria-label="Próxima página"
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-3 py-2 text-sm ${className ?? ''}`}>{children}</td>
  );
}

const MOV_TYPE_LABELS: Record<string, { label: string; className: string }> = {
  entrada:      { label: 'Entrada',      className: 'bg-green-100 text-green-800' },
  saida:        { label: 'Saída',        className: 'bg-red-100 text-red-800' },
  ajuste:       { label: 'Ajuste',       className: 'bg-blue-100 text-blue-800' },
  perda:        { label: 'Perda',        className: 'bg-orange-100 text-orange-800' },
  vencimento:   { label: 'Vencimento',   className: 'bg-gray-100 text-gray-800' },
  transferencia:{ label: 'Transferência',className: 'bg-purple-100 text-purple-800' },
  uso_paciente: { label: 'Uso Paciente', className: 'bg-teal-100 text-teal-800' },
};

function MovTypeBadge({ type }: { type: string }) {
  const cfg = MOV_TYPE_LABELS[type] ?? { label: type, className: 'bg-muted text-foreground' };
  return (
    <Badge className={`text-xs ${cfg.className} border-0`}>
      {cfg.label}
    </Badge>
  );
}

function formatQty(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}
