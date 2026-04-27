'use client';

import { Badge } from '@dermaos/ui';
import type { KitAvailabilityStatus } from '@dermaos/shared';

const LABELS: Record<KitAvailabilityStatus, string> = {
  completo:     'Disponível',
  parcial:      'Parcial',
  indisponivel: 'Indisponível',
};

const VARIANTS: Record<KitAvailabilityStatus, 'success' | 'warning' | 'danger'> = {
  completo:     'success',
  parcial:      'warning',
  indisponivel: 'danger',
};

export function KitAvailabilityBadge({ status }: { status: KitAvailabilityStatus }) {
  return (
    <Badge variant={VARIANTS[status]} aria-label={`Disponibilidade ${LABELS[status]}`}>
      {LABELS[status]}
    </Badge>
  );
}
