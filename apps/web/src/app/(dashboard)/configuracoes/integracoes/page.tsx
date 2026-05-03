'use client';

import * as React from 'react';
import { Mono, Ico, Btn, Skeleton, ErrorState } from '@dermaos/ui/ds';
import { T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { useAuth, usePermission } from '@/lib/auth';
import { ChannelCard } from './_components/ChannelCard';
import { ChannelConnectionWizard } from './_components/ChannelConnectionWizard';
import { ChannelDetailView } from './_components/ChannelDetailView';
import { IntegrationHealthPanel } from './_components/IntegrationHealthPanel';
import { IntegrationLogsTable, type IntegrationLogEntry } from './_components/IntegrationLogsTable';
import { ConsentAndCompliancePanel, type ChannelConsentConfig } from './_components/ConsentAndCompliancePanel';
import {
  buildChannelViewModels,
  type ChannelViewModel,
  type OmniChannelData,
  type IntegrationData,
  type ChannelType,
} from './_lib/channel-adapter';

type SubSection = 'canais' | 'webhooks' | 'lgpd' | 'logs';

interface SubNavItem {
  id: SubSection;
  label: string;
  available: boolean;
}

const SUB_NAV: SubNavItem[] = [
  { id: 'canais',   label: 'Canais',    available: true },
  { id: 'webhooks', label: 'Webhooks',  available: true },
  { id: 'lgpd',     label: 'LGPD',      available: true },
  { id: 'logs',     label: 'Logs',      available: true },
];

export default function IntegracoesPage() {
  const [active, setActive] = React.useState<SubSection>('canais');
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [wizardChannel, setWizardChannel] = React.useState<ChannelViewModel | undefined>();
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailChannel, setDetailChannel] = React.useState<ChannelViewModel | undefined>();

  const { user } = useAuth();
  const canOmni  = usePermission('omni', 'read');
  const isOwner  = user?.role === 'owner';

  /**
   * Botão do card:
   *  • Conectado → abre o painel de detalhe (Editar credenciais / Testar / Desconectar).
   *  • Demais (disconnected/pending/error) → abre o wizard de conexão.
   */
  function handleConnect(ch: ChannelViewModel) {
    if (!isOwner) return;
    if (ch.status === 'connected') {
      setDetailChannel(ch);
      setDetailOpen(true);
      return;
    }
    setWizardChannel(ch);
    setWizardOpen(true);
  }

  function handleViewDetail(ch: ChannelViewModel) {
    setDetailChannel(ch);
    setDetailOpen(true);
  }

  const omniQuery = trpc.omni.listChannels.useQuery(undefined, {
    enabled:   canOmni,
    staleTime: 60_000,
    retry:     1,
  });

  const intgQuery = trpc.settings.integrations.list.useQuery(undefined, {
    enabled:   isOwner,
    staleTime: 60_000,
    retry:     1,
  });

  const isLoading  = omniQuery.isLoading || (isOwner && intgQuery.isLoading);
  const hasOmniErr = omniQuery.isError;

  const channels = React.useMemo(() => {
    if (isLoading || hasOmniErr) return [];
    const omniChannels = (omniQuery.data?.channels ?? []) as OmniChannelData[];
    const integrations = isOwner
      ? ((intgQuery.data as IntegrationData[] | undefined) ?? [])
      : [];
    return buildChannelViewModels(omniChannels, integrations);
  }, [omniQuery.data, intgQuery.data, isLoading, hasOmniErr, isOwner]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <ChannelConnectionWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initialChannel={wizardChannel}
      />

      {detailChannel && (
        <ChannelDetailView
          open={detailOpen}
          onOpenChange={setDetailOpen}
          channel={detailChannel}
          isOwner={isOwner}
        />
      )}

      {/* Sub-navigation */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          borderBottom: `1px solid ${T.divider}`,
          marginBottom: 24,
        }}
      >
        {SUB_NAV.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              disabled={!item.available}
              onClick={() => item.available && setActive(item.id)}
              style={{
                padding: '10px 18px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive
                  ? `2px solid ${T.primary}`
                  : '2px solid transparent',
                color: isActive
                  ? T.primary
                  : item.available
                    ? T.textSecondary
                    : T.textMuted,
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                fontFamily: "'IBM Plex Sans', sans-serif",
                cursor: item.available ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
                marginBottom: -1,
              }}
            >
              {item.label}
              {!item.available && (
                <Mono size={9} color={T.textMuted}>EM BREVE</Mono>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {active === 'canais' && (
        <CanaisContent
          channels={channels}
          isLoading={isLoading}
          hasError={hasOmniErr}
          isOwner={isOwner}
          canOmni={canOmni}
          onRetry={() => omniQuery.refetch()}
          errorMessage={omniQuery.error?.message}
          onConnect={isOwner ? handleConnect : undefined}
          onViewDetail={handleViewDetail}
        />
      )}

      {active === 'webhooks' && (
        <WebhooksOverview channels={channels} isLoading={isLoading} />
      )}

      {active === 'lgpd' && (
        <LgpdOverview channels={channels} isLoading={isLoading} isOwner={isOwner} />
      )}

      {active === 'logs' && (
        <LogsOverview channels={channels} isLoading={isLoading} />
      )}
    </div>
  );
}

// ── Canais content ─────────────────────────────────────────────────

interface CanaisContentProps {
  channels: ReturnType<typeof buildChannelViewModels>;
  isLoading: boolean;
  hasError: boolean;
  isOwner: boolean;
  canOmni: boolean;
  onRetry: () => void;
  errorMessage?: string;
  onConnect?: (ch: ChannelViewModel) => void;
  onViewDetail?: (ch: ChannelViewModel) => void;
}

function CanaisContent({
  channels,
  isLoading,
  hasError,
  isOwner,
  canOmni,
  onRetry,
  errorMessage,
  onConnect,
  onViewDetail,
}: CanaisContentProps) {
  if (!canOmni) {
    return (
      <ErrorState
        label="ACESSO RESTRITO"
        icon="shield"
        title="Sem permissão para ver canais"
        description="Você precisa da permissão omni.read para visualizar os canais de comunicação."
      />
    );
  }

  if (hasError) {
    return (
      <ErrorState
        title="Erro ao carregar canais"
        description={errorMessage ?? 'Não foi possível buscar os canais. Tente novamente.'}
        action={
          <Btn small variant="glass" icon="zap" onClick={onRetry}>
            Tentar novamente
          </Btn>
        }
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <IntegrationHealthPanel channels={channels} isLoading={isLoading} />

      {!isOwner && !isLoading && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: T.r.md,
            background: T.primaryBg,
            border: `1px solid ${T.primaryBorder}`,
            fontSize: 13,
            color: T.primary,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Ico name="lock" size={13} color={T.primary} />
          Somente o proprietário da clínica pode conectar ou configurar canais.
        </div>
      )}

      {isLoading ? (
        <ChannelGridSkeleton />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 14,
          }}
        >
          {channels.map((ch) => (
            <div key={ch.type} style={{ cursor: 'pointer' }} onClick={() => onViewDetail?.(ch)}>
              <ChannelCard channel={ch} onConnect={onConnect} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Webhooks overview ──────────────────────────────────────────────

function WebhooksOverview({ channels, isLoading }: { channels: ChannelViewModel[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={64} delay={i * 60} />
        ))}
      </div>
    );
  }

  const connectedChannels = channels.filter((c) => c.status === 'connected' || c.status === 'error');

  if (connectedChannels.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <Ico name="zap" size={32} color={T.textMuted} />
        <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, marginTop: 12 }}>
          Nenhum webhook configurado
        </p>
        <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 4 }}>
          Conecte um canal primeiro para configurar webhooks.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
        Webhooks por Canal
      </p>
      <p style={{ fontSize: 13, color: T.textSecondary }}>
        Visão geral das URLs de callback e status dos webhooks de cada canal conectado.
      </p>

      {connectedChannels.map((ch) => {
        const callbackUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://app.elosmed.com'}/api/webhooks/${ch.type}`;
        const hasError = ch.status === 'error';

        return (
          <div
            key={ch.type}
            style={{
              padding: '14px 18px',
              borderRadius: T.r.lg,
              background: hasError ? T.dangerBg : T.glass,
              border: `1px solid ${hasError ? T.dangerBorder : T.glassBorder}`,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 36, height: 36, borderRadius: T.r.md,
                background: hasError ? T.dangerBg : T.primaryBg,
                border: `1px solid ${hasError ? T.dangerBorder : T.primaryBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Ico name="zap" size={16} color={hasError ? T.danger : T.primary} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                  {ch.label}
                </span>
                {hasError ? (
                  <span style={{ fontSize: 11, color: T.danger, fontWeight: 500 }}>Webhook falhando</span>
                ) : (
                  <span style={{ fontSize: 11, color: T.success, fontWeight: 500 }}>Ativo</span>
                )}
              </div>
              <Mono size={10} color={T.textMuted} style={{ marginTop: 2 }}>
                {callbackUrl}
              </Mono>
            </div>

            {hasError && (
              <Btn small variant="danger" icon="zap">
                Corrigir
              </Btn>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── LGPD overview ─────────────────────────────────────────────────

function LgpdOverview({ channels, isLoading, isOwner }: { channels: ChannelViewModel[]; isLoading: boolean; isOwner: boolean }) {
  const [selectedChannel, setSelectedChannel] = React.useState<ChannelType | null>(null);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={64} delay={i * 60} />
        ))}
      </div>
    );
  }

  const mockConsent: ChannelConsentConfig = {
    optInEnabled: true,
    optInMessage: 'Deseja receber comunicações da clínica por este canal?',
    optOutEnabled: true,
    optOutKeywords: ['SAIR', 'PARAR', 'CANCELAR', 'STOP'],
    retentionDays: 730,
    allowedHoursStart: '08:00',
    allowedHoursEnd: '20:00',
    blockSensitiveData: true,
    sensitiveDataPolicy: 'block',
    auditEnabled: true,
    auditRetentionDays: 1825,
    consentRequired: true,
    consentCollectedAt: new Date(Date.now() - 86_400_000 * 30),
    consentExpiresAt: new Date(Date.now() + 86_400_000 * 335),
    lastAuditAt: new Date(Date.now() - 3_600_000 * 2),
  };

  if (selectedChannel) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Btn small variant="ghost" icon="arrowLeft" onClick={() => setSelectedChannel(null)}>
          Voltar para canais
        </Btn>
        <ConsentAndCompliancePanel channel={selectedChannel} config={mockConsent} isOwner={isOwner} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
          LGPD e Conformidade por Canal
        </p>
        <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>
          Configure consentimento, retenção e políticas de privacidade individualmente para cada canal.
        </p>
      </div>

      <div
        style={{
          padding: '10px 14px',
          borderRadius: T.r.md,
          background: T.primaryBg,
          border: `1px solid ${T.primaryBorder}`,
          fontSize: 12,
          color: T.primary,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <Ico name="shield" size={14} color={T.primary} style={{ marginTop: 1, flexShrink: 0 }} />
        <div>
          Conforme <strong>LGPD (Lei 13.709/2018)</strong> e <strong>Resolução CFM 2.314/2022</strong>,
          cada canal de comunicação deve ter configurações de privacidade individuais.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {channels.map((ch) => {
          const isConnected = ch.status === 'connected';
          return (
            <button
              key={ch.type}
              type="button"
              onClick={() => setSelectedChannel(ch.type)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                borderRadius: T.r.lg,
                background: T.glass,
                border: `1px solid ${T.glassBorder}`,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
                width: '100%',
              }}
            >
              <div
                style={{
                  width: 36, height: 36, borderRadius: T.r.md,
                  background: isConnected ? T.successBg : T.glass,
                  border: `1px solid ${isConnected ? T.successBorder : T.divider}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Ico name="shield" size={16} color={isConnected ? T.success : T.textMuted} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                  {ch.label}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <Mono size={10} color={isConnected ? T.success : T.textMuted}>
                    {isConnected ? 'Opt-in ativo · Retenção: 730d' : 'Canal não conectado'}
                  </Mono>
                </div>
              </div>

              <Ico name="arrowRight" size={16} color={T.textMuted} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Logs overview ──────────────────────────────────────────────────

function LogsOverview({ channels, isLoading }: { channels: ChannelViewModel[]; isLoading: boolean }) {
  const mockLogs = React.useMemo<IntegrationLogEntry[]>(() => {
    if (isLoading) return [];
    const now = Date.now();
    const channelTypes: ChannelType[] = ['whatsapp', 'instagram', 'email', 'sms', 'webchat', 'phone'];
    const events = ['message.sent', 'message.received', 'status.delivered', 'status.read', 'webhook.received', 'template.sent', 'error.timeout', 'error.auth'];
    const statuses: Array<'success' | 'error' | 'pending' | 'retrying'> = ['success', 'success', 'success', 'success', 'error', 'pending', 'retrying'];
    const providers: Record<string, string> = {
      whatsapp: 'Meta Cloud API', instagram: 'Meta Graph API', email: 'SendGrid',
      sms: 'Twilio', webchat: 'Widget ElosMed', phone: 'Twilio Voice',
    };

    return Array.from({ length: 40 }, (_, i): IntegrationLogEntry => {
      const ch = channelTypes[i % channelTypes.length]!;
      const status = statuses[i % statuses.length]!;
      const isError = status === 'error';
      return {
        id: `log-${i}`,
        timestamp: new Date(now - i * 600_000 * (1 + Math.random())),
        channel: ch,
        event: events[i % events.length]!,
        direction: i % 3 === 0 ? 'inbound' : 'outbound',
        status,
        provider: providers[ch] ?? ch,
        entityType: i % 2 === 0 ? 'Consulta' : i % 3 === 0 ? 'Paciente' : undefined,
        entityId: i % 2 === 0 ? `c-${(1000 + i).toString(36)}` : undefined,
        errorSummary: isError ? (i % 2 === 0 ? 'Token expirado — renovar credenciais no painel do provedor.' : 'Timeout na conexão com API do provedor (>30s).') : undefined,
        canReprocess: isError,
      };
    });
  }, [isLoading]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
          Logs de Integração
        </p>
        <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>
          Registro de todas as interações, erros e eventos de todos os canais de comunicação.
        </p>
      </div>

      <IntegrationLogsTable
        logs={mockLogs}
        isLoading={isLoading}
      />
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────

function ChannelGridSkeleton() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 14,
      }}
    >
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} height={180} radius={12} delay={i * 60} />
      ))}
    </div>
  );
}
