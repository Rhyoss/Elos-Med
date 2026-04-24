'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@dermaos/ui';
import { Plus, ShoppingCart, Package, CheckSquare } from 'lucide-react';
import { cn } from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import type { PurchaseSuggestion } from '@dermaos/shared';
import { SuprimentosTabs } from '../_components/suprimentos-tabs';
import { SuggestionsTab }    from './_components/suggestions-tab';
import { OrdersTab }         from './_components/orders-tab';
import { PurchaseOrderSheet } from './_components/purchase-order-sheet';

type Tab = 'sugestoes' | 'requisicoes';

export default function ComprasPage() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  const activeTab = (params.get('tab') as Tab | null) ?? 'sugestoes';

  const [newSheetOpen,   setNewSheetOpen]   = React.useState(false);
  const [prefillItems,   setPrefillItems]   = React.useState<PurchaseSuggestion[]>([]);

  // Contadores para badges
  const suggestionsCount = trpc.supply.purchaseOrders.suggestions.useQuery(
    { page: 1, limit: 1 },
    { staleTime: 60_000 },
  );
  const pendingCount = trpc.supply.purchaseOrders.list.useQuery(
    { status: 'pendente_aprovacao', page: 1, limit: 1 },
    { staleTime: 30_000 },
  );
  const awaitingReceiptCount = trpc.supply.purchaseOrders.list.useQuery(
    { status: 'enviado', page: 1, limit: 1 },
    { staleTime: 30_000 },
  );

  const utils = trpc.useUtils();

  function setTab(tab: Tab) {
    const next = new URLSearchParams(params.toString());
    next.set('tab', tab);
    next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
  }

  function handleCreateFromSuggestions(items: PurchaseSuggestion[]) {
    setPrefillItems(items);
    setNewSheetOpen(true);
  }

  const TABS: Array<{
    id:    Tab;
    label: string;
    icon:  React.ReactNode;
    count: number | undefined;
  }> = [
    {
      id:    'sugestoes',
      label: 'Sugestões',
      icon:  <CheckSquare className="size-4" aria-hidden="true" />,
      count: suggestionsCount.data?.total,
    },
    {
      id:    'requisicoes',
      label: 'Requisições',
      icon:  <Package className="size-4" aria-hidden="true" />,
      count: undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-0">
      <SuprimentosTabs />

      <div className="flex flex-col gap-6 p-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Compras</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie sugestões automáticas e requisições de compra
            </p>
          </div>
          <Button
            onClick={() => { setPrefillItems([]); setNewSheetOpen(true); }}
            aria-label="Criar nova requisição de compra"
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            Nova Requisição
          </Button>
        </div>

        {/* Sub-tabs */}
        <nav
          className="flex border-b border-border gap-0"
          role="tablist"
          aria-label="Abas de compras"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setTab(tab.id)}
              className={cn(
                'relative inline-flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium',
                'border-b-2 -mb-px transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                activeTab === tab.id
                  ? 'text-foreground border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border',
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span
                  className="ml-1 inline-flex items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground"
                  aria-label={`${tab.count} item${tab.count !== 1 ? 's' : ''}`}
                >
                  {tab.count > 99 ? '99+' : tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Conteúdo das tabs */}
        <div
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-label={TABS.find((t) => t.id === activeTab)?.label}
        >
          {activeTab === 'sugestoes' && (
            <SuggestionsTab onCreateFromSelected={handleCreateFromSuggestions} />
          )}
          {activeTab === 'requisicoes' && <OrdersTab />}
        </div>
      </div>

      <PurchaseOrderSheet
        open={newSheetOpen}
        prefillItems={prefillItems}
        onClose={() => { setNewSheetOpen(false); setPrefillItems([]); }}
        onSuccess={() => {
          utils.supply.purchaseOrders.list.invalidate();
          utils.supply.purchaseOrders.suggestions.invalidate();
          setTab('requisicoes');
        }}
      />
    </div>
  );
}
