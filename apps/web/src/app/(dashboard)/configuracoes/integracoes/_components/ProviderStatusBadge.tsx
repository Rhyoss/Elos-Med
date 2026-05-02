import * as React from 'react';
import { Badge, type BadgeVariant } from '@dermaos/ui/ds';
import type { ChannelStatus } from '../_lib/channel-adapter';
import { STATUS_LABEL } from '../_lib/channel-adapter';

const STATUS_VARIANT: Record<ChannelStatus, BadgeVariant> = {
  connected:    'success',
  disconnected: 'default',
  pending:      'warning',
  error:        'danger',
  sandbox:      'info',
  inactive:     'warning',
};

interface ProviderStatusBadgeProps {
  status: ChannelStatus;
  className?: string;
}

export function ProviderStatusBadge({ status, className }: ProviderStatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
