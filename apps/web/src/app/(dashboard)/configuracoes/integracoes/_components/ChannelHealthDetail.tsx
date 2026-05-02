'use client';

import * as React from 'react';
import { Glass, Btn, Mono, Ico, Badge, type IcoName, type BadgeVariant } from '@dermaos/ui/ds';
import { T } from '@dermaos/ui/ds';
import type { ChannelType } from '../_lib/channel-adapter';

// ── Types ──────────────────────────────────────────────────────────

export interface ChannelHealthData {
  channel: ChannelType;
  lastInbound?: Date;
  lastOutbound?: Date;
  errorRate: number;
  retryQueueSize: number;
  tokenExpiresAt?: Date;
  webhookFailingSince?: Date;
  missingPermissions: string[];
  uptimePercent?: number;
  avgLatencyMs?: number;
}

type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

interface ChannelHealthDetailProps {
  health: ChannelHealthData;
  onFixPermissions?: () => void;
  onRefreshToken?: () => void;
  onFixWebhook?: () => void;
  onRetryQueue?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────

function relativeTime(d: Date): string {
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function daysUntil(d: Date): number {
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

function resolveStatus(health: ChannelHealthData): HealthStatus {
  if (health.errorRate > 20) return 'critical';
  if (health.webhookFailingSince) return 'critical';
  if (health.missingPermissions.length > 0) return 'critical';
  if (health.tokenExpiresAt && daysUntil(health.tokenExpiresAt) <= 7) return 'warning';
  if (health.errorRate > 5) return 'warning';
  if (health.retryQueueSize > 10) return 'warning';
  if (!health.lastInbound && !health.lastOutbound) return 'unknown';
  return 'healthy';
}

const STATUS_CONFIG: Record<HealthStatus, { label: string; variant: BadgeVariant; icon: IcoName; color: string; bg: string; border: string }> = {
  healthy:  { label: 'Saudável',     variant: 'success', icon: 'check',    color: T.success, bg: T.successBg, border: T.successBorder },
  warning:  { label: 'Atenção',      variant: 'warning', icon: 'alert',    color: T.warning, bg: T.warningBg, border: T.warningBorder },
  critical: { label: 'Crítico',      variant: 'danger',  icon: 'x',        color: T.danger,  bg: T.dangerBg,  border: T.dangerBorder },
  unknown:  { label: 'Sem dados',    variant: 'default', icon: 'more',     color: T.textMuted, bg: T.glass, border: T.divider },
};

// ── Metric row ─────────────────────────────────────────────────────

function MetricRow({
  icon,
  label,
  value,
  status,
  action,
}: {
  icon: IcoName;
  label: string;
  value: React.ReactNode;
  status?: 'ok' | 'warning' | 'error';
  action?: React.ReactNode;
}) {
  const dotColor = status === 'ok' ? T.success : status === 'warning' ? T.warning : status === 'error' ? T.danger : T.textMuted;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: T.r.md,
        background: status === 'error' ? T.dangerBg : status === 'warning' ? T.warningBg : 'transparent',
        border: status === 'error' ? `1px solid ${T.dangerBorder}` : status === 'warning' ? `1px solid ${T.warningBorder}` : `1px solid ${T.divider}`,
      }}
    >
      <Ico name={icon} size={15} color={T.textMuted} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: T.textMuted }}>{label}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {status && (
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: dotColor,
              flexShrink: 0,
            }}
          />
        )}
        <span style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary, whiteSpace: 'nowrap' }}>
          {value}
        </span>
        {action}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────

export function ChannelHealthDetail({
  health,
  onFixPermissions,
  onRefreshToken,
  onFixWebhook,
  onRetryQueue,
}: ChannelHealthDetailProps) {
  const status = resolveStatus(health);
  const sc = STATUS_CONFIG[status];

  const tokenDays = health.tokenExpiresAt ? daysUntil(health.tokenExpiresAt) : null;
  const tokenStatus: 'ok' | 'warning' | 'error' | undefined =
    tokenDays == null ? undefined
    : tokenDays <= 0 ? 'error'
    : tokenDays <= 7 ? 'warning'
    : 'ok';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Status banner */}
      <Glass
        style={{
          padding: '16px 20px',
          background: sc.bg,
          border: `1px solid ${sc.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: sc.bg,
              border: `2px solid ${sc.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ico name={sc.icon} size={20} color={sc.color} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: sc.color }}>
                {sc.label}
              </span>
              {health.uptimePercent != null && (
                <Mono size={10} color={T.textMuted}>
                  Uptime: {health.uptimePercent.toFixed(1)}%
                </Mono>
              )}
            </div>
            {health.avgLatencyMs != null && (
              <Mono size={10} color={T.textMuted} style={{ marginTop: 2 }}>
                Latência média: {health.avgLatencyMs}ms
              </Mono>
            )}
          </div>
        </div>
      </Glass>

      {/* Metrics */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Mono size={10} color={T.textMuted} spacing="0.8px" style={{ marginBottom: 2 }}>
          MÉTRICAS DETALHADAS
        </Mono>

        <MetricRow
          icon="download"
          label="Último inbound"
          value={health.lastInbound ? relativeTime(health.lastInbound) : 'Nenhum registro'}
          status={health.lastInbound ? 'ok' : undefined}
        />

        <MetricRow
          icon="arrowRight"
          label="Último outbound"
          value={health.lastOutbound ? relativeTime(health.lastOutbound) : 'Nenhum registro'}
          status={health.lastOutbound ? 'ok' : undefined}
        />

        <MetricRow
          icon="activity"
          label="Taxa de erro"
          value={`${health.errorRate.toFixed(1)}%`}
          status={health.errorRate > 20 ? 'error' : health.errorRate > 5 ? 'warning' : 'ok'}
        />

        <MetricRow
          icon="layers"
          label="Fila de retries"
          value={`${health.retryQueueSize} mensagen${health.retryQueueSize !== 1 ? 's' : ''}`}
          status={health.retryQueueSize > 50 ? 'error' : health.retryQueueSize > 10 ? 'warning' : 'ok'}
          action={
            health.retryQueueSize > 0 && onRetryQueue ? (
              <Btn small variant="ghost" icon="zap" iconOnly onClick={onRetryQueue} aria-label="Processar fila" />
            ) : undefined
          }
        />

        <MetricRow
          icon="lock"
          label="Token expira em"
          value={
            health.tokenExpiresAt
              ? tokenDays != null && tokenDays <= 0
                ? 'Expirado!'
                : `${tokenDays}d (${formatDate(health.tokenExpiresAt)})`
              : 'N/A'
          }
          status={tokenStatus}
          action={
            tokenStatus === 'warning' || tokenStatus === 'error' ? (
              <Btn small variant="ghost" icon="zap" onClick={onRefreshToken}>
                Renovar
              </Btn>
            ) : undefined
          }
        />

        <MetricRow
          icon="zap"
          label="Webhook falhando desde"
          value={health.webhookFailingSince ? formatDate(health.webhookFailingSince) : 'Sem falhas'}
          status={health.webhookFailingSince ? 'error' : 'ok'}
          action={
            health.webhookFailingSince && onFixWebhook ? (
              <Btn small variant="ghost" icon="settings" onClick={onFixWebhook}>
                Corrigir
              </Btn>
            ) : undefined
          }
        />

        <MetricRow
          icon="shield"
          label="Permissões faltantes"
          value={
            health.missingPermissions.length > 0
              ? health.missingPermissions.join(', ')
              : 'Todas concedidas'
          }
          status={health.missingPermissions.length > 0 ? 'error' : 'ok'}
          action={
            health.missingPermissions.length > 0 && onFixPermissions ? (
              <Btn small variant="ghost" icon="shield" onClick={onFixPermissions}>
                Corrigir
              </Btn>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
