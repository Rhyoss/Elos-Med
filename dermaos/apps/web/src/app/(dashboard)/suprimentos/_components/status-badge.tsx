'use client';

import * as React from 'react';
import { Badge } from '@dermaos/ui';
import { STOCK_STATUS_LABELS, type StockStatus } from '@dermaos/shared';

interface StatusBadgeProps {
  statuses:  StockStatus[];
  showAll?:  boolean;
  className?: string;
}

const STATUS_VARIANTS: Record<StockStatus, { className: string; label: string }> = {
  OK:                 { className: 'bg-green-100 text-green-800 border-green-200',   label: STOCK_STATUS_LABELS.OK },
  ATENCAO:            { className: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: STOCK_STATUS_LABELS.ATENCAO },
  CRITICO:            { className: 'bg-red-100 text-red-800 border-red-200',          label: STOCK_STATUS_LABELS.CRITICO },
  RUPTURA:            { className: 'bg-gray-900 text-white border-gray-700',           label: STOCK_STATUS_LABELS.RUPTURA },
  VENCIMENTO_PROXIMO: { className: 'bg-orange-100 text-orange-800 border-orange-200', label: STOCK_STATUS_LABELS.VENCIMENTO_PROXIMO },
};

const STATUS_PRIORITY: Record<StockStatus, number> = {
  RUPTURA:            1,
  CRITICO:            2,
  ATENCAO:            3,
  VENCIMENTO_PROXIMO: 4,
  OK:                 5,
};

export function StatusBadge({ statuses, showAll = false, className }: StatusBadgeProps) {
  if (!statuses || statuses.length === 0) {
    const cfg = STATUS_VARIANTS.OK;
    return (
      <Badge className={`border text-xs font-medium ${cfg.className} ${className ?? ''}`}>
        {cfg.label}
      </Badge>
    );
  }

  const sorted = [...statuses].sort(
    (a, b) => STATUS_PRIORITY[a] - STATUS_PRIORITY[b],
  );

  if (!showAll) {
    const primary = sorted[0]!;
    const cfg     = STATUS_VARIANTS[primary];
    return (
      <Badge className={`border text-xs font-medium ${cfg.className} ${className ?? ''}`}>
        {cfg.label}
        {sorted.length > 1 && (
          <span
            className="ml-1 rounded-full bg-black/10 px-1 text-[10px]"
            aria-label={`mais ${sorted.length - 1} status`}
          >
            +{sorted.length - 1}
          </span>
        )}
      </Badge>
    );
  }

  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ''}`}>
      {sorted.map((s) => {
        const cfg = STATUS_VARIANTS[s];
        return (
          <Badge
            key={s}
            className={`border text-xs font-medium ${cfg.className}`}
          >
            {cfg.label}
          </Badge>
        );
      })}
    </div>
  );
}
