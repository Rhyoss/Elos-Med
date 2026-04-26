'use client';

import * as React from 'react';
import {
  Badge,
  Button,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@dermaos/ui';
import {
  MoreHorizontal,
  AlertTriangle,
  ShieldAlert,
  Ban,
  PackageCheck,
} from 'lucide-react';
import {
  LOT_STATUS_LABELS,
  EXPIRY_ALERT_LEVEL_LABELS,
  type LotStatus,
  type ExpiryAlertLevel,
} from '@dermaos/shared';

export interface LotRow {
  id:                    string;
  product_id:            string;
  product_name:          string;
  product_sku:           string | null;
  product_unit:          string;
  storage_location_id:   string | null;
  storage_location_name: string | null;
  lot_number:            string;
  batch_number:          string | null;
  expiry_date:           string | null;
  quantity_current:      number;
  quantity_initial:      number;
  status:                LotStatus;
  expiry_alert_level:    ExpiryAlertLevel;
  days_to_expiry:        number | null;
  is_quarantined:        boolean;
  quarantine_reason:     string | null;
  received_at:           string;
}

interface LotsTableProps {
  rows:            LotRow[];
  isLoading:       boolean;
  onQuarantine:    (row: LotRow) => void;
  onChangeStatus:  (row: LotRow, target: LotStatus) => void;
  onRegisterExit:  (row: LotRow) => void;
  onTransfer:      (row: LotRow) => void;
}

function formatDateBR(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatQty(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

function ExpiryCell({ row }: { row: LotRow }) {
  if (!row.expiry_date) {
    return <span className="text-muted-foreground text-sm">Sem validade</span>;
  }
  const fmt = formatDateBR(row.expiry_date);
  const days = row.days_to_expiry;
  let colorClass = 'text-foreground';
  if (row.expiry_alert_level === 'critical') colorClass = 'text-red-600 font-semibold';
  else if (row.expiry_alert_level === 'warning') colorClass = 'text-yellow-600 font-medium';

  const suffix =
    days == null      ? '' :
    days < 0          ? ` (vencido há ${Math.abs(days)}d)` :
    days === 0        ? ' (vence hoje)' :
                        ` (${days}d)`;

  return (
    <span className={`text-sm ${colorClass}`} title={`${fmt}${suffix}`}>
      {fmt}
      <span className="ml-1 text-xs">{suffix}</span>
    </span>
  );
}

function StatusPill({ status }: { status: LotStatus }) {
  const variant: Record<LotStatus, 'success' | 'neutral' | 'danger' | 'warning'> = {
    active:      'success',
    consumed:    'neutral',
    quarantined: 'warning',
    expired:     'danger',
  };
  return <Badge variant={variant[status]}>{LOT_STATUS_LABELS[status]}</Badge>;
}

function AlertPill({ level }: { level: ExpiryAlertLevel }) {
  if (level === 'none') return <span className="text-xs text-muted-foreground">—</span>;
  const Icon = level === 'critical' ? ShieldAlert : AlertTriangle;
  const color =
    level === 'critical' ? 'bg-red-100 text-red-800 border-red-200'
                         : 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}
      aria-label={`Alerta: ${EXPIRY_ALERT_LEVEL_LABELS[level]}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {EXPIRY_ALERT_LEVEL_LABELS[level]}
    </span>
  );
}

export function LotsTable({
  rows,
  isLoading,
  onQuarantine,
  onChangeStatus,
  onRegisterExit,
  onTransfer,
}: LotsTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="table">
          <thead className="bg-muted/40 text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Produto</th>
              <th className="px-3 py-2.5">Lote</th>
              <th className="px-3 py-2.5">Validade</th>
              <th className="px-3 py-2.5 text-right">Saldo</th>
              <th className="px-3 py-2.5">Local</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Alerta</th>
              <th className="px-3 py-2.5 w-12 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`border-t transition-colors hover:bg-muted/30 ${
                  row.status === 'expired' ? 'bg-red-50/50'
                    : row.status === 'quarantined' ? 'bg-yellow-50/30'
                    : ''
                }`}
              >
                <td className="px-3 py-2.5 align-middle">
                  <div className="font-medium">{row.product_name}</div>
                  {row.product_sku && (
                    <div className="text-xs text-muted-foreground font-mono">{row.product_sku}</div>
                  )}
                </td>
                <td className="px-3 py-2.5 align-middle font-mono text-xs">
                  {row.lot_number}
                  {row.batch_number && (
                    <div className="text-muted-foreground">batch: {row.batch_number}</div>
                  )}
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <ExpiryCell row={row} />
                </td>
                <td className="px-3 py-2.5 align-middle text-right tabular-nums">
                  {formatQty(row.quantity_current)}
                  <span className="ml-1 text-xs text-muted-foreground">{row.product_unit}</span>
                  <div className="text-xs text-muted-foreground">
                    inicial: {formatQty(row.quantity_initial)}
                  </div>
                </td>
                <td className="px-3 py-2.5 align-middle">
                  {row.storage_location_name ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <StatusPill status={row.status} />
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <AlertPill level={row.expiry_alert_level} />
                </td>
                <td className="px-3 py-2.5 align-middle text-right">
                  <DropdownMenuRoot>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Ações do lote"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={row.status !== 'active' || Number(row.quantity_current) <= 0}
                        onSelect={() => onRegisterExit(row)}
                      >
                        Registrar saída
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={row.status !== 'active' || Number(row.quantity_current) <= 0}
                        onSelect={() => onTransfer(row)}
                      >
                        Transferir
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={row.status === 'quarantined' || row.status === 'consumed'}
                        onSelect={() => onQuarantine(row)}
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Colocar em quarentena
                      </DropdownMenuItem>
                      {row.status === 'quarantined' && (
                        <DropdownMenuItem onSelect={() => onChangeStatus(row, 'active')}>
                          <PackageCheck className="mr-2 h-4 w-4" />
                          Reativar lote
                        </DropdownMenuItem>
                      )}
                      {row.status === 'active' && Number(row.quantity_current) === 0 && (
                        <DropdownMenuItem onSelect={() => onChangeStatus(row, 'consumed')}>
                          Marcar como consumido
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenuRoot>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

