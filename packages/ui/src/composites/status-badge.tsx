import * as React from 'react';
import { cn } from '../utils.js';
import type {
  AppointmentStatus,
  PurchaseStatus,
  InventoryStatus,
  AnyStatus,
} from './status-badge.types.js';

/* ── Configurações de aparência ──────────────────────────────────────────── */

interface StatusConfig {
  label: string;
  classes: string;
  dot: string;
}

const appointmentConfig: Record<AppointmentStatus, StatusConfig> = {
  scheduled:   { label: 'Agendado',        classes: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50',     dot: 'bg-blue-500' },
  confirmed:   { label: 'Confirmado',       classes: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50',  dot: 'bg-green-500' },
  waiting:     { label: 'Aguardando',       classes: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50',  dot: 'bg-amber-500' },
  in_progress: { label: 'Em Atendimento',   classes: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/50', dot: 'bg-purple-500' },
  completed:   { label: 'Concluído',        classes: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',    dot: 'bg-slate-400' },
  cancelled:   { label: 'Cancelado',        classes: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50',       dot: 'bg-red-500' },
  no_show:     { label: 'Não Compareceu',   classes: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/50', dot: 'bg-orange-500' },
  rescheduled: { label: 'Remarcado',        classes: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800/50', dot: 'bg-indigo-500' },
};

const purchaseConfig: Record<PurchaseStatus, StatusConfig> = {
  draft:            { label: 'Rascunho',           classes: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700', dot: 'bg-slate-400' },
  pending_approval: { label: 'Pend. Aprovação',    classes: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50', dot: 'bg-amber-500' },
  approved:         { label: 'Aprovado',            classes: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50', dot: 'bg-green-500' },
  received:         { label: 'Recebido',            classes: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50', dot: 'bg-blue-500' },
  cancelled:        { label: 'Cancelado',           classes: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50', dot: 'bg-red-500' },
};

const inventoryConfig: Record<InventoryStatus, StatusConfig> = {
  ok:       { label: 'OK',           classes: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50', dot: 'bg-green-500' },
  attention:{ label: 'Atenção',      classes: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50', dot: 'bg-amber-500' },
  critical: { label: 'Crítico',      classes: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50', dot: 'bg-red-500' },
  stockout: { label: 'Ruptura',      classes: 'bg-rose-200 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900', dot: 'bg-rose-700' },
};

function resolveConfig(status: AnyStatus, domain?: string): StatusConfig {
  if (domain === 'purchase') return purchaseConfig[status as PurchaseStatus] ?? { label: status, classes: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' };
  if (domain === 'inventory') return inventoryConfig[status as InventoryStatus] ?? { label: status, classes: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' };
  return appointmentConfig[status as AppointmentStatus] ?? { label: status, classes: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' };
}

/* ── Componente ──────────────────────────────────────────────────────────── */

export interface StatusBadgeProps {
  status: AnyStatus;
  domain?: 'appointment' | 'purchase' | 'inventory';
  showDot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({
  status,
  domain = 'appointment',
  showDot = true,
  size = 'md',
  className,
}: StatusBadgeProps) {
  const config = resolveConfig(status, domain);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs',
        config.classes,
        className,
      )}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      {showDot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full shrink-0', config.dot)}
          aria-hidden="true"
        />
      )}
      {config.label}
    </span>
  );
}
