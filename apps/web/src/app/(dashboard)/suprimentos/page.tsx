'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Glass, Btn, Stat, Mono, Input, Select,
  PageHero, T, MetalTag,
} from '@dermaos/ui/ds';
import { keepPreviousData } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-provider';
import { usePermission } from '@/lib/auth';
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
import { MovementModal, type MovementModalInitial } from './_components/movement-modal';
import { InventoryAlertsPanel } from './_components/inventory-alerts-panel';

/**
 * Suprimentos — Estoque dermatológico (FEFO + rastreabilidade ANVISA).
 *
 * Centro operacional do módulo: posição consolidada, alertas, registro de
 * movimentação e drawer de produto/lote. As páginas filhas (lotes, compras,
 * recebimento, kits, rastreabilidade) recebem navegação via SuprimentosTabs.
 */

const PAGE_SIZE = 50;
const STOCK_STATUSES: StockStatus[] = ['OK', 'ATENCAO', 'CRITICO', 'RUPTURA', 'VENCIMENTO_PROXIMO'];

export default function SuprimentosPage() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();
  const canWrite = usePermission('supply', 'write');

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
  const [movementInitial, setMovementInitial] = React.useState<MovementModalInitial | null>(null);

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

  // KPIs sem filtros aplicados (refletem total da clínica, não a página)
  const totalProductsQuery = trpc.supply.stock.position.useQuery(
    { page: 1, limit: 1 },
    { staleTime: 60_000 },
  );
  const expiringSoonQuery = trpc.supply.lots.list.useQuery(
    { alertLevel: 'critical', includeConsumed: false, page: 1, limit: 1 },
    { staleTime: 60_000 },
  );
  const criticalStockQuery = trpc.supply.stock.position.useQuery(
    { statuses: ['CRITICO', 'RUPTURA'], page: 1, limit: 1 },
    { staleTime: 60_000 },
  );
  const openOrdersQuery = trpc.supply.purchaseOrders.list.useQuery(
    { status: 'pendente_aprovacao', page: 1, limit: 1 },
    { staleTime: 60_000 },
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

  /* Backend retorna `{ data, total }`; rows projeta a forma `StockRow` que
     `StockTable` consome. Os campos extras (supplier_name, unit_cost,
     active_lots) já vêm no payload — basta tipá-los. */
  const rows: StockRow[] = (stockQuery.data?.data ?? []) as unknown as StockRow[];
  const total = stockQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* KPIs reais — derivados das queries dedicadas (limit:1 só para `total`). */
  const totalProducts = totalProductsQuery.data?.total ?? 0;
  const expiringSoon  = expiringSoonQuery.data?.total ?? 0;
  const criticalStock = criticalStockQuery.data?.total ?? 0;
  const openOrders    = openOrdersQuery.data?.total ?? 0;

  /* Valor estimado do que está visível: estimativa baseada na página atual.
     Real "valor total em estoque" demandaria endpoint dedicado — mantemos
     marker visível para evitar interpretação errada. */
  const visibleStockValue = rows.reduce((acc, r) => {
    const cost = r.unit_cost ?? 0;
    return acc + cost * r.qty_total;
  }, 0);

  function handleRefresh() {
    void utils.supply.stock.position.invalidate();
    void utils.supply.lots.list.invalidate();
    void utils.supply.purchaseOrders.list.invalidate();
  }
  function handleSaved() { handleRefresh(); }

  useRealtime(
    [
      'stock.entry', 'stock.exit', 'stock.adjust', 'stock.transfer',
      'stock.lot_status_changed',
      'stock.rupture', 'stock.critical_alert', 'stock.low_alert', 'stock.lot_expiring',
    ],
    handleRefresh,
  );

  const hasFilters = !!(filterCat || filterStatus || filterLoc || searchQ);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '20px 26px 12px', flexShrink: 0 }}>
        <PageHero
          eyebrow="GESTÃO DE INVENTÁRIO FEFO"
          title="Estoque"
          module="supply"
          icon="box"
          actions={
            <>
              {canWrite && (
                <Btn
                  variant="ghost"
                  small
                  icon="settings"
                  onClick={() => setSupplierModalOpen(true)}
                >
                  Fornecedores
                </Btn>
              )}
              {canWrite && (
                <Btn
                  variant="ghost"
                  small
                  icon="layers"
                  onClick={() => setLocationModalOpen(true)}
                >
                  Locais
                </Btn>
              )}
              {canWrite && (
                <Btn
                  variant="glass"
                  small
                  icon="edit"
                  onClick={() => setMovementInitial({ type: 'saida' })}
                >
                  Nova baixa
                </Btn>
              )}
              {canWrite && (
                <Btn
                  small
                  icon="plus"
                  onClick={() => setMovementInitial({ type: 'entrada' })}
                >
                  Registrar entrada
                </Btn>
              )}
            </>
          }
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
          <Stat
            label="Produtos ativos"
            value={String(totalProducts)}
            sub="catalogados"
            icon="box"
            mod="supply"
            pct={totalProducts > 0 ? 80 : 0}
          />
          <Stat
            label="Estoque crítico"
            value={String(criticalStock)}
            sub={criticalStock > 0 ? 'requer ação' : 'nenhum item'}
            icon="alert"
            mod="supply"
            pct={criticalStock > 0 ? Math.min(100, criticalStock * 10) : 0}
          />
          <Stat
            label="Lotes vencendo"
            value={String(expiringSoon)}
            sub="< 30 dias"
            icon="clock"
            mod="supply"
            pct={expiringSoon > 0 ? Math.min(100, expiringSoon * 8) : 0}
          />
          <Stat
            label="Compras abertas"
            value={String(openOrders)}
            sub={openOrders > 0 ? 'aguardando aprovação' : 'sem ordens pendentes'}
            icon="creditCard"
            mod="financial"
            pct={openOrders > 0 ? 50 : 0}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <InventoryAlertsPanel />
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

          <Btn variant="ghost" small icon="activity" onClick={handleRefresh} aria-label="Atualizar">
            {''}
          </Btn>

          {canWrite && (
            <Btn
              variant="ghost"
              small
              icon="plus"
              onClick={() => setProductModalOpen(true)}
              title="Cadastrar novo produto"
            >
              Novo produto
            </Btn>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
            <MetalTag>FEFO</MetalTag>
            <MetalTag>ANVISA</MetalTag>
            {visibleStockValue > 0 && (
              <MetalTag>
                {visibleStockValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
              </MetalTag>
            )}
          </div>
        </Glass>

        {!stockQuery.isLoading && (
          <div style={{ marginTop: 6 }}>
            <Mono size={9}>
              {total === 0
                ? 'NENHUM PRODUTO ENCONTRADO'
                : `${total} ${total !== 1 ? 'PRODUTOS ENCONTRADOS' : 'PRODUTO ENCONTRADO'}`}
              {stockQuery.isFetching && ' · ATUALIZANDO'}
              {visibleStockValue > 0 && ` · VALOR VISÍVEL ${visibleStockValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
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
              onOrder={(row) => setMovementInitial({ type: 'entrada', productId: row.id })}
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
        onEntry={(p) => { setSheetProduct(null); setMovementInitial({ type: 'entrada', productId: p.id }); }}
        onExit={(p) => { setSheetProduct(null); setMovementInitial({ type: 'saida', productId: p.id }); }}
      />
      <AdjustStockModal product={adjustProduct} onClose={() => setAdjustProduct(null)} onSaved={handleSaved} />
      <ProductModal     open={productModalOpen}  onClose={() => setProductModalOpen(false)}  onSaved={handleSaved} />
      <CategoryModal    open={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} onSaved={handleSaved} />
      <SupplierModal    open={supplierModalOpen} onClose={() => setSupplierModalOpen(false)} onSaved={handleSaved} />
      <StorageLocationModal open={locationModalOpen} onClose={() => setLocationModalOpen(false)} onSaved={handleSaved} />

      <MovementModal
        open={!!movementInitial}
        initial={movementInitial}
        contextLot={null}
        onClose={() => setMovementInitial(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}
