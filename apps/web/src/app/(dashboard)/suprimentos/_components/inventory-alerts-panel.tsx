'use client';

import * as React from 'react';
import { trpc } from '@/lib/trpc-provider';
import { useRealtime } from '@/hooks/use-realtime';
import { InventoryAlertCard, type InventoryAlertSummary } from './inventory-alert-card';

/* ──────────────────────────────────────────────────────────────────────────
   InventoryAlertsPanel
   Container que combina queries reais (stock.position + lots.list) para
   alimentar o InventoryAlertCard. Usa `limit:1` em cada chamada e lê apenas
   o campo `total`, evitando custo desnecessário na lista paginada.

   - Vencidos:   lots.list({ statuses:['expired'] })
   - Próx. 30d:  lots.list({ alertLevel:'critical' })   (excluindo expired)
   - Próx. 60d:  lots.list({ alertLevel:'warning'  })
   - Crítico:    stock.position({ statuses:['CRITICO'] })
   - Ruptura:    stock.position({ statuses:['RUPTURA'] })
   ────────────────────────────────────────────────────────────────────── */

export function InventoryAlertsPanel() {
  const utils = trpc.useUtils();

  const expiredQuery = trpc.supply.lots.list.useQuery(
    { statuses: ['expired'], includeConsumed: false, page: 1, limit: 1 },
    { staleTime: 60_000 },
  );
  const criticalQuery = trpc.supply.lots.list.useQuery(
    { alertLevel: 'critical', includeConsumed: false, page: 1, limit: 1 },
    { staleTime: 60_000 },
  );
  const warningQuery = trpc.supply.lots.list.useQuery(
    { alertLevel: 'warning', includeConsumed: false, page: 1, limit: 1 },
    { staleTime: 60_000 },
  );
  const ruptureQuery = trpc.supply.stock.position.useQuery(
    { statuses: ['RUPTURA'], page: 1, limit: 1 },
    { staleTime: 60_000 },
  );
  const lowQuery = trpc.supply.stock.position.useQuery(
    { statuses: ['CRITICO'], page: 1, limit: 1 },
    { staleTime: 60_000 },
  );

  const queries = [expiredQuery, criticalQuery, warningQuery, ruptureQuery, lowQuery];
  const isLoading = queries.some((q) => q.isLoading);
  const isError   = queries.every((q) => q.isError);

  function refetchAll() {
    void utils.supply.lots.list.invalidate();
    void utils.supply.stock.position.invalidate();
  }

  useRealtime(
    [
      'stock.lot_status_changed',
      'stock.lot_expiring',
      'stock.rupture',
      'stock.critical_alert',
      'stock.low_alert',
      'stock.entry',
      'stock.exit',
    ],
    refetchAll,
  );

  const alerts: InventoryAlertSummary[] = React.useMemo(() => [
    {
      key:   'expired',
      tone:  'critical',
      icon:  'alert',
      label: 'Vencidos',
      count: expiredQuery.data?.total ?? 0,
      hint:  'lotes',
      href:  '/suprimentos/lotes?status=expired',
    },
    {
      key:   'expiring_30d',
      tone:  'critical',
      icon:  'clock',
      label: 'Vencem em 30d',
      count: criticalQuery.data?.total ?? 0,
      hint:  'lotes',
      href:  '/suprimentos/lotes?alertLevel=critical',
    },
    {
      key:   'expiring_60d',
      tone:  'warning',
      icon:  'clock',
      label: 'Vencem em 60d',
      count: warningQuery.data?.total ?? 0,
      hint:  'lotes',
      href:  '/suprimentos/lotes?alertLevel=warning',
    },
    {
      key:   'rupture',
      tone:  'critical',
      icon:  'x',
      label: 'Ruptura',
      count: ruptureQuery.data?.total ?? 0,
      hint:  'produtos',
      href:  '/suprimentos?status=RUPTURA',
    },
    {
      key:   'low_stock',
      tone:  'warning',
      icon:  'activity',
      label: 'Abaixo do mínimo',
      count: lowQuery.data?.total ?? 0,
      hint:  'produtos',
      href:  '/suprimentos?status=CRITICO',
    },
  ], [
    expiredQuery.data?.total,
    criticalQuery.data?.total,
    warningQuery.data?.total,
    ruptureQuery.data?.total,
    lowQuery.data?.total,
  ]);

  return (
    <InventoryAlertCard
      alerts={alerts}
      isLoading={isLoading}
      isError={isError}
      onRetry={refetchAll}
    />
  );
}
