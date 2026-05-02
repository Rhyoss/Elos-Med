'use client';

import * as React from 'react';
import { PageHero, Skeleton, EmptyState, ErrorState, Btn, Ico } from '@dermaos/ui/ds';
import { T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { useAuth, usePermission } from '@/lib/auth';
import { ChannelCard } from '../_components/ChannelCard';
import { ChannelConnectionWizard } from '../_components/ChannelConnectionWizard';
import { IntegrationHealthPanel } from '../_components/IntegrationHealthPanel';
import {
  buildChannelViewModels,
  type ChannelViewModel,
  type OmniChannelData,
  type IntegrationData,
} from '../_lib/channel-adapter';

export default function CanaisPage() {
  const { user } = useAuth();
  const canOmni  = usePermission('omni', 'read');
  const isOwner  = user?.role === 'owner';

  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [wizardChannel, setWizardChannel] = React.useState<ChannelViewModel | undefined>();

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

  if (!canOmni) {
    return (
      <div style={{ padding: '32px 0' }}>
        <ErrorState
          label="ACESSO RESTRITO"
          icon="shield"
          title="Sem permissão para ver canais"
          description="Você precisa da permissão omni.read para visualizar os canais de comunicação configurados na clínica."
        />
      </div>
    );
  }

  if (hasOmniErr) {
    return (
      <div style={{ padding: '32px 0' }}>
        <ErrorState
          title="Erro ao carregar canais"
          description={
            omniQuery.error?.message ?? 'Não foi possível buscar os canais. Tente novamente.'
          }
          action={
            <Btn small variant="glass" icon="zap" onClick={() => omniQuery.refetch()}>
              Tentar novamente
            </Btn>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ChannelConnectionWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initialChannel={wizardChannel}
      />

      <PageHero
        eyebrow="INTEGRAÇÕES / CANAIS"
        title="Canais de Comunicação"
        icon="message"
        description="Conecte os canais pelos quais a clínica recebe e envia mensagens com pacientes."
      />

      <IntegrationHealthPanel channels={channels} isLoading={isLoading} />

      {!isOwner && (
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
      ) : channels.length === 0 ? (
        <EmptyState
          label="NENHUM CANAL"
          icon="message"
          title="Nenhum canal configurado"
          description="Os canais de comunicação aparecerão aqui após serem ativados pelo proprietário da clínica."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 14,
          }}
        >
          {channels.map((ch) => (
            <ChannelCard
              key={ch.type}
              channel={ch}
              onConnect={isOwner ? handleConnect : undefined}
            />
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
