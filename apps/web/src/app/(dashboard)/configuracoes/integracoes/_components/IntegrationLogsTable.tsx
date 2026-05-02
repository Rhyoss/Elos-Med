'use client';

import * as React from 'react';
import { Glass, Btn, Mono, Ico, Skeleton, Badge, ErrorState, type IcoName, type BadgeVariant } from '@dermaos/ui/ds';
import { T } from '@dermaos/ui/ds';
import type { ChannelType } from '../_lib/channel-adapter';

// ── Types ──────────────────────────────────────────────────────────

export type LogDirection = 'inbound' | 'outbound';
export type LogStatus = 'success' | 'error' | 'pending' | 'retrying';

export interface IntegrationLogEntry {
  id: string;
  timestamp: Date;
  channel: ChannelType;
  event: string;
  direction: LogDirection;
  status: LogStatus;
  provider: string;
  entityType?: string;
  entityId?: string;
  errorSummary?: string;
  canReprocess?: boolean;
}

interface IntegrationLogsTableProps {
  logs: IntegrationLogEntry[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  onViewDetail?: (log: IntegrationLogEntry) => void;
  onReprocess?: (log: IntegrationLogEntry) => void;
  channelFilter?: ChannelType;
}

// ── Constants ──────────────────────────────────────────────────────

const CHANNEL_LABEL: Record<ChannelType, string> = {
  whatsapp:  'WhatsApp',
  instagram: 'Instagram',
  facebook:  'Messenger',
  email:     'Email',
  sms:       'SMS',
  phone:     'Telefone',
  webchat:   'Webchat',
  custom:    'Custom',
};

const DIRECTION_LABEL: Record<LogDirection, string> = {
  inbound:  'Entrada',
  outbound: 'Saída',
};

const DIRECTION_ICON: Record<LogDirection, IcoName> = {
  inbound:  'download',
  outbound: 'arrowRight',
};

const STATUS_VARIANT: Record<LogStatus, BadgeVariant> = {
  success:   'success',
  error:     'danger',
  pending:   'warning',
  retrying:  'info',
};

const STATUS_LABEL: Record<LogStatus, string> = {
  success:   'Sucesso',
  error:     'Erro',
  pending:   'Pendente',
  retrying:  'Reprocessando',
};

function formatLogDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', {
    day:    '2-digit',
    month:  '2-digit',
    year:   '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ── Component ──────────────────────────────────────────────────────

export function IntegrationLogsTable({
  logs,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  onViewDetail,
  onReprocess,
  channelFilter,
}: IntegrationLogsTableProps) {
  const [page, setPage] = React.useState(0);
  const pageSize = 15;

  const filtered = channelFilter ? logs.filter((l) => l.channel === channelFilter) : logs;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  if (isError) {
    return (
      <ErrorState
        title="Erro ao carregar logs"
        description={errorMessage ?? 'Não foi possível buscar os logs de integração. Tente novamente.'}
        action={
          onRetry ? (
            <Btn small variant="glass" icon="zap" onClick={onRetry}>
              Tentar novamente
            </Btn>
          ) : undefined
        }
      />
    );
  }

  if (isLoading) {
    return (
      <Glass style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={44} delay={i * 60} />
          ))}
        </div>
      </Glass>
    );
  }

  if (filtered.length === 0) {
    return (
      <Glass style={{ padding: '40px 20px', textAlign: 'center' }}>
        <Ico name="activity" size={32} color={T.textMuted} />
        <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, marginTop: 12 }}>
          Nenhum log registrado
        </p>
        <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 4 }}>
          Os logs de integrações aparecerão aqui conforme mensagens forem enviadas e recebidas.
        </p>
      </Glass>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Glass style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          >
            <thead>
              <tr
                style={{
                  background: T.glass,
                  borderBottom: `1px solid ${T.divider}`,
                }}
              >
                {['Data/Hora', 'Canal', 'Evento', 'Direção', 'Status', 'Provider', 'Entidade', 'Erro', 'Ações'].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 14px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: T.textMuted,
                        fontSize: 11,
                        letterSpacing: '0.4px',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {paged.map((log) => (
                <tr
                  key={log.id}
                  style={{
                    borderBottom: `1px solid ${T.divider}`,
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = T.glass;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <Mono size={11} color={T.textSecondary}>
                      {formatLogDate(log.timestamp)}
                    </Mono>
                  </td>

                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500 }}>
                      {CHANNEL_LABEL[log.channel]}
                    </span>
                  </td>

                  <td style={{ padding: '10px 14px' }}>
                    <Mono size={11} color={T.textPrimary}>{log.event}</Mono>
                  </td>

                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Ico
                        name={DIRECTION_ICON[log.direction]}
                        size={12}
                        color={log.direction === 'inbound' ? T.primary : T.success}
                      />
                      <span style={{ fontSize: 12, color: T.textSecondary }}>
                        {DIRECTION_LABEL[log.direction]}
                      </span>
                    </div>
                  </td>

                  <td style={{ padding: '10px 14px' }}>
                    <Badge variant={STATUS_VARIANT[log.status]}>
                      {STATUS_LABEL[log.status]}
                    </Badge>
                  </td>

                  <td style={{ padding: '10px 14px' }}>
                    <Mono size={10} color={T.textMuted}>{log.provider}</Mono>
                  </td>

                  <td style={{ padding: '10px 14px' }}>
                    {log.entityType ? (
                      <span style={{ fontSize: 12, color: T.textSecondary }}>
                        {log.entityType}
                        {log.entityId && (
                          <Mono size={10} color={T.textMuted} style={{ marginLeft: 4 }}>
                            #{log.entityId.slice(0, 8)}
                          </Mono>
                        )}
                      </span>
                    ) : (
                      <Mono size={10} color={T.textMuted}>—</Mono>
                    )}
                  </td>

                  <td style={{ padding: '10px 14px', maxWidth: 200 }}>
                    {log.errorSummary ? (
                      <span
                        style={{
                          fontSize: 12,
                          color: T.danger,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {log.errorSummary}
                      </span>
                    ) : (
                      <Mono size={10} color={T.textMuted}>—</Mono>
                    )}
                  </td>

                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Btn
                        small
                        variant="ghost"
                        icon="eye"
                        iconOnly
                        onClick={() => onViewDetail?.(log)}
                        aria-label="Ver detalhe"
                      />
                      {log.canReprocess && log.status === 'error' && (
                        <Btn
                          small
                          variant="ghost"
                          icon="zap"
                          iconOnly
                          onClick={() => onReprocess?.(log)}
                          aria-label="Reprocessar"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Glass>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Mono size={11} color={T.textMuted}>
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
          </Mono>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Btn
              small
              variant="ghost"
              icon="arrowLeft"
              iconOnly
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label="Página anterior"
            />
            <Mono size={11} color={T.textSecondary}>
              {page + 1} / {totalPages}
            </Mono>
            <Btn
              small
              variant="ghost"
              icon="arrowRight"
              iconOnly
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              aria-label="Próxima página"
            />
          </div>
        </div>
      )}
    </div>
  );
}
