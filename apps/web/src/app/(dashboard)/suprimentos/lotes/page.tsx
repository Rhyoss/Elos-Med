'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Checkbox,
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Textarea,
} from '@dermaos/ui';
import { Btn, PageHero } from '@dermaos/ui/ds';

function Label({
  htmlFor,
  className = '',
  children,
}: {
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`text-sm font-medium leading-none ${className}`}
    >
      {children}
    </label>
  );
}
import { Search, Plus, RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc-provider';
import { useDebounce } from '@/lib/utils';
import { useRealtime } from '@/hooks/use-realtime';
import {
  LOT_STATUSES,
  LOT_STATUS_LABELS,
  EXPIRY_ALERT_LEVELS,
  EXPIRY_ALERT_LEVEL_LABELS,
  MIN_JUSTIFICATION_LENGTH,
  type LotStatus,
  type ExpiryAlertLevel,
} from '@dermaos/shared';

import { SuprimentosTabs } from '../_components/suprimentos-tabs';
import { LotsTable, type LotRow } from '../_components/lots-table';
import {
  MovementModal,
  type MovementModalInitial,
} from '../_components/movement-modal';

const PAGE_SIZE = 50;

export default function LotesPage() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  /* ── URL-persisted filters ────────────────────────────────────────────── */
  const searchQ          = params.get('q')          ?? '';
  const filterStatus     = (params.get('status')     ?? '') as LotStatus | '';
  const filterAlertLevel = (params.get('alert')      ?? '') as ExpiryAlertLevel | '';
  const filterLocation   = params.get('location')    ?? '';
  const includeConsumed  = params.get('consumed')    === '1';
  const page             = Number(params.get('page') ?? '1');

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

  React.useEffect(() => {
    setLocalSearch(searchQ);
  }, [searchQ]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
  }

  function setPage(p: number) {
    const next = new URLSearchParams(params.toString());
    if (p === 1) next.delete('page'); else next.set('page', String(p));
    router.replace(`${pathname}?${next.toString()}`);
  }

  /* ── Queries ──────────────────────────────────────────────────────────── */
  const utils = trpc.useUtils();

  const lotsQuery = trpc.supply.lots.list.useQuery(
    {
      search:            debouncedSearch.length >= 2 ? debouncedSearch : undefined,
      statuses:          filterStatus ? [filterStatus] : undefined,
      alertLevel:        filterAlertLevel || undefined,
      storageLocationId: filterLocation || undefined,
      includeConsumed,
      page,
      limit: PAGE_SIZE,
    },
    { placeholderData: (prev) => prev, staleTime: 30_000 },
  );

  const locationsQuery = trpc.supply.storageLocations.list.useQuery(
    {},
    { staleTime: 60_000 },
  );

  const rows       = (lotsQuery.data?.data ?? []) as LotRow[];
  const total      = lotsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* ── Realtime invalidation ────────────────────────────────────────────── */
  useRealtime(
    [
      'stock.entry', 'stock.exit', 'stock.adjust', 'stock.transfer',
      'stock.lot_status_changed',
      'stock.lot_expiring', 'stock.rupture', 'stock.critical_alert', 'stock.low_alert',
    ],
    () => { void utils.supply.lots.list.invalidate(); },
  );

  /* ── Modal state ──────────────────────────────────────────────────────── */
  const [movementInitial, setMovementInitial] = React.useState<MovementModalInitial | null>(null);
  const [contextLot, setContextLot] = React.useState<LotRow | null>(null);
  const [quarantineLot, setQuarantineLot] = React.useState<LotRow | null>(null);
  const [statusChangeLot, setStatusChangeLot] = React.useState<
    { lot: LotRow; target: LotStatus } | null
  >(null);

  function handleRefresh() {
    void utils.supply.lots.list.invalidate();
  }

  function openMovementForLot(lot: LotRow, type: 'saida' | 'transferencia') {
    setContextLot(lot);
    if (type === 'saida') {
      setMovementInitial({ type: 'saida', productId: lot.product_id, lotId: lot.id });
    } else {
      setMovementInitial({
        type: 'transferencia',
        productId: lot.product_id,
        lotId: lot.id,
        fromStorageLocationId: lot.storage_location_id,
      });
    }
  }

  const hasFilters = !!(filterStatus || filterAlertLevel || filterLocation || searchQ || includeConsumed);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <SuprimentosTabs />

      <PageHero
        eyebrow="ORDENAÇÃO FEFO ATIVA"
        title="Lotes & Validades"
        module="supply"
        icon="layers"
        description="Validade mais próxima primeiro — lotes ativos com saldo"
        actions={
          <Btn
            small
            icon="plus"
            onClick={() => {
              setContextLot(null);
              setMovementInitial({ type: 'entrada' });
            }}
          >
            Nova Movimentação
          </Btn>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por lote ou produto..."
            className="pl-8"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>

        <Select
          value={filterStatus || '__all__'}
          onValueChange={(v) => updateParam('status', v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os status</SelectItem>
            {LOT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{LOT_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterAlertLevel || '__all__'}
          onValueChange={(v) => updateParam('alert', v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Alerta de validade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os alertas</SelectItem>
            {EXPIRY_ALERT_LEVELS.map((l) => (
              <SelectItem key={l} value={l}>{EXPIRY_ALERT_LEVEL_LABELS[l]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterLocation || '__all__'}
          onValueChange={(v) => updateParam('location', v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Armazenamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os locais</SelectItem>
            {(locationsQuery.data ?? []).map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5 ml-1">
          <Checkbox
            id="include-consumed"
            checked={includeConsumed}
            onCheckedChange={(v) => updateParam('consumed', v ? '1' : '')}
          />
          <Label htmlFor="include-consumed" className="text-sm cursor-pointer">
            Mostrar consumidos
          </Label>
        </div>

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
          <RefreshCw className={`h-4 w-4 ${lotsQuery.isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Summary */}
      {!lotsQuery.isLoading && (
        <p className="text-xs text-muted-foreground">
          {total === 0
            ? 'Nenhum lote encontrado'
            : `${total} lote${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
          {lotsQuery.isFetching && ' · atualizando...'}
        </p>
      )}

      {/* Table */}
      <LotsTable
        rows={rows}
        isLoading={lotsQuery.isLoading}
        onRegisterExit={(lot) => openMovementForLot(lot, 'saida')}
        onTransfer={(lot) => openMovementForLot(lot, 'transferencia')}
        onQuarantine={(lot) => setQuarantineLot(lot)}
        onChangeStatus={(lot, target) => setStatusChangeLot({ lot, target })}
      />

      {/* Empty state */}
      {!lotsQuery.isLoading && rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
          <p className="text-muted-foreground">
            {hasFilters
              ? 'Nenhum lote corresponde aos filtros selecionados.'
              : 'Nenhum lote cadastrado. Registre uma entrada para criar um lote.'}
          </p>
          {!hasFilters && (
            <Button
              size="sm"
              onClick={() => {
                setContextLot(null);
                setMovementInitial({ type: 'entrada' });
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              Registrar Entrada
            </Button>
          )}
        </div>
      )}

      {/* Pagination */}
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

      {/* Movement modal */}
      <MovementModal
        open={!!movementInitial}
        initial={movementInitial}
        contextLot={contextLot}
        onClose={() => { setMovementInitial(null); setContextLot(null); }}
        onSaved={() => { void utils.supply.lots.list.invalidate(); }}
      />

      {/* Quarantine confirm */}
      <QuarantineDialog
        lot={quarantineLot}
        onClose={() => setQuarantineLot(null)}
        onSaved={() => { void utils.supply.lots.list.invalidate(); }}
      />

      {/* Status-change confirm */}
      <StatusChangeDialog
        payload={statusChangeLot}
        onClose={() => setStatusChangeLot(null)}
        onSaved={() => { void utils.supply.lots.list.invalidate(); }}
      />
    </div>
  );
}

/* ── Quarantine dialog (simple justification) ─────────────────────────────── */

function QuarantineDialog({
  lot, onClose, onSaved,
}: {
  lot: LotRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = React.useState('');
  const quarantineMut = trpc.supply.lots.quarantine.useMutation({
    onSuccess: () => { onSaved(); onClose(); setReason(''); },
  });

  React.useEffect(() => { if (!lot) setReason(''); }, [lot]);

  const disabled = reason.trim().length < MIN_JUSTIFICATION_LENGTH || quarantineMut.isPending;

  return (
    <DialogRoot open={!!lot} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Colocar lote em quarentena</DialogTitle>
          {lot && (
            <p className="text-sm text-muted-foreground">
              {lot.product_name} · lote <span className="font-mono">{lot.lot_number}</span>
            </p>
          )}
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="quarantine-reason">
            Motivo * (min {MIN_JUSTIFICATION_LENGTH} caracteres)
          </Label>
          <Textarea
            id="quarantine-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Descreva o motivo (ex: suspeita de adulteração, temperatura fora de faixa, etc.)"
          />
          {quarantineMut.isError && (
            <p className="text-xs text-destructive" role="alert">
              {quarantineMut.error.message}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={quarantineMut.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={disabled}
            onClick={() => {
              if (!lot) return;
              void quarantineMut.mutateAsync({ lotId: lot.id, reason: reason.trim() });
            }}
          >
            {quarantineMut.isPending ? 'Aplicando...' : 'Colocar em quarentena'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}

/* ── Status-change confirm dialog ─────────────────────────────────────────── */

function StatusChangeDialog({
  payload, onClose, onSaved,
}: {
  payload: { lot: LotRow; target: LotStatus } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [justification, setJustification] = React.useState('');
  const changeMut = trpc.supply.lots.changeStatus.useMutation({
    onSuccess: () => { onSaved(); onClose(); setJustification(''); },
  });

  React.useEffect(() => { if (!payload) setJustification(''); }, [payload]);

  const disabled = justification.trim().length < MIN_JUSTIFICATION_LENGTH || changeMut.isPending;
  const targetLabel = payload ? LOT_STATUS_LABELS[payload.target] : '';

  return (
    <DialogRoot open={!!payload} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar status do lote</DialogTitle>
          {payload && (
            <p className="text-sm text-muted-foreground">
              {payload.lot.product_name} · lote{' '}
              <span className="font-mono">{payload.lot.lot_number}</span>
              {' → '}
              <strong>{targetLabel}</strong>
            </p>
          )}
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="status-justification">
            Justificativa * (min {MIN_JUSTIFICATION_LENGTH} caracteres)
          </Label>
          <Textarea
            id="status-justification"
            rows={4}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Descreva o motivo da alteração"
          />
          {changeMut.isError && (
            <p className="text-xs text-destructive" role="alert">
              {changeMut.error.message}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={changeMut.isPending}>
            Cancelar
          </Button>
          <Button
            disabled={disabled}
            onClick={() => {
              if (!payload) return;
              void changeMut.mutateAsync({
                lotId: payload.lot.id,
                status: payload.target,
                justification: justification.trim(),
              });
            }}
          >
            {changeMut.isPending ? 'Aplicando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
