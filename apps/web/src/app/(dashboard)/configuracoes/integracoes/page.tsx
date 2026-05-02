'use client';

import * as React from 'react';
import { Mono, Ico, Btn, Skeleton, ErrorState } from '@dermaos/ui/ds';
import { T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { useAuth, usePermission } from '@/lib/auth';
import { ChannelCard } from './_components/ChannelCard';
import { ChannelConnectionWizard } from './_components/ChannelConnectionWizard';
import { IntegrationHealthPanel } from './_components/IntegrationHealthPanel';
import {
  buildChannelViewModels,
  type ChannelViewModel,
  type OmniChannelData,
  type IntegrationData,
} from './_lib/channel-adapter';

type SubSection = 'canais' | 'webhooks' | 'logs';

interface SubNavItem {
  id: SubSection;
  label: string;
  available: boolean;
}

const SUB_NAV: SubNavItem[] = [
  { id: 'canais',   label: 'Canais',    available: true  },
  { id: 'webhooks', label: 'Webhooks',  available: false },
  { id: 'logs',     label: 'Logs',      available: false },
];

export default function IntegracoesPage() {
  const [active, setActive] = React.useState<SubSection>('canais');
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [wizardChannel, setWizardChannel] = React.useState<ChannelViewModel | undefined>();

  const { user } = useAuth();
  const canOmni  = usePermission('omni', 'read');
  const isOwner  = user?.role === 'owner';

  function handleConnect(ch: ChannelViewModel) {
    if (!isOwner) return;
    setWizardChannel(ch);
    setWizardOpen(true);
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
        />
      )}
    </div>
  );
}

interface CanaisContentProps {
  channels: ReturnType<typeof buildChannelViewModels>;
  isLoading: boolean;
  hasError: boolean;
  isOwner: boolean;
  canOmni: boolean;
  onRetry: () => void;
  errorMessage?: string;
  onConnect?: (ch: ChannelViewModel) => void;
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
            <ChannelCard key={ch.type} channel={ch} onConnect={onConnect} />
          ))}
        </div>
      )}
    </div>
  );
}

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
