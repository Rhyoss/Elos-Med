import * as React from 'react';
import { Glass, Mono, Ico, Skeleton } from '@dermaos/ui/ds';
import { T } from '@dermaos/ui/ds';
import type { ChannelViewModel } from '../_lib/channel-adapter';

interface StatTileProps {
  count: number;
  label: string;
  color: string;
  bg: string;
  border: string;
}

function StatTile({ count, label, color, bg, border }: StatTileProps) {
  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 90,
        padding: '12px 16px',
        borderRadius: T.r.md,
        background: bg,
        border: `1px solid ${border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{count}</span>
      <Mono size={10} color={color}>{label}</Mono>
    </div>
  );
}

interface IntegrationHealthPanelProps {
  channels: ChannelViewModel[];
  isLoading?: boolean;
}

export function IntegrationHealthPanel({ channels, isLoading }: IntegrationHealthPanelProps) {
  if (isLoading) {
    return (
      <Glass style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height={64} style={{ flex: '1 1 0', minWidth: 90 }} delay={i * 80} />
          ))}
        </div>
      </Glass>
    );
  }

  const connected = channels.filter((c) => c.status === 'connected').length;
  const errors    = channels.filter((c) => c.status === 'error').length;
  const pending   = channels.filter((c) => c.status === 'pending').length;
  const total     = channels.length;

  return (
    <Glass style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Ico name="layers" size={16} color={T.textMuted} />
        <Mono size={10} color={T.textMuted} spacing="0.8px">SAÚDE DAS INTEGRAÇÕES</Mono>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatTile
          count={connected}
          label="CONECTADOS"
          color={T.success}
          bg={T.successBg}
          border={T.successBorder}
        />
        <StatTile
          count={errors}
          label="COM ERRO"
          color={errors > 0 ? T.danger : T.textMuted}
          bg={errors > 0 ? T.dangerBg : T.primaryBg}
          border={errors > 0 ? T.dangerBorder : T.divider}
        />
        <StatTile
          count={pending}
          label="PENDENTES"
          color={pending > 0 ? T.warning : T.textMuted}
          bg={pending > 0 ? T.warningBg : T.primaryBg}
          border={pending > 0 ? T.warningBorder : T.divider}
        />
        <StatTile
          count={total}
          label="CANAIS TOTAIS"
          color={T.primary}
          bg={T.primaryBg}
          border={T.primaryBorder}
        />
      </div>
    </Glass>
  );
}
