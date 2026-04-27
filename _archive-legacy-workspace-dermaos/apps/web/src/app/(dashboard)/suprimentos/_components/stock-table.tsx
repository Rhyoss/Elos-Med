'use client';

import * as React from 'react';
import { Button, TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent } from '@dermaos/ui';
import { ChevronDown, ChevronRight, ShoppingCart, SlidersHorizontal, List } from 'lucide-react';
import { StatusBadge } from './status-badge';
import type { StockStatus } from '@dermaos/shared';

export interface StockRow {
  id:               string;
  name:             string;
  sku:              string | null;
  unit:             string;
  category_name:    string | null;
  qty_total:        number;
  min_stock:        number;
  max_stock:        number | null;
  reorder_point:    number | null;
  next_expiry:      string | null;
  coverage_days:    number | null;
  statuses:         StockStatus[];
  is_controlled:    boolean;
  is_cold_chain:    boolean;
}

interface StockTableProps {
  rows:       StockRow[];
  isLoading:  boolean;
  onRowClick: (row: StockRow) => void;
  onAdjust:   (row: StockRow) => void;
  onOrder:    (row: StockRow) => void;
}

function ExpiryCell({ date }: { date: string | null }) {
  if (!date) return <span className="text-muted-foreground text-sm">—</span>;

  const d     = new Date(date);
  const now   = new Date();
  const days  = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const fmt   = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

  let colorClass = 'text-foreground';
  if (days < 30)       colorClass = 'text-red-600 font-medium';
  else if (days < 60)  colorClass = 'text-yellow-600 font-medium';

  return (
    <span className={`text-sm ${colorClass}`} title={`${days} dias`}>
      {fmt}
    </span>
  );
}

function CoverageCell({ days }: { days: number | null }) {
  if (days === null) {
    return <span className="text-muted-foreground text-sm">N/D</span>;
  }
  const colorClass = days < 7  ? 'text-red-600 font-semibold'
    : days < 30 ? 'text-yellow-600 font-medium'
    : 'text-foreground';
  return <span className={`text-sm ${colorClass}`}>{days}d</span>;
}

export function StockTable({ rows, isLoading, onRowClick, onAdjust, onOrder }: StockTableProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  if (isLoading) {
    return (
      <div aria-label="Carregando posição de estoque" role="status">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 animate-pulse">
            <div className="h-5 w-20 rounded bg-muted" />
            <div className="h-5 flex-1 rounded bg-muted" />
            <div className="h-5 w-16 rounded bg-muted" />
            <div className="h-5 w-14 rounded bg-muted" />
            <div className="h-5 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center" role="status">
        <p className="text-muted-foreground text-sm">Nenhum produto encontrado.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto" role="table" aria-label="Posição de estoque">
      {/* Cabeçalho — oculto em mobile */}
      <div
        className="hidden grid-cols-[140px_1fr_120px_100px_80px_110px_110px_120px] items-center gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid"
        role="row"
      >
        <span role="columnheader">Status</span>
        <span role="columnheader">Produto</span>
        <span role="columnheader">Categoria</span>
        <span role="columnheader">Qtd Atual</span>
        <span role="columnheader">Mín.</span>
        <span role="columnheader">Cobertura</span>
        <span role="columnheader">Próx. Venc.</span>
        <span role="columnheader">Ações</span>
      </div>

      {rows.map((row) => {
        const isExpanded = expandedId === row.id;

        return (
          <React.Fragment key={row.id}>
            {/* Linha principal */}
            <div
              className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-2 border-b px-4 py-3 transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 md:grid-cols-[140px_1fr_120px_100px_80px_110px_110px_120px] md:gap-3"
              role="row"
              tabIndex={0}
              aria-expanded={isExpanded}
              onClick={() => onRowClick(row)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); } }}
            >
              {/* Status */}
              <div className="hidden md:block" role="cell">
                <StatusBadge statuses={row.statuses} />
              </div>

              {/* Produto */}
              <div className="flex min-w-0 flex-col gap-0.5" role="cell">
                <div className="flex items-center gap-2">
                  {/* Status indicator — mobile only */}
                  <span className="flex h-2 w-2 shrink-0 rounded-full md:hidden"
                    style={{ backgroundColor: getStatusDotColor(row.statuses[0]) }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm font-medium">{row.name}</span>
                  {row.is_controlled && (
                    <span className="shrink-0 rounded-sm bg-purple-100 px-1 text-[10px] font-medium text-purple-700">
                      C
                    </span>
                  )}
                  {row.is_cold_chain && (
                    <span className="shrink-0 rounded-sm bg-blue-100 px-1 text-[10px] font-medium text-blue-700">
                      ❄
                    </span>
                  )}
                </div>
                {row.sku && (
                  <span className="font-mono text-[11px] text-muted-foreground">{row.sku}</span>
                )}
              </div>

              {/* Categoria */}
              <div className="hidden text-sm text-muted-foreground md:block truncate" role="cell">
                {row.category_name ?? '—'}
              </div>

              {/* Qtd atual */}
              <div className="hidden text-sm md:block" role="cell">
                <span className="font-medium tabular-nums">{formatQty(row.qty_total)}</span>
                <span className="ml-1 text-xs text-muted-foreground">{row.unit}</span>
              </div>

              {/* Mín */}
              <div className="hidden text-sm tabular-nums text-muted-foreground md:block" role="cell">
                {formatQty(row.min_stock)}
              </div>

              {/* Cobertura */}
              <div className="hidden md:block" role="cell">
                <CoverageCell days={row.coverage_days} />
              </div>

              {/* Próx. vencimento */}
              <div className="hidden md:block" role="cell">
                <ExpiryCell date={row.next_expiry} />
              </div>

              {/* Ações */}
              <div
                className="flex shrink-0 items-center gap-1"
                role="cell"
                onClick={e => e.stopPropagation()}
              >
                <TooltipProvider>
                  <TooltipRoot>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7"
                        aria-label={`Pedido de ${row.name}`}
                        onClick={() => onOrder(row)}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Pedir</TooltipContent>
                  </TooltipRoot>
                </TooltipProvider>

                <TooltipProvider>
                  <TooltipRoot>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7"
                        aria-label={`Ajustar estoque de ${row.name}`}
                        onClick={() => onAdjust(row)}
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Ajustar</TooltipContent>
                  </TooltipRoot>
                </TooltipProvider>

                {/* Mobile: toggle detalhe */}
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 md:hidden"
                  aria-label={isExpanded ? 'Recolher' : 'Ver detalhes'}
                  onClick={() => setExpandedId(isExpanded ? null : row.id)}
                >
                  {isExpanded
                    ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  }
                </Button>

                <TooltipProvider>
                  <TooltipRoot>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost" size="icon"
                        className="hidden h-7 w-7 md:flex"
                        aria-label={`Ver lotes de ${row.name}`}
                        onClick={() => onRowClick(row)}
                      >
                        <List className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Ver Lotes</TooltipContent>
                  </TooltipRoot>
                </TooltipProvider>
              </div>
            </div>

            {/* Linha expandida — mobile */}
            {isExpanded && (
              <div className="border-b bg-muted/10 px-6 py-3 md:hidden" role="row" aria-label="Detalhes do produto">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Status</dt>
                    <dd><StatusBadge statuses={row.statuses} showAll /></dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Categoria</dt>
                    <dd>{row.category_name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Qtd Atual</dt>
                    <dd className="font-medium">{formatQty(row.qty_total)} {row.unit}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Estoque Mín.</dt>
                    <dd>{formatQty(row.min_stock)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Cobertura</dt>
                    <dd><CoverageCell days={row.coverage_days} /></dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Próx. Vencimento</dt>
                    <dd><ExpiryCell date={row.next_expiry} /></dd>
                  </div>
                </dl>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function formatQty(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

function getStatusDotColor(status: StockStatus | undefined): string {
  switch (status) {
    case 'RUPTURA':            return '#111827';
    case 'CRITICO':            return '#dc2626';
    case 'ATENCAO':            return '#d97706';
    case 'VENCIMENTO_PROXIMO': return '#ea580c';
    default:                   return '#16a34a';
  }
}
