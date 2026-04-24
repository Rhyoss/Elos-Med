'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Button,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Input,
} from '@dermaos/ui';
import { Search, Plus, RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import { useDebounce } from '@/lib/utils';
import { useRealtime } from '@/hooks/use-realtime';
import { STOCK_STATUS_LABELS, type StockStatus } from '@dermaos/shared';

import { SuprimentosTabs } from './_components/suprimentos-tabs';
import { StockTable, type StockRow } from './_components/stock-table';
import { ProductSheet } from './_components/product-sheet';
import { AdjustStockModal } from './_components/adjust-stock-modal';
import { ProductModal } from './_components/product-modal';
import { CategoryModal } from './_components/category-modal';
import { SupplierModal } from './_components/supplier-modal';
import { StorageLocationModal } from './_components/storage-location-modal';

const PAGE_SIZE = 50;

const STOCK_STATUSES: StockStatus[] = ['OK', 'ATENCAO', 'CRITICO', 'RUPTURA', 'VENCIMENTO_PROXIMO'];

export default function SuprimentosPage() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  // ── URL-persisted filter state ──────────────────────────────────────────
  const searchQ     = params.get('q')          ?? '';
  const filterCat   = params.get('category')   ?? '';
  const filterStatus = params.get('status')    ?? '';
  const filterLoc   = params.get('location')   ?? '';
  const page        = Number(params.get('page') ?? '1');

  const [localSearch, setLocalSearch] = React.useState(searchQ);
  const debouncedSearch = useDebounce(localSearch, 300);

  // sync debounced search into URL
  React.useEffect(() => {
    if (debouncedSearch === searchQ) return;
    const next = new URLSearchParams(params.toString());
    if (debouncedSearch.length >= 2) {
      next.set('q', debouncedSearch);
    } else {
      next.delete('q');
    }
    next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // keep local search in sync when navigating back
  React.useEffect(() => {
    setLocalSearch(searchQ);
  }, [searchQ]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
  }

  function setPage(p: number) {
    const next = new URLSearchParams(params.toString());
    if (p === 1) {
      next.delete('page');
    } else {
      next.set('page', String(p));
    }
    router.replace(`${pathname}?${next.toString()}`);
  }

  // ── Modal state ─────────────────────────────────────────────────────────
  const [sheetProduct, setSheetProduct]     = React.useState<StockRow | null>(null);
  const [adjustProduct, setAdjustProduct]   = React.useState<StockRow | null>(null);
  const [productModalOpen, setProductModalOpen]   = React.useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = React.useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = React.useState(false);
  const [locationModalOpen, setLocationModalOpen] = React.useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────
  const utils = trpc.useUtils();

  const stockQuery = trpc.supply.stock.position.useQuery(
    {
      search:     debouncedSearch.length >= 2 ? debouncedSearch : undefined,
      categoryId: filterCat    || undefined,
      status:     (filterStatus as StockStatus) || undefined,
      locationId: filterLoc    || undefined,
      page,
      pageSize:   PAGE_SIZE,
    },
    { placeholderData: (prev) => prev, staleTime: 30_000 },
  );

  const categoriesQuery = trpc.supply.categories.list.useQuery(
    {},
    { staleTime: 60_000 },
  );

  const locationsQuery = trpc.supply.storageLocations.list.useQuery(
    {},
    { staleTime: 60_000 },
  );

  const rows      = stockQuery.data?.items ?? [];
  const total     = stockQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleRefresh() {
    void utils.supply.stock.position.invalidate();
  }

  // Realtime: invalida posição em qualquer movimentação / alerta novo.
  useRealtime(
    [
      'stock.entry', 'stock.exit', 'stock.adjust', 'stock.transfer',
      'stock.lot_status_changed',
      'stock.rupture', 'stock.critical_alert', 'stock.low_alert', 'stock.lot_expiring',
    ],
    () => { void utils.supply.stock.position.invalidate(); },
  );

  function handleSaved() {
    void utils.supply.stock.position.invalidate();
  }

  const hasFilters = !!(filterCat || filterStatus || filterLoc || searchQ);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <SuprimentosTabs />

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Posição de Estoque</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral do inventário com alertas de reposição e validade
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setLocationModalOpen(true)}>
            + Local
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCategoryModalOpen(true)}>
            + Categoria
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSupplierModalOpen(true)}>
            + Fornecedor
          </Button>
          <Button size="sm" onClick={() => setProductModalOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Novo Produto
          </Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto (nome, SKU, código de barras)..."
            className="pl-8"
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
          />
        </div>

        <Select value={filterCat || '__all__'} onValueChange={v => updateParam('category', v === '__all__' ? '' : v)}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as categorias</SelectItem>
            {(categoriesQuery.data ?? []).map(c => (
              <SelectItem key={c.id} value={c.id}>
                {'  '.repeat(c.depth ?? 0)}{c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus || '__all__'} onValueChange={v => updateParam('status', v === '__all__' ? '' : v)}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os status</SelectItem>
            {STOCK_STATUSES.map(s => (
              <SelectItem key={s} value={s}>{STOCK_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterLoc || '__all__'} onValueChange={v => updateParam('location', v === '__all__' ? '' : v)}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Armazenamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os locais</SelectItem>
            {(locationsQuery.data ?? []).map(l => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLocalSearch('');
              router.replace(pathname);
            }}
          >
            Limpar
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleRefresh}
          aria-label="Atualizar"
        >
          <RefreshCw className={`h-4 w-4 ${stockQuery.isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* ── Summary line ── */}
      {!stockQuery.isLoading && (
        <p className="text-xs text-muted-foreground">
          {total === 0
            ? 'Nenhum produto encontrado'
            : `${total} produto${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
          {stockQuery.isFetching && ' · atualizando...'}
        </p>
      )}

      {/* ── Table ── */}
      <StockTable
        rows={rows}
        isLoading={stockQuery.isLoading}
        onRowClick={row => setSheetProduct(row)}
        onAdjust={row => setAdjustProduct(row)}
        onOrder={row => {
          // placeholder — future purchase-order flow
          console.info('order', row.id);
        }}
        onViewLots={row => setSheetProduct(row)}
      />

      {/* ── Empty state ── */}
      {!stockQuery.isLoading && rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
          <p className="text-muted-foreground">
            {hasFilters
              ? 'Nenhum produto corresponde aos filtros selecionados.'
              : 'Nenhum produto cadastrado. Comece adicionando um produto ao estoque.'}
          </p>
          {!hasFilters && (
            <Button size="sm" onClick={() => setProductModalOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Adicionar Produto
            </Button>
          )}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* ── Modals / Sheet ── */}
      <ProductSheet
        product={sheetProduct}
        onClose={() => setSheetProduct(null)}
      />

      <AdjustStockModal
        product={adjustProduct}
        onClose={() => setAdjustProduct(null)}
        onSaved={handleSaved}
      />

      <ProductModal
        open={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        onSaved={handleSaved}
      />

      <CategoryModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        onSaved={handleSaved}
      />

      <SupplierModal
        open={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        onSaved={handleSaved}
      />

      <StorageLocationModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
