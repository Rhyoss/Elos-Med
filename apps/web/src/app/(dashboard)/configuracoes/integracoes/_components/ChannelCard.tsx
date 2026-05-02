'use client';

import * as React from 'react';
import { Glass, Btn, Mono, Ico, type IcoName } from '@dermaos/ui/ds';
import { T } from '@dermaos/ui/ds';
import { ProviderStatusBadge } from './ProviderStatusBadge';
import type { ChannelViewModel } from '../_lib/channel-adapter';
import { ACTION_LABEL } from '../_lib/channel-adapter';

const CATEGORY_ICON: Record<ChannelViewModel['category'], IcoName> = {
  social:    'message',
  messaging: 'message',
  email:     'mail',
  voice:     'phone',
  web:       'globe',
  custom:    'layers',
};

function formatSyncDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
    hour:  '2-digit',
    minute: '2-digit',
  });
}

interface ChannelCardProps {
  channel: ChannelViewModel;
  onConnect?: (channel: ChannelViewModel) => void;
}

export function ChannelCard({ channel, onConnect }: ChannelCardProps) {
  const icon = CATEGORY_ICON[channel.category];
  const isConnected = channel.status === 'connected';
  const hasError    = channel.status === 'error';

  const iconBg     = isConnected ? T.successBg     : hasError ? T.dangerBg     : T.primaryBg;
  const iconBorder = isConnected ? T.successBorder  : hasError ? T.dangerBorder  : T.primaryBorder;
  const iconColor  = isConnected ? T.success        : hasError ? T.danger        : T.textMuted;

  return (
    <Glass hover style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: T.r.md,
              background: iconBg,
              border: `1px solid ${iconBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Ico name={icon} size={20} color={iconColor} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, lineHeight: 1.3 }}>
              {channel.label}
            </p>
            <Mono size={10} color={T.textMuted} style={{ marginTop: 2 }}>
              {channel.provider}
            </Mono>
          </div>
        </div>

        {/* Description */}
        <p style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.55, flex: 1 }}>
          {channel.description}
        </p>

        {/* Error message */}
        {hasError && channel.lastError && (
          <div
            role="alert"
            style={{
              padding: '6px 10px',
              borderRadius: T.r.sm,
              background: T.dangerBg,
              border: `1px solid ${T.dangerBorder}`,
              fontSize: 12,
              color: T.danger,
              lineHeight: 1.4,
            }}
          >
            {channel.lastError}
          </div>
        )}

        {/* Footer row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            paddingTop: 4,
            borderTop: `1px solid ${T.divider}`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <ProviderStatusBadge status={channel.status} />
            {channel.lastSyncAt && (
              <Mono size={10} color={T.textMuted}>
                Sync {formatSyncDate(channel.lastSyncAt)}
              </Mono>
            )}
          </div>

          <Btn
            small
            variant={hasError ? 'danger' : isConnected ? 'glass' : 'ghost'}
            onClick={() => onConnect?.(channel)}
            aria-label={`${ACTION_LABEL[channel.status]}: ${channel.label}`}
          >
            {ACTION_LABEL[channel.status]}
          </Btn>
        </div>
      </div>
    </Glass>
  );
}
