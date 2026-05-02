/**
 * Local typed adapter for the Canais (Channels) section.
 *
 * The backend exposes two relevant data sources:
 *   - trpc.omni.listChannels  → omni.channels rows (whatsapp | instagram | email | sms | webchat | phone)
 *   - trpc.settings.integrations.list → credential/webhook status per channel (owner-only)
 *
 * Facebook Messenger and Custom channel have no backend counterpart yet.
 * TODO: Add facebook + custom to omni.channels schema when provider integrations ship.
 */

export type ChannelStatus = 'connected' | 'disconnected' | 'pending' | 'error' | 'sandbox' | 'inactive';

export type ChannelType =
  | 'whatsapp'
  | 'instagram'
  | 'facebook'
  | 'email'
  | 'sms'
  | 'phone'
  | 'webchat'
  | 'custom';

/** Channel types that exist in the omni.channels DB schema. */
export type OmniChannelType = 'whatsapp' | 'instagram' | 'email' | 'sms' | 'webchat' | 'phone';

/** Channel types that exist in the settings.integrations table (legacy, owner-only). */
export type SettingsChannelType = 'whatsapp' | 'instagram' | 'telegram' | 'email';

export interface ChannelDefinition {
  type: ChannelType;
  label: string;
  description: string;
  provider: string;
  category: 'social' | 'messaging' | 'email' | 'voice' | 'web' | 'custom';
  /** Matching key in omni.channels — null means not in backend yet. */
  omniType: OmniChannelType | null;
}

export interface OmniChannelData {
  id: string;
  type: OmniChannelType;
  name: string;
  isActive: boolean;
}

export interface IntegrationData {
  channel: SettingsChannelType;
  isActive: boolean;
  tokenPreview?: string | null;
  lastVerifiedAt?: string | null;
  lastError?: string | null;
}

export interface ChannelViewModel {
  type: ChannelType;
  label: string;
  description: string;
  provider: string;
  category: ChannelDefinition['category'];
  status: ChannelStatus;
  lastSyncAt: Date | null;
  lastError: string | null;
  tokenPreview: string | null;
  omniChannelId: string | null;
  /** False for facebook and custom — no backend schema counterpart yet. */
  isBackendSupported: boolean;
}

export const CHANNEL_DEFINITIONS: ChannelDefinition[] = [
  {
    type: 'whatsapp',
    label: 'WhatsApp Business',
    description: 'Envio de mensagens, confirmações de consulta e comunicação com pacientes via API oficial.',
    provider: 'Meta Cloud API',
    category: 'messaging',
    omniType: 'whatsapp',
  },
  {
    type: 'instagram',
    label: 'Instagram Direct',
    description: 'Recebimento de mensagens e interações via Instagram Direct através da Graph API.',
    provider: 'Meta Graph API',
    category: 'social',
    omniType: 'instagram',
  },
  {
    type: 'facebook',
    label: 'Facebook Messenger',
    description: 'Atendimento a pacientes e leads pelo Messenger, integrado ao inbox omnicanal.',
    provider: 'Meta Messenger API',
    category: 'social',
    // TODO: Add 'facebook' type to omni.channels schema when Meta provider integration ships.
    omniType: null,
  },
  {
    type: 'email',
    label: 'Email',
    description: 'Envio de e-mails transacionais, lembretes de consulta e notificações via SMTP/SendGrid.',
    provider: 'SMTP / SendGrid',
    category: 'email',
    omniType: 'email',
  },
  {
    type: 'sms',
    label: 'SMS',
    description: 'Envio de alertas e confirmações por SMS para o celular do paciente.',
    provider: 'Twilio / Zenvia',
    category: 'messaging',
    omniType: 'sms',
  },
  {
    type: 'phone',
    label: 'Telefone / Voz',
    description: 'Atendimento por chamadas de voz com gravação, transferência e URA inteligente.',
    provider: 'Twilio Voice',
    category: 'voice',
    omniType: 'phone',
  },
  {
    type: 'webchat',
    label: 'Webchat',
    description: 'Widget de chat embutido no site ou portal do paciente, com suporte a IA.',
    provider: 'Widget Nativo ElosMed',
    category: 'web',
    omniType: 'webchat',
  },
  {
    type: 'custom',
    label: 'Canal Customizado',
    description: 'Integração via webhook genérico para canais próprios ou sistemas legados.',
    provider: 'Webhook / API REST',
    category: 'custom',
    // TODO: Add 'custom' type to omni.channels schema when generic webhook provider ships.
    omniType: null,
  },
];

function resolveStatus(
  def: ChannelDefinition,
  omniChannel: OmniChannelData | undefined,
  intgRow: IntegrationData | undefined,
): ChannelStatus {
  if (!def.omniType) return 'disconnected';
  if (intgRow?.lastError) return 'error';
  if (omniChannel?.isActive) return 'connected';
  if (intgRow?.tokenPreview) return 'pending';
  if (omniChannel && !omniChannel.isActive) return 'inactive';
  return 'disconnected';
}

export function buildChannelViewModels(
  omniChannels: OmniChannelData[],
  integrations: IntegrationData[],
): ChannelViewModel[] {
  return CHANNEL_DEFINITIONS.map((def) => {
    const omniChannel = omniChannels.find((ch) => ch.type === def.omniType);
    const intgRow = integrations.find(
      (i) => (i.channel as string) === def.type,
    ) as IntegrationData | undefined;

    const status = resolveStatus(def, omniChannel, intgRow);

    return {
      type: def.type,
      label: def.label,
      description: def.description,
      provider: def.provider,
      category: def.category,
      status,
      lastSyncAt: intgRow?.lastVerifiedAt ? new Date(intgRow.lastVerifiedAt) : null,
      lastError: intgRow?.lastError ?? null,
      tokenPreview: intgRow?.tokenPreview ?? null,
      omniChannelId: omniChannel?.id ?? null,
      isBackendSupported: def.omniType !== null,
    };
  });
}

export const STATUS_LABEL: Record<ChannelStatus, string> = {
  connected:    'Conectado',
  disconnected: 'Não conectado',
  pending:      'Pendente',
  error:        'Erro',
  sandbox:      'Sandbox',
  inactive:     'Desativado',
};

export const ACTION_LABEL: Record<ChannelStatus, string> = {
  connected:    'Gerenciar',
  disconnected: 'Conectar',
  pending:      'Continuar configuração',
  error:        'Corrigir',
  sandbox:      'Ver sandbox',
  inactive:     'Ativar',
};
