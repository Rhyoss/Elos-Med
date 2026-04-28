'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Glass, Btn, Stat, Mono, Ico, MetalTag, Input, Select,
  PageHero, T,
} from '@dermaos/ui/ds';
import { keepPreviousData } from '@tanstack/react-query';
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

/**
 * Suprimentos — DS chrome + StockTable legacy preservada.
 *
 * Phase-4 reskin:
 * - PageHero com módulo `supply` e compliance MetalTags.
 * - 4 Stats FEFO (Em estoque / Alertas / Kits ativos / Compras).
 * - Toolbar DS (search debounced, filtros category/status/location).
 * - StockTable, modais e ProductSheet mantidos intactos para preservar
 *   adjust/transfer/receive flows. Migração para DS em Phase 5.
 */

const PAGE_SIZE = 50;
const STOCK_STATUSES: StockStatus[] = ['OK', 'ATENCAO', 'CRITICO', 'RUPTURA', 'VENCIMENTO_PROXIMO'];

export default function SuprimentosPage() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  const searchQ      = params.get('q')        ?? '';
  const filterCat    = params.get('category') ?? '';
  const filterStatus = params.get('status')   ?? '';
  const filterLoc    = params.get('location') ?? '';
  const page         = Number(params.get('page') ?? '1');

  const [localSearch, setLocalSearch] = React.useState(searchQ);
  const debouncedSearch = useDebounce(localSearch, 300);

  React.useEffect(() => {
    if (debouncedSearch === searchQ) return;
    const next = new URLSearchParams(params.toString());
    if (debouncedSearch.length >= 2) next.set('q', debouncedSearch);
    else next.delete('q');
    next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  React.useEffect(() => { setLocalSearch(searchQ); }, [searchQ]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
  }

  function setPage(p: number) {
    const next = new URLSearchParams(params.toString());
    if (p === 1) next.delete('page');
    else next.set('page', String(p));
    router.replace(`${pathname}?${next.toString()}`);
  }

  const [sheetProduct,     setSheetProduct]     = React.useState<StockRow | null>(null);
  const [adjustProduct,    setAdjustProduct]    = React.useState<StockRow | null>(null);
  const [productModalOpen, setProductModalOpen] = React.useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = React.useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = React.useState(false);
  const [locationModalOpen, setLocationModalOpen] = React.useState(false);

  const utils = trpc.useUtils();

  const stockQuery = trpc.supply.stock.position.useQuery(
    {
      search:            debouncedSearch.length >= 2 ? debouncedSearch : undefined,
      categoryId:        filterCat    || undefined,
      statuses:          filterStatus ? [filterStatus as StockStatus] : undefined,
      storageLocationId: filterLoc    || undefined,
      page,
      limit:             PAGE_SIZE,
    },
    { placeholderData: keepPreviousData, staleTime: 30_000 },
  );

  const categoriesQuery = trpc.supply.categories.list.useQuery({}, { staleTime: 60_000 });
  const locationsQuery  = trpc.supply.storageLocations.list.useQuery({}, { staleTime: 60_000 });
  const hasCatalogError = categoriesQuery.isError || locationsQuery.isError;
  const hasStockError = stockQuery.isError || hasCatalogError;
  const stockErrorMessage =
    stockQuery.error?.message ??
    categoriesQuery.error?.message ??
    locationsQuery.error?.message ??
    'Falha ao carregar suprimentos.';

  /* Backend returns `{ data, total }` per supply router; rows é projetado para
     a forma `StockRow` que `StockTable` consome. */
  const rows: StockRow[] = (stockQuery.data?.data ?? []) as unknown as StockRow[];
  const total = stockQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* KPIs — "Em estoque" e "Alertas FEFO" derivados; "Kits ativos" e "Compras"
     são mock até Phase 5b ligar `supply.kits.summary` e `supply.purchases.summary`. */
  const alertsCount   = rows.filter((r) => !r.statuses.includes('OK')).length;
  const expiringCount = rows.filter((r) => r.statuses.includes('VENCIMENTO_PROXIMO')).length;

  function handleRefresh() { void utils.supply.stock.position.invalidate(); }
  function handleSaved()   { void utils.supply.stock.position.invalidate(); }

  useRealtime(
    [
      'stock.entry', 'stock.exit', 'stock.adjust', 'stock.transfer',
      'stock.lot_status_changed',
      'stock.rupture', 'stock.critical_alert', 'stock.low_alert', 'stock.lot_expiring',
    ],
    () => { void utils.supply.stock.position.invalidate(); },
  );

  const hasFilters = !!(filterCat || filterStatus || filterLoc || searchQ);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '20px 26px 12px', flexShrink: 0 }}>
        <PageHero
          eyebrow="GESTÃO DE INVENTÁRIO FEFO"
          title="Suprimentos"
          module="supply"
          icon="box"
          actions={
            <>
              <Btn variant="glass" small icon="layers">Kits</Btn>
              <Btn small icon="plus" onClick={() => setProductModalOpen(true)}>Novo Produto</Btn>
            </>
          }
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
          <Stat label="Em estoque"   value={String(total) || '0'}     sub="produtos catalogados"             icon="box"        mod="supply"    pct={80} />
          <Stat label="Alertas FEFO" value={String(alertsCount)}      sub={`${expiringCount} vencendo em 30d`} icon="alert"     mod="supply"    pct={alertsCount > 0 ? Math.min(100, alertsCount * 10) : 0} />
          <Stat label="Kits ativos"  value="12"                       sub="3 aguardando"                     icon="layers"     mod="supply"    pct={75} />
          <Stat label="Compras"      value="R$ 3.280"                 sub="2 ordens abertas"                 icon="creditCard" mod="financial" pct={60} />
        </div>

        {/* Toolbar */}
        <Glass style={{ padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Input
              leadingIcon="search"
              placeholder="Buscar produto (nome, SKU, código de barras)…"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
          </div>

          <div style={{ minWidth: 180 }}>
            <Select value={filterCat} onChange={(e) => updateParam('category', e.target.value)} aria-label="Categoria">
              <option value="">Todas as categorias</option>
              {(categoriesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{'  '.repeat(c.depth ?? 0)}{c.name}</option>
              ))}
            </Select>
          </div>

          <div style={{ minWidth: 160 }}>
            <Select value={filterStatus} onChange={(e) => updateParam('status', e.target.value)} aria-label="Status">
              <option value="">Todos os status</option>
              {STOCK_STATUSES.map((s) => (
                <option key={s} value={s}>{STOCK_STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </div>

          <div style={{ minWidth: 180 }}>
            <Select value={filterLoc} onChange={(e) => updateParam('location', e.target.value)} aria-label="Localização">
              <option value="">Todos os locais</option>
              {(locationsQuery.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </div>

          {hasFilters && (
            <Btn variant="ghost" small icon="x" onClick={() => { setLocalSearch(''); router.replace(pathname); }}>
              Limpar
            </Btn>
          )}

          <Btn variant="ghost" small icon="activity" onClick={handleRefresh} aria-label="Atualizar">{''}</Btn>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
            <MetalTag>FEFO</MetalTag>
            <MetalTag>ANVISA</MetalTag>
            <MetalTag>AES-256</MetalTag>
          </div>
        </Glass>

        {!stockQuery.isLoading && (
          <div style={{ marginTop: 6 }}>
            <Mono size={9}>
              {total === 0
                ? 'NENHUM PRODUTO ENCONTRADO'
                : `${total} ${total !== 1 ? 'PRODUTOS ENCONTRADOS' : 'PRODUTO ENCONTRADO'}`}
              {stockQuery.isFetching && ' · ATUALIZANDO'}
            </Mono>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 26px 22px', minHeight: 0 }}>
        <SuprimentosTabs />

        <Glass style={{ padding: 0, overflow: 'hidden', marginTop: 10 }}>
          {hasStockError ? (
            <div role="alert" style={{ padding: '48px 16px', textAlign: 'center' }}>
              <Mono size={9} color={T.danger}>ERRO AO CARREGAR ESTOQUE</Mono>
              <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 8 }}>
                {stockErrorMessage}
              </p>
              <Btn small icon="activity" style={{ marginTop: 14 }} onClick={handleRefresh}>
                Tentar novamente
              </Btn>
            </div>
          ) : (
            <StockTable
              rows={rows}
              isLoading={stockQuery.isLoading}
              onRowClick={(row) => setSheetProduct(row)}
              onAdjust={(row) => setAdjustProduct(row)}
              onOrder={(row) => { console.info('order', row.id); }}
            />
          )}
        </Glass>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <Mono size={9}>PÁGINA {page} DE {totalPages}</Mono>
            <div style={{ display: 'flex', gap: 4 }}>
              <Btn variant="ghost" small icon="arrowLeft" onClick={() => setPage(page - 1)} disabled={page <= 1}>
                Anterior
              </Btn>
              <Btn variant="ghost" small icon="arrowRight" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
                Próxima
              </Btn>
            </div>
          </div>
        )}
      </div>

      <ProductSheet
        product={sheetProduct}
        onClose={() => setSheetProduct(null)}
        onAdjust={(p) => { setSheetProduct(null); setAdjustProduct(p); }}
      />
      <AdjustStockModal product={adjustProduct} onClose={() => setAdjustProduct(null)} onSaved={handleSaved} />
      <ProductModal     open={productModalOpen}  onClose={() => setProductModalOpen(false)}  onSaved={handleSaved} />
      <CategoryModal    open={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} onSaved={handleSaved} />
      <SupplierModal    open={supplierModalOpen} onClose={() => setSupplierModalOpen(false)} onSaved={handleSaved} />
      <StorageLocationModal open={locationModalOpen} onClose={() => setLocationModalOpen(false)} onSaved={handleSaved} />
    </div>
  );
}
