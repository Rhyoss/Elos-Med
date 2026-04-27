'use client';

import { Badge } from '@dermaos/ui';
import { cn } from '@dermaos/ui';
import type { InvoiceStatus } from '@dermaos/shared';

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  rascunho:  { label: 'Rascunho',  className: 'bg-gray-100 text-gray-600 border-gray-200' },
  emitida:   { label: 'Emitida',   className: 'bg-blue-100 text-blue-700 border-blue-200' },
  parcial:   { label: 'Parcial',   className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  paga:      { label: 'Paga',      className: 'bg-green-100 text-green-700 border-green-200' },
  vencida:   { label: 'Vencida',   className: 'bg-red-100 text-red-700 border-red-200' },
  cancelada: { label: 'Cancelada', className: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
};

interface InvoiceStatusBadgeProps {
  status:    InvoiceStatus;
  className?: string;
}

export function InvoiceStatusBadge({ status, className }: InvoiceStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.rascunho;
  return (
    <Badge className={cn('border text-xs font-medium', cfg.className, className)}>
      {cfg.label}
    </Badge>
  );
}
