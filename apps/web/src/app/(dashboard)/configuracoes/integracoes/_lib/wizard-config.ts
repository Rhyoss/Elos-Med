/**
 * Data-driven channel wizard configuration.
 *
 * Each channel declares its supported connection methods, credential fields,
 * webhook options, and routing capabilities. The wizard reads this config
 * to render dynamic forms — no channel-specific logic in the wizard itself.
 */

import type { ChannelType } from './channel-adapter';
import type { IcoName } from '@dermaos/ui/ds';

// ── Connection method types ─────────────────────────────────────────

export type ConnectionMethodId =
  | 'oauth_meta'
  | 'oauth_google'
  | 'oauth_microsoft'
  | 'embedded_signup'
  | 'manual_config'
  | 'external_bsp'
  | 'manual_link'
  | 'custom_webhook';

export interface ConnectionMethod {
  id: ConnectionMethodId;
  label: string;
  description: string;
  icon: IcoName;
  recommended?: boolean;
  requiresBackend?: boolean;
}

// ── Credential field definition ─────────────────────────────────────

export interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'textarea';
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  options?: { value: string; label: string }[];
  masked?: boolean;
}

// ── Webhook config ──────────────────────────────────────────────────

export interface WebhookConfig {
  supportsWebhook: boolean;
  callbackUrlTemplate?: string;
  verifyTokenRequired?: boolean;
  eventsAvailable?: { key: string; label: string; description: string }[];
}

// ── Routing config ──────────────────────────────────────────────────

export interface RoutingConfig {
  supportsRouting: boolean;
  routingOptions?: {
    key: string;
    label: string;
    description: string;
    type: 'toggle' | 'select';
    options?: { value: string; label: string }[];
  }[];
}

// ── Full channel wizard config ──────────────────────────────────────

export interface ChannelWizardConfig {
  channelType: ChannelType;
  label: string;
  icon: IcoName;
  connectionMethods: ConnectionMethod[];
  credentialFields: Record<ConnectionMethodId, CredentialField[]>;
  webhook: WebhookConfig;
  routing: RoutingConfig;
  testEndpoint?: string;
}

// ── Wizard state ────────────────────────────────────────────────────

export type WizardStatus = 'draft' | 'validating' | 'error' | 'ready' | 'activated';

export interface WizardStepDef {
  id: WizardStepId;
  label: string;
  description: string;
  icon: IcoName;
}

export type WizardStepId =
  | 'channel'
  | 'method'
  | 'credentials'
  | 'webhook'
  | 'routing'
  | 'test'
  | 'activation';

export const WIZARD_STEPS: WizardStepDef[] = [
  { id: 'channel',     label: 'Canal',         description: 'Selecione o canal de comunicação',    icon: 'message' },
  { id: 'method',      label: 'Método',        description: 'Escolha como conectar',               icon: 'link' },
  { id: 'credentials', label: 'Credenciais',   description: 'Insira as credenciais de acesso',     icon: 'lock' },
  { id: 'webhook',     label: 'Webhook',       description: 'Configure os callbacks e eventos',    icon: 'zap' },
  { id: 'routing',     label: 'Roteamento',    description: 'Defina regras de distribuição',       icon: 'layers' },
  { id: 'test',        label: 'Teste',         description: 'Valide a conexão com o provedor',     icon: 'activity' },
  { id: 'activation',  label: 'Ativação',      description: 'Revise e ative o canal',              icon: 'check' },
];

// ── Empty credential fields for unused methods ─────────────────────

const EMPTY_CREDS: Record<ConnectionMethodId, CredentialField[]> = {
  oauth_meta: [],
  oauth_google: [],
  oauth_microsoft: [],
  embedded_signup: [],
  manual_config: [],
  external_bsp: [],
  manual_link: [],
  custom_webhook: [],
};

// ── Shared connection methods ───────────────────────────────────────

const METHOD_OAUTH_META: ConnectionMethod = {
  id: 'oauth_meta',
  label: 'OAuth / Meta Login',
  description: 'Autenticação via Meta Business Login com permissões granulares.',
  icon: 'shield',
  recommended: true,
};

const METHOD_OAUTH_GOOGLE: ConnectionMethod = {
  id: 'oauth_google',
  label: 'Google Workspace / Gmail',
  description: 'Conecte via OAuth 2.0 com conta Google Workspace ou Gmail. Envio e recebimento automáticos.',
  icon: 'mail',
  recommended: true,
  requiresBackend: true,
};

const METHOD_OAUTH_MICROSOFT: ConnectionMethod = {
  id: 'oauth_microsoft',
  label: 'Microsoft 365 / Outlook',
  description: 'Conecte via OAuth 2.0 com conta Microsoft 365 ou Outlook. Envio e recebimento automáticos.',
  icon: 'mail',
  requiresBackend: true,
};

const METHOD_EMBEDDED_SIGNUP: ConnectionMethod = {
  id: 'embedded_signup',
  label: 'Embedded Signup',
  description: 'Registro simplificado incorporado ao fluxo da clínica.',
  icon: 'user',
};

const METHOD_MANUAL: ConnectionMethod = {
  id: 'manual_config',
  label: 'Configuração Manual',
  description: 'Insira manualmente as credenciais da API do provedor.',
  icon: 'edit',
};

const METHOD_BSP: ConnectionMethod = {
  id: 'external_bsp',
  label: 'Provedor Externo (BSP)',
  description: 'Conecte via um Business Solution Provider já configurado.',
  icon: 'globe',
};

const METHOD_LINK: ConnectionMethod = {
  id: 'manual_link',
  label: 'Link / Manual sem API',
  description: 'Configuração sem API — link de redirecionamento ou setup manual.',
  icon: 'link',
};

const METHOD_CUSTOM_WEBHOOK: ConnectionMethod = {
  id: 'custom_webhook',
  label: 'Custom API / Webhook',
  description: 'Integração genérica via webhook e API REST customizada.',
  icon: 'zap',
};

// ── WhatsApp ───────────────────────────────────────────────────────

const WHATSAPP_CONFIG: ChannelWizardConfig = {
  channelType: 'whatsapp',
  label: 'WhatsApp Business',
  icon: 'message',
  connectionMethods: [
    {
      ...METHOD_EMBEDDED_SIGNUP,
      label: 'Meta WhatsApp Cloud API — Embedded Signup',
      description: 'Método recomendado. Conecte sua conta Meta Business com um clique e configure tudo automaticamente.',
      icon: 'shield',
      recommended: true,
    },
    {
      ...METHOD_MANUAL,
      label: 'Cloud API — Configuração Manual',
      description: 'Insira manualmente os IDs e tokens da Cloud API do WhatsApp Business.',
      icon: 'edit',
    },
    {
      ...METHOD_BSP,
      label: 'Provedor / BSP',
      description: 'Conecte via um Business Solution Provider (Twilio, Zenvia, 360dialog, Gupshup, etc.).',
      icon: 'globe',
    },
    {
      ...METHOD_LINK,
      label: 'Link manual (sem API)',
      description: 'Apenas abre o WhatsApp no navegador do paciente. Sem inbox integrada.',
      icon: 'link',
    },
  ],
  credentialFields: {
    ...EMPTY_CREDS,
    manual_config: [
      { key: 'channel_name', label: 'Nome interno do canal', type: 'text', placeholder: 'Ex: WhatsApp Clínica Centro', required: true, helpText: 'Nome para identificação interna no ElosMed.' },
      { key: 'waba_id', label: 'WABA ID', type: 'text', placeholder: 'Ex: 100200300400500', required: true, helpText: 'WhatsApp Business Account ID — encontrado no Meta Business Manager.' },
      { key: 'phone_number_id', label: 'Phone Number ID', type: 'text', placeholder: 'Ex: 100200300400500', required: true, helpText: 'ID do número registrado na Cloud API.' },
      { key: 'business_account_id', label: 'Business Account ID', type: 'text', placeholder: 'Ex: 123456789012345', required: true, helpText: 'ID da conta de negócios Meta.' },
      { key: 'access_token', label: 'Access Token (permanente)', type: 'password', placeholder: 'Token gerado no Meta for Developers', required: true, masked: true, helpText: 'Token com permissão whatsapp_business_messaging.' },
      { key: 'app_id', label: 'App ID', type: 'text', placeholder: 'Ex: 123456789012345', required: true, helpText: 'ID do app Meta associado.' },
      { key: 'verify_token', label: 'Verify Token', type: 'text', placeholder: 'Token para validação do webhook', required: true, helpText: 'Você define este valor. Use algo aleatório e seguro.' },
      { key: 'environment', label: 'Ambiente', type: 'select', required: true, options: [
        { value: 'production', label: 'Produção' },
        { value: 'sandbox', label: 'Sandbox / Teste' },
      ], helpText: 'Sandbox permite testar sem enviar mensagens reais.' },
      { key: 'display_phone', label: 'Número exibido', type: 'text', placeholder: '+55 11 99999-0000', required: true, helpText: 'Número de WhatsApp verificado que aparece para os pacientes.' },
      { key: 'default_queue', label: 'Unidade / Fila padrão', type: 'select', options: [
        { value: 'reception', label: 'Recepção' },
        { value: 'clinical', label: 'Equipe Clínica' },
        { value: 'financial', label: 'Financeiro' },
      ], helpText: 'Fila que recebe novas conversas por padrão.' },
    ],
    external_bsp: [
      { key: 'bsp_provider', label: 'Provedor (BSP)', type: 'select', required: true, options: [
        { value: 'twilio', label: 'Twilio' },
        { value: 'zenvia', label: 'Zenvia' },
        { value: '360dialog', label: '360dialog' },
        { value: 'gupshup', label: 'Gupshup' },
        { value: 'take_blip', label: 'Take Blip' },
        { value: 'wati', label: 'WATI' },
        { value: 'custom', label: 'Custom / Outro' },
      ], helpText: 'Selecione o BSP que gerencia sua conta WhatsApp.' },
      { key: 'bsp_api_key', label: 'API Key', type: 'password', placeholder: '••••••••••••', required: true, masked: true },
      { key: 'bsp_api_secret', label: 'API Secret', type: 'password', placeholder: '••••••••••••', masked: true, helpText: 'Nem todos os provedores exigem secret separado.' },
      { key: 'bsp_sender_phone', label: 'Sender / Número do WhatsApp', type: 'text', placeholder: '+55 11 99999-0000', required: true, helpText: 'Número registrado no provedor.' },
      { key: 'bsp_webhook_secret', label: 'Webhook Secret', type: 'password', placeholder: '••••••••••••', masked: true, helpText: 'Secret para validar assinatura dos webhooks do BSP.' },
      { key: 'bsp_base_url', label: 'Base URL (se custom)', type: 'text', placeholder: 'https://api.seuprovedor.com/v1', helpText: 'Obrigatório apenas para provedor Custom / Outro.' },
      { key: 'bsp_default_queue', label: 'Fila padrão', type: 'select', options: [
        { value: 'reception', label: 'Recepção' },
        { value: 'clinical', label: 'Equipe Clínica' },
        { value: 'financial', label: 'Financeiro' },
      ], helpText: 'Fila que recebe novas conversas por padrão.' },
    ],
    manual_link: [
      { key: 'link_phone', label: 'Número do WhatsApp', type: 'text', placeholder: '+55 11 99999-0000', required: true, helpText: 'Número que será aberto via wa.me/.' },
      { key: 'link_default_message', label: 'Mensagem padrão', type: 'textarea', placeholder: 'Olá! Gostaria de agendar uma consulta.', helpText: 'Texto pré-preenchido ao abrir o link wa.me.' },
    ],
  },
  webhook: {
    supportsWebhook: true,
    callbackUrlTemplate: '/api/webhooks/whatsapp',
    verifyTokenRequired: true,
    eventsAvailable: [
      { key: 'messages', label: 'Mensagens', description: 'Mensagens recebidas e status de entrega' },
      { key: 'statuses', label: 'Status', description: 'Mudanças de status (enviado, entregue, lido)' },
      { key: 'errors', label: 'Erros', description: 'Erros de entrega e falhas de template' },
    ],
  },
  routing: {
    supportsRouting: true,
    routingOptions: [
      { key: 'auto_reply', label: 'Resposta automática', description: 'Aurora IA responde automaticamente fora do horário', type: 'toggle' },
      { key: 'assign_team', label: 'Equipe padrão', description: 'Equipe que recebe novas conversas', type: 'select', options: [
        { value: 'reception', label: 'Recepção' },
        { value: 'clinical', label: 'Equipe Clínica' },
        { value: 'financial', label: 'Financeiro' },
      ]},
      { key: 'ai_triage', label: 'Triagem por IA', description: 'Aurora classifica e roteia conversas automaticamente', type: 'toggle' },
    ],
  },
  testEndpoint: '/api/integrations/whatsapp/test',
};

// ── Instagram ──────────────────────────────────────────────────────

const INSTAGRAM_CONFIG: ChannelWizardConfig = {
  channelType: 'instagram',
  label: 'Instagram Direct',
  icon: 'message',
  connectionMethods: [
    {
      ...METHOD_OAUTH_META,
      label: 'Conectar Instagram via Meta/OAuth',
      description: 'Autenticação via Meta Business Login. Selecione a conta profissional, configure permissões e webhook automaticamente.',
      icon: 'shield',
      recommended: true,
    },
    {
      ...METHOD_MANUAL,
      label: 'Configuração Manual',
      description: 'Insira manualmente os IDs, tokens e configurações da Instagram Messaging API.',
      icon: 'edit',
    },
    {
      ...METHOD_BSP,
      label: 'Provedor Externo / Custom',
      description: 'Conecte via um provedor externo que já gerencia sua conta Instagram.',
      icon: 'globe',
    },
  ],
  credentialFields: {
    ...EMPTY_CREDS,
    manual_config: [
      { key: 'ig_account_id', label: 'Instagram Account ID', type: 'text', placeholder: 'Ex: 17841400000000000', required: true, helpText: 'ID da conta profissional do Instagram — encontrado no Meta Business Suite.' },
      { key: 'page_id', label: 'Page ID vinculada', type: 'text', placeholder: 'Ex: 100200300400500', required: true, helpText: 'Página do Facebook vinculada à conta Instagram profissional.' },
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'Token de longa duração', required: true, masked: true, helpText: 'Token com permissões instagram_manage_messages e pages_messaging.' },
      { key: 'app_id', label: 'App ID', type: 'text', placeholder: 'Ex: 123456789012345', required: true, helpText: 'ID do aplicativo Meta associado.' },
      { key: 'verify_token', label: 'Verify Token', type: 'text', placeholder: 'Token para validação do webhook', required: true, helpText: 'Você define este valor. Use algo aleatório e seguro.' },
      { key: 'webhook_url', label: 'Webhook URL', type: 'text', placeholder: 'https://api.suaclinica.com/webhooks/instagram', required: true, helpText: 'URL registrada no Meta para receber eventos de mensagens.' },
      { key: 'environment', label: 'Ambiente', type: 'select', required: true, options: [
        { value: 'production', label: 'Produção' },
        { value: 'sandbox', label: 'Sandbox / Teste' },
      ], helpText: 'Sandbox permite testar sem interagir com usuários reais.' },
    ],
    external_bsp: [
      { key: 'bsp_provider', label: 'Provedor', type: 'select', required: true, options: [
        { value: 'manychat', label: 'ManyChat' },
        { value: 'chatfuel', label: 'Chatfuel' },
        { value: 'respond_io', label: 'Respond.io' },
        { value: 'custom', label: 'Custom / Outro' },
      ], helpText: 'Provedor que gerencia a integração Instagram da clínica.' },
      { key: 'bsp_api_key', label: 'API Key', type: 'password', placeholder: '••••••••••••', required: true, masked: true, helpText: 'Chave de API do provedor externo.' },
      { key: 'bsp_account_id', label: 'Account ID', type: 'text', placeholder: 'ID da conta no provedor', required: true, helpText: 'Identificador da sua conta no provedor externo.' },
      { key: 'bsp_webhook_secret', label: 'Webhook Secret', type: 'password', placeholder: '••••••••••••', masked: true, helpText: 'Secret para validar assinatura dos webhooks do provedor.' },
      { key: 'bsp_base_url', label: 'Base URL (se custom)', type: 'text', placeholder: 'https://api.seuprovedor.com/v1', helpText: 'Obrigatório apenas para provedor Custom / Outro.' },
    ],
  },
  webhook: {
    supportsWebhook: true,
    callbackUrlTemplate: '/api/webhooks/instagram',
    verifyTokenRequired: true,
    eventsAvailable: [
      { key: 'messages', label: 'Mensagens', description: 'DMs recebidos e enviados via Instagram Direct' },
      { key: 'message_reactions', label: 'Reações', description: 'Reações a mensagens no Direct' },
      { key: 'mentions', label: 'Menções', description: 'Menções em stories e posts' },
      { key: 'story_replies', label: 'Respostas a stories', description: 'Mensagens enviadas em resposta a stories' },
    ],
  },
  routing: {
    supportsRouting: true,
    routingOptions: [
      { key: 'auto_reply', label: 'Resposta automática', description: 'Mensagem padrão para DMs recebidos fora do horário', type: 'toggle' },
      { key: 'assign_team', label: 'Equipe padrão', description: 'Equipe que recebe novas conversas do Instagram', type: 'select', options: [
        { value: 'reception', label: 'Recepção' },
        { value: 'marketing', label: 'Marketing / Social' },
        { value: 'clinical', label: 'Equipe Clínica' },
      ]},
      { key: 'ai_triage', label: 'Triagem por IA', description: 'Aurora classifica e roteia DMs automaticamente', type: 'toggle' },
    ],
  },
  testEndpoint: '/api/integrations/instagram/test',
};

// ── Facebook ───────────────────────────────────────────────────────

const FACEBOOK_CONFIG: ChannelWizardConfig = {
  channelType: 'facebook',
  label: 'Facebook Messenger',
  icon: 'message',
  connectionMethods: [
    {
      ...METHOD_OAUTH_META,
      label: 'Conectar Página via Meta/OAuth',
      description: 'Autenticação via Meta Business Login. Selecione a página, assine webhooks e teste inbound/outbound automaticamente.',
      icon: 'shield',
      recommended: true,
    },
    {
      ...METHOD_MANUAL,
      label: 'Configuração Manual',
      description: 'Insira manualmente App ID, Page ID, Page Access Token e configure o webhook.',
      icon: 'edit',
    },
    {
      ...METHOD_BSP,
      label: 'Provedor Externo / Custom',
      description: 'Conecte via um provedor externo que já gerencia o Messenger da sua página.',
      icon: 'globe',
    },
  ],
  credentialFields: {
    ...EMPTY_CREDS,
    manual_config: [
      { key: 'app_id', label: 'App ID', type: 'text', placeholder: 'Ex: 123456789012345', required: true, helpText: 'ID do aplicativo Meta registrado no Meta for Developers.' },
      { key: 'page_id', label: 'Page ID', type: 'text', placeholder: 'Ex: 100200300400500', required: true, helpText: 'ID da página do Facebook vinculada ao Messenger.' },
      { key: 'page_access_token', label: 'Page Access Token', type: 'password', placeholder: 'Token de longa duração da página', required: true, masked: true, helpText: 'Token com permissão pages_messaging gerado para a página.' },
      { key: 'verify_token', label: 'Verify Token', type: 'text', placeholder: 'Token para validação do webhook', required: true, helpText: 'Você define este valor. Use algo aleatório e seguro.' },
      { key: 'webhook_url', label: 'Webhook URL', type: 'text', placeholder: 'https://api.suaclinica.com/webhooks/facebook', required: true, helpText: 'URL registrada no Meta para receber eventos do Messenger.' },
    ],
    external_bsp: [
      { key: 'bsp_provider', label: 'Provedor', type: 'select', required: true, options: [
        { value: 'manychat', label: 'ManyChat' },
        { value: 'chatfuel', label: 'Chatfuel' },
        { value: 'respond_io', label: 'Respond.io' },
        { value: 'take_blip', label: 'Take Blip' },
        { value: 'custom', label: 'Custom / Outro' },
      ], helpText: 'Provedor que gerencia a integração Messenger da clínica.' },
      { key: 'bsp_api_key', label: 'API Key', type: 'password', placeholder: '••••••••••••', required: true, masked: true, helpText: 'Chave de API do provedor externo.' },
      { key: 'bsp_account_id', label: 'Account ID', type: 'text', placeholder: 'ID da conta no provedor', required: true, helpText: 'Identificador da sua conta no provedor externo.' },
      { key: 'bsp_webhook_secret', label: 'Webhook Secret', type: 'password', placeholder: '••••••••••••', masked: true, helpText: 'Secret para validar assinatura dos webhooks do provedor.' },
      { key: 'bsp_base_url', label: 'Base URL (se custom)', type: 'text', placeholder: 'https://api.seuprovedor.com/v1', helpText: 'Obrigatório apenas para provedor Custom / Outro.' },
    ],
  },
  webhook: {
    supportsWebhook: true,
    callbackUrlTemplate: '/api/webhooks/facebook',
    verifyTokenRequired: true,
    eventsAvailable: [
      { key: 'messages', label: 'Mensagens', description: 'Mensagens recebidas e enviadas pelo Messenger' },
      { key: 'messaging_postbacks', label: 'Postbacks', description: 'Cliques em botões, quick replies e ações rápidas' },
      { key: 'messaging_optins', label: 'Opt-ins', description: 'Usuários que autorizaram receber mensagens' },
      { key: 'message_deliveries', label: 'Entregas', description: 'Confirmação de entrega e leitura de mensagens' },
    ],
  },
  routing: {
    supportsRouting: true,
    routingOptions: [
      { key: 'auto_reply', label: 'Resposta automática', description: 'Mensagem padrão fora do horário de atendimento', type: 'toggle' },
      { key: 'assign_team', label: 'Equipe padrão', description: 'Equipe que recebe novas conversas do Messenger', type: 'select', options: [
        { value: 'reception', label: 'Recepção' },
        { value: 'marketing', label: 'Marketing / Social' },
        { value: 'clinical', label: 'Equipe Clínica' },
      ]},
      { key: 'ai_triage', label: 'Triagem por IA', description: 'Aurora classifica e roteia conversas automaticamente', type: 'toggle' },
    ],
  },
  testEndpoint: '/api/integrations/facebook/test',
};

// ── Email ──────────────────────────────────────────────────────────

const EMAIL_CONFIG: ChannelWizardConfig = {
  channelType: 'email',
  label: 'Email',
  icon: 'mail',
  connectionMethods: [
    {
      ...METHOD_MANUAL,
      label: 'SMTP / IMAP — Configuração Manual',
      description: 'Configure servidor SMTP para envio e IMAP para recebimento de e-mails. Funciona com qualquer provedor.',
      icon: 'edit',
    },
    {
      ...METHOD_OAUTH_GOOGLE,
      label: 'Google Workspace / Gmail',
      description: 'Conecte via OAuth 2.0 com sua conta Google. Envio e recebimento configurados automaticamente via Gmail API.',
      icon: 'mail',
      recommended: true,
      requiresBackend: true,
    },
    {
      ...METHOD_OAUTH_MICROSOFT,
      label: 'Microsoft 365 / Outlook',
      description: 'Conecte via OAuth 2.0 com conta Microsoft 365 ou Outlook. Envio e recebimento via Microsoft Graph API.',
      icon: 'mail',
      requiresBackend: true,
    },
    {
      ...METHOD_BSP,
      label: 'Provedor Transacional',
      description: 'Use um serviço transacional (SendGrid, SES, Mailgun, Postmark) para envio de alta entrega.',
      icon: 'globe',
    },
  ],
  credentialFields: {
    ...EMPTY_CREDS,
    manual_config: [
      { key: 'channel_name', label: 'Nome do canal', type: 'text', placeholder: 'Ex: Email Principal', required: true, helpText: 'Nome interno para identificação no ElosMed.' },
      { key: 'from_email', label: 'Email remetente', type: 'text', placeholder: 'clinica@seudominio.com.br', required: true, helpText: 'Endereço que aparece como remetente nos e-mails enviados.' },
      { key: 'from_name', label: 'Nome remetente', type: 'text', placeholder: 'Clínica Dermatológica', helpText: 'Nome de exibição do remetente.' },
      { key: 'smtp_host', label: 'SMTP Host', type: 'text', placeholder: 'Ex: smtp.gmail.com', required: true, helpText: 'Servidor SMTP para envio de e-mails.' },
      { key: 'smtp_port', label: 'Porta SMTP', type: 'text', placeholder: 'Ex: 587', required: true, helpText: '587 (STARTTLS) ou 465 (SSL/TLS).' },
      { key: 'smtp_user', label: 'Usuário SMTP', type: 'text', placeholder: 'seu-email@dominio.com', required: true },
      { key: 'smtp_password', label: 'Senha SMTP', type: 'password', placeholder: '••••••••••••', required: true, masked: true, helpText: 'Senha ou App Password gerada pelo provedor.' },
      { key: 'smtp_encryption', label: 'Criptografia SMTP', type: 'select', required: true, options: [
        { value: 'starttls', label: 'STARTTLS (porta 587)' },
        { value: 'ssl', label: 'SSL/TLS (porta 465)' },
        { value: 'none', label: 'Nenhuma (não recomendado)' },
      ], helpText: 'STARTTLS é o padrão recomendado.' },
      { key: 'imap_host', label: 'IMAP Host', type: 'text', placeholder: 'Ex: imap.gmail.com', helpText: 'Servidor IMAP para recebimento. Deixe vazio se não quiser receber e-mails.' },
      { key: 'imap_port', label: 'Porta IMAP', type: 'text', placeholder: 'Ex: 993', helpText: '993 (SSL/TLS) ou 143 (STARTTLS).' },
      { key: 'imap_user', label: 'Usuário IMAP', type: 'text', placeholder: 'seu-email@dominio.com', helpText: 'Geralmente o mesmo do SMTP.' },
      { key: 'imap_password', label: 'Senha IMAP', type: 'password', placeholder: '••••••••••••', masked: true, helpText: 'Geralmente a mesma do SMTP.' },
    ],
    external_bsp: [
      { key: 'provider', label: 'Provedor Transacional', type: 'select', required: true, options: [
        { value: 'sendgrid', label: 'SendGrid' },
        { value: 'ses', label: 'Amazon SES' },
        { value: 'mailgun', label: 'Mailgun' },
        { value: 'postmark', label: 'Postmark' },
        { value: 'resend', label: 'Resend' },
        { value: 'custom', label: 'Custom / Outro' },
      ], helpText: 'Serviço de envio transacional de e-mails.' },
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: '••••••••••••', required: true, masked: true, helpText: 'Chave de API do provedor transacional.' },
      { key: 'from_email', label: 'Email remetente', type: 'text', placeholder: 'clinica@seudominio.com.br', required: true, helpText: 'Domínio deve estar verificado no provedor.' },
      { key: 'from_name', label: 'Nome remetente', type: 'text', placeholder: 'Clínica Dermatológica' },
      { key: 'custom_base_url', label: 'Base URL (se custom)', type: 'text', placeholder: 'https://api.seuprovedor.com/v1', helpText: 'Obrigatório apenas para provedor Custom.' },
      { key: 'custom_api_secret', label: 'API Secret (se custom)', type: 'password', placeholder: '••••••••••••', masked: true, helpText: 'Secret adicional, se exigido pelo provedor.' },
    ],
  },
  webhook: {
    supportsWebhook: true,
    callbackUrlTemplate: '/api/webhooks/email/inbound',
    eventsAvailable: [
      { key: 'inbound', label: 'Emails recebidos', description: 'Parseamento de emails recebidos via webhook' },
      { key: 'bounces', label: 'Bounces', description: 'Notificações de emails não entregues' },
      { key: 'complaints', label: 'Reclamações', description: 'Marcações de spam pelo destinatário' },
      { key: 'deliveries', label: 'Entregas', description: 'Confirmação de entrega bem-sucedida' },
    ],
  },
  routing: {
    supportsRouting: true,
    routingOptions: [
      { key: 'auto_reply', label: 'Auto-resposta', description: 'Confirmação automática de recebimento de e-mail', type: 'toggle' },
      { key: 'assign_team', label: 'Equipe padrão', description: 'Equipe responsável por emails', type: 'select', options: [
        { value: 'reception', label: 'Recepção' },
        { value: 'clinical', label: 'Equipe Clínica' },
        { value: 'financial', label: 'Financeiro' },
      ]},
      { key: 'ai_triage', label: 'Triagem por IA', description: 'Aurora classifica e-mails por assunto e roteia automaticamente', type: 'toggle' },
    ],
  },
  testEndpoint: '/api/integrations/email/test',
};

// ── SMS ────────────────────────────────────────────────────────────

const SMS_CONFIG: ChannelWizardConfig = {
  channelType: 'sms',
  label: 'SMS',
  icon: 'message',
  connectionMethods: [
    {
      ...METHOD_BSP,
      label: 'Provedor Externo',
      description: 'Conecte via Twilio, Zenvia ou outro provedor de SMS com conta já configurada.',
      icon: 'globe',
      recommended: true,
    },
    {
      ...METHOD_CUSTOM_WEBHOOK,
      label: 'Custom API / Webhook',
      description: 'Integração com gateway de SMS customizado via API REST e webhook.',
      icon: 'zap',
    },
  ],
  credentialFields: {
    ...EMPTY_CREDS,
    external_bsp: [
      { key: 'provider', label: 'Provedor SMS', type: 'select', required: true, options: [
        { value: 'twilio', label: 'Twilio' },
        { value: 'zenvia', label: 'Zenvia' },
        { value: 'custom', label: 'Custom / Outro' },
      ], helpText: 'Provedor que gerencia o envio e recebimento de SMS.' },
      { key: 'account_sid', label: 'Account SID / ID da Conta', type: 'text', placeholder: 'Ex: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', required: true, helpText: 'Identificador da conta no provedor. Twilio: Account SID. Zenvia: ID da conta.' },
      { key: 'auth_token', label: 'Auth Token / API Key', type: 'password', placeholder: '••••••••••••', required: true, masked: true, helpText: 'Token ou chave de autenticação do provedor.' },
      { key: 'phone_number', label: 'Número de envio', type: 'text', placeholder: '+55 11 99999-0000', required: true, helpText: 'Número ou short code registrado para envio de SMS.' },
      { key: 'sender_name', label: 'Nome do remetente (opcional)', type: 'text', placeholder: 'ELOSMED', helpText: 'Alphanumeric Sender ID, se suportado pelo provedor (nem todas as operadoras aceitam).' },
      { key: 'bsp_base_url', label: 'Base URL (se custom)', type: 'text', placeholder: 'https://api.seuprovedor.com/v1', helpText: 'Obrigatório apenas para provedor Custom / Outro.' },
    ],
    custom_webhook: [
      { key: 'channel_name', label: 'Nome do canal', type: 'text', placeholder: 'SMS Gateway Interno', required: true, helpText: 'Nome interno para identificação.' },
      { key: 'api_base_url', label: 'Base URL da API', type: 'text', placeholder: 'https://sms-gateway.suaclinica.com/api', required: true, helpText: 'URL base do gateway de SMS.' },
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: '••••••••••••', required: true, masked: true },
      { key: 'api_secret', label: 'API Secret', type: 'password', placeholder: '••••••••••••', masked: true, helpText: 'Secret adicional, se exigido pelo gateway.' },
      { key: 'sender_phone', label: 'Número de envio', type: 'text', placeholder: '+55 11 99999-0000', required: true },
      { key: 'send_endpoint', label: 'Endpoint de envio', type: 'text', placeholder: '/sms/send', required: true, helpText: 'Path relativo ao Base URL para envio de SMS.' },
      { key: 'webhook_inbound_url', label: 'Webhook inbound (recebimento)', type: 'text', placeholder: 'https://sms-gateway.suaclinica.com/webhook', helpText: 'URL do gateway que receberá notificações do ElosMed.' },
    ],
  },
  webhook: {
    supportsWebhook: true,
    callbackUrlTemplate: '/api/webhooks/sms',
    eventsAvailable: [
      { key: 'inbound', label: 'SMS recebidos', description: 'Mensagens SMS recebidas dos pacientes' },
      { key: 'status', label: 'Status de entrega', description: 'Confirmação de entrega, falha ou rejeição' },
    ],
  },
  routing: {
    supportsRouting: true,
    routingOptions: [
      { key: 'auto_reply', label: 'Auto-resposta', description: 'Resposta automática a SMS recebidos fora do horário', type: 'toggle' },
      { key: 'assign_team', label: 'Equipe padrão', description: 'Equipe que recebe SMS de pacientes', type: 'select', options: [
        { value: 'reception', label: 'Recepção' },
        { value: 'clinical', label: 'Equipe Clínica' },
        { value: 'financial', label: 'Financeiro' },
      ]},
    ],
  },
  testEndpoint: '/api/integrations/sms/test',
};

// ── Telefone / Voz ─────────────────────────────────────────────────

const PHONE_CONFIG: ChannelWizardConfig = {
  channelType: 'phone',
  label: 'Telefone / Voz',
  icon: 'phone',
  connectionMethods: [
    {
      ...METHOD_BSP,
      label: 'Provedor VoIP',
      description: 'Conecte via Twilio Voice, Vonage, Total Voice ou outro provedor VoIP com SIP/API.',
      icon: 'globe',
      recommended: true,
    },
    {
      ...METHOD_LINK,
      label: 'Discador Manual (sem integração)',
      description: 'Apenas registra o número de telefone. Ligações são feitas manualmente, sem automação ou gravação.',
      icon: 'phone',
    },
  ],
  credentialFields: {
    ...EMPTY_CREDS,
    external_bsp: [
      { key: 'provider', label: 'Provedor VoIP', type: 'select', required: true, options: [
        { value: 'twilio', label: 'Twilio Voice' },
        { value: 'vonage', label: 'Vonage Voice' },
        { value: 'totalvoice', label: 'Total Voice' },
        { value: 'custom', label: 'Custom / Outro' },
      ], helpText: 'Provedor de telefonia VoIP.' },
      { key: 'account_sid', label: 'Account SID / ID da Conta', type: 'text', placeholder: 'Ex: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', required: true, helpText: 'Identificador da conta no provedor VoIP.' },
      { key: 'auth_token', label: 'Auth Token', type: 'password', placeholder: '••••••••••••', required: true, masked: true },
      { key: 'phone_number', label: 'Número de Voz', type: 'text', placeholder: '+55 11 3000-0000', required: true, helpText: 'Número de telefone registrado para receber/fazer chamadas.' },
      { key: 'sip_domain', label: 'Domínio SIP (opcional)', type: 'text', placeholder: 'suaclinica.sip.twilio.com', helpText: 'Domínio SIP para registro de ramais, se aplicável.' },
      { key: 'bsp_base_url', label: 'Base URL (se custom)', type: 'text', placeholder: 'https://api.seuprovedor.com/v1', helpText: 'Obrigatório apenas para provedor Custom / Outro.' },
      { key: 'bsp_api_secret', label: 'API Secret (se custom)', type: 'password', placeholder: '••••••••••••', masked: true, helpText: 'Secret adicional, se exigido.' },
    ],
    manual_link: [
      { key: 'phone_number', label: 'Número de telefone', type: 'text', placeholder: '+55 11 3000-0000', required: true, helpText: 'Número principal da clínica para ligações.' },
      { key: 'extension', label: 'Ramal (opcional)', type: 'text', placeholder: 'Ex: 200', helpText: 'Ramal para encaminhamento interno.' },
      { key: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Ex: Horário de atendimento: 8h às 18h', helpText: 'Notas internas sobre este telefone.' },
    ],
  },
  webhook: {
    supportsWebhook: true,
    callbackUrlTemplate: '/api/webhooks/voice',
    eventsAvailable: [
      { key: 'call_started', label: 'Chamada iniciada', description: 'Evento ao iniciar uma chamada de voz' },
      { key: 'call_ended', label: 'Chamada encerrada', description: 'Evento ao encerrar, com duração e status' },
      { key: 'call_status', label: 'Status de chamada', description: 'Atualizações intermediárias (tocando, atendida, ocupada)' },
      { key: 'recording', label: 'Gravações', description: 'Gravações de chamadas disponíveis para download' },
      { key: 'voicemail', label: 'Caixa postal', description: 'Mensagens deixadas na caixa postal' },
    ],
  },
  routing: {
    supportsRouting: true,
    routingOptions: [
      { key: 'ura', label: 'URA Inteligente', description: 'Menu de voz automatizado com IA para triagem de chamadas', type: 'toggle' },
      { key: 'recording', label: 'Gravação automática', description: 'Gravar todas as chamadas automaticamente (requer consentimento)', type: 'toggle' },
      { key: 'assign_team', label: 'Equipe padrão', description: 'Equipe que recebe chamadas por padrão', type: 'select', options: [
        { value: 'reception', label: 'Recepção' },
        { value: 'clinical', label: 'Equipe Clínica' },
        { value: 'financial', label: 'Financeiro' },
      ]},
    ],
  },
  testEndpoint: '/api/integrations/voice/test',
};

// ── Webchat ────────────────────────────────────────────────────────

const WEBCHAT_CONFIG: ChannelWizardConfig = {
  channelType: 'webchat',
  label: 'Webchat',
  icon: 'globe',
  connectionMethods: [
    {
      ...METHOD_MANUAL,
      label: 'Widget Próprio ElosMed',
      description: 'Widget de chat nativo do ElosMed para o site ou portal do paciente. Integração total com inbox e Aurora IA.',
      icon: 'globe',
      recommended: true,
      requiresBackend: true,
    },
    {
      ...METHOD_BSP,
      label: 'Provider Externo',
      description: 'Use um widget de terceiro (Tawk.to, Crisp, Intercom, Zendesk Chat) com bridge para o inbox do ElosMed.',
      icon: 'globe',
    },
  ],
  credentialFields: {
    ...EMPTY_CREDS,
    manual_config: [
      { key: 'widget_title', label: 'Título do widget', type: 'text', placeholder: 'Atendimento Online', required: true, helpText: 'Texto exibido no cabeçalho do widget.' },
      { key: 'welcome_message', label: 'Mensagem de boas-vindas', type: 'textarea', placeholder: 'Olá! Como posso ajudá-lo?', helpText: 'Mensagem exibida automaticamente ao abrir o chat.' },
      { key: 'primary_color', label: 'Cor primária', type: 'text', placeholder: '#174D38', helpText: 'Cor do tema do widget (hex).' },
      { key: 'allowed_domains', label: 'Domínios permitidos', type: 'textarea', placeholder: 'suaclinica.com.br\nportal.suaclinica.com.br', helpText: 'Um domínio por linha. Apenas estes domínios poderão exibir o widget.' },
      { key: 'position', label: 'Posição do widget', type: 'select', options: [
        { value: 'bottom-right', label: 'Inferior direito' },
        { value: 'bottom-left', label: 'Inferior esquerdo' },
      ], helpText: 'Posição do botão flutuante na página.' },
      { key: 'auto_open_delay', label: 'Auto-abrir após (segundos)', type: 'text', placeholder: 'Ex: 30', helpText: 'Abre o widget automaticamente após X segundos. Deixe vazio para desativar.' },
    ],
    external_bsp: [
      { key: 'provider', label: 'Provider de Chat', type: 'select', required: true, options: [
        { value: 'tawk', label: 'Tawk.to' },
        { value: 'crisp', label: 'Crisp' },
        { value: 'intercom', label: 'Intercom' },
        { value: 'zendesk', label: 'Zendesk Chat' },
        { value: 'custom', label: 'Custom / Outro' },
      ], helpText: 'Provedor externo de widget de chat.' },
      { key: 'widget_id', label: 'Widget ID / Property ID', type: 'text', placeholder: 'Ex: 60f1b2c3d4e5f6...', required: true, helpText: 'Identificador do widget no provedor.' },
      { key: 'api_key', label: 'API Key (se necessário)', type: 'password', placeholder: '••••••••••••', masked: true, helpText: 'Alguns provedores exigem API key para bridge com inbox.' },
      { key: 'webhook_url', label: 'Webhook URL (bridge)', type: 'text', placeholder: 'https://api.seuprovedor.com/webhook', helpText: 'URL para reencaminhar conversas ao inbox do ElosMed.' },
      { key: 'custom_base_url', label: 'Base URL (se custom)', type: 'text', placeholder: 'https://api.seuprovedor.com/v1', helpText: 'Obrigatório apenas para provedor Custom / Outro.' },
    ],
    manual_link: [
      { key: 'embed_url', label: 'URL do site', type: 'text', placeholder: 'https://www.suaclinica.com.br', required: true, helpText: 'O código embed será gerado automaticamente para este domínio.' },
    ],
  },
  webhook: {
    supportsWebhook: true,
    callbackUrlTemplate: '/api/webhooks/webchat',
    eventsAvailable: [
      { key: 'messages', label: 'Mensagens', description: 'Mensagens enviadas e recebidas pelo widget' },
      { key: 'visitor_started', label: 'Visitante iniciou', description: 'Novo visitante abriu o chat' },
      { key: 'chat_closed', label: 'Chat encerrado', description: 'Conversa encerrada pelo visitante ou atendente' },
    ],
  },
  routing: {
    supportsRouting: true,
    routingOptions: [
      { key: 'ai_first', label: 'IA primeiro', description: 'Aurora IA atende primeiro, escala para humano se necessário', type: 'toggle' },
      { key: 'office_hours', label: 'Horário de atendimento', description: 'Limitar atendimento humano ao horário da clínica', type: 'toggle' },
      { key: 'assign_team', label: 'Equipe padrão', description: 'Equipe que recebe conversas do webchat', type: 'select', options: [
        { value: 'reception', label: 'Recepção' },
        { value: 'clinical', label: 'Equipe Clínica' },
      ]},
    ],
  },
};

// ── Canal Customizado ──────────────────────────────────────────────

const CUSTOM_CONFIG: ChannelWizardConfig = {
  channelType: 'custom',
  label: 'Canal Customizado',
  icon: 'layers',
  connectionMethods: [
    {
      ...METHOD_CUSTOM_WEBHOOK,
      label: 'Integração Completa via API/Webhook',
      description: 'Configure todos os parâmetros: base URL, método, autenticação, headers, payload e webhook inbound.',
      icon: 'zap',
      recommended: true,
    },
    {
      ...METHOD_MANUAL,
      label: 'API Simples',
      description: 'Integração básica com URL, API Key e nome do canal. Ideal para integrações mínimas.',
      icon: 'edit',
    },
  ],
  credentialFields: {
    ...EMPTY_CREDS,
    custom_webhook: [
      { key: 'channel_name', label: 'Nome do canal', type: 'text', placeholder: 'Ex: Sistema Legado, CRM Interno', required: true, helpText: 'Nome de exibição no ElosMed.' },
      { key: 'channel_type_label', label: 'Tipo do canal', type: 'select', required: true, options: [
        { value: 'crm', label: 'CRM' },
        { value: 'erp', label: 'ERP' },
        { value: 'helpdesk', label: 'Helpdesk' },
        { value: 'marketplace', label: 'Marketplace' },
        { value: 'chatbot', label: 'Chatbot externo' },
        { value: 'legacy', label: 'Sistema legado' },
        { value: 'other', label: 'Outro' },
      ], helpText: 'Categoria do sistema externo.' },
      { key: 'icon_name', label: 'Ícone', type: 'select', options: [
        { value: 'layers', label: 'Camadas (padrão)' },
        { value: 'globe', label: 'Globo' },
        { value: 'message', label: 'Mensagem' },
        { value: 'zap', label: 'Raio' },
        { value: 'link', label: 'Link' },
        { value: 'activity', label: 'Atividade' },
      ], helpText: 'Ícone exibido na lista de canais.' },
      { key: 'base_url', label: 'Base URL', type: 'text', placeholder: 'https://api.seusistema.com/v1', required: true, helpText: 'URL base da API do sistema externo.' },
      { key: 'send_method', label: 'Método de envio', type: 'select', required: true, options: [
        { value: 'POST', label: 'POST' },
        { value: 'PUT', label: 'PUT' },
        { value: 'PATCH', label: 'PATCH' },
      ], helpText: 'Método HTTP para enviar mensagens ao sistema externo.' },
      { key: 'send_endpoint', label: 'Endpoint de envio', type: 'text', placeholder: '/messages/send', required: true, helpText: 'Path relativo ao Base URL para envio de mensagens.' },
      { key: 'webhook_inbound_url', label: 'Webhook Inbound', type: 'text', placeholder: 'https://api.seusistema.com/webhook/elosmed', helpText: 'URL no sistema externo que receberá eventos do ElosMed (mensagens, status).' },
      { key: 'auth_type', label: 'Tipo de autenticação', type: 'select', required: true, options: [
        { value: 'bearer', label: 'Bearer Token' },
        { value: 'api_key', label: 'API Key (header)' },
        { value: 'basic', label: 'Basic Auth' },
        { value: 'custom_header', label: 'Header customizado' },
        { value: 'none', label: 'Sem autenticação' },
      ], helpText: 'Método de autenticação para chamadas à API.' },
      { key: 'auth_value', label: 'Valor da autenticação', type: 'password', placeholder: 'Token, API Key ou user:password', required: true, masked: true, helpText: 'Bearer: o token. API Key: a chave. Basic: user:password. Custom: valor do header.' },
      { key: 'auth_header_name', label: 'Nome do header (se custom)', type: 'text', placeholder: 'X-Custom-Auth', helpText: 'Nome do header de autenticação, se tipo "Header customizado".' },
      { key: 'custom_headers', label: 'Headers adicionais (JSON)', type: 'textarea', placeholder: '{"Content-Type": "application/json", "X-Tenant": "clinica-01"}', helpText: 'Headers extras enviados em todas as requisições. Formato JSON.' },
      { key: 'payload_schema', label: 'Schema do payload (JSON)', type: 'textarea', placeholder: '{"to": "{{recipient}}", "body": "{{message}}", "from": "elosmed"}', helpText: 'Template do corpo da requisição. Use {{recipient}}, {{message}}, {{sender}} como variáveis.' },
      { key: 'default_queue', label: 'Fila padrão', type: 'select', options: [
        { value: 'reception', label: 'Recepção' },
        { value: 'clinical', label: 'Equipe Clínica' },
        { value: 'financial', label: 'Financeiro' },
      ], helpText: 'Fila que recebe mensagens recebidas por padrão.' },
    ],
    manual_config: [
      { key: 'channel_name', label: 'Nome do canal', type: 'text', placeholder: 'Meu sistema legado', required: true, helpText: 'Nome interno para identificação.' },
      { key: 'api_url', label: 'URL da API', type: 'text', placeholder: 'https://api.seusistema.com/v1', required: true },
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: '••••••••••••', required: true, masked: true },
    ],
  },
  webhook: {
    supportsWebhook: true,
    callbackUrlTemplate: '/api/webhooks/custom',
    eventsAvailable: [
      { key: 'message_inbound', label: 'Mensagem recebida', description: 'Mensagem recebida do sistema externo' },
      { key: 'message_outbound', label: 'Mensagem enviada', description: 'Confirmação de envio ao sistema externo' },
      { key: 'status_update', label: 'Atualização de status', description: 'Mudança de status da mensagem (entregue, lida, erro)' },
      { key: 'all', label: 'Todos os eventos', description: 'Receber todos os eventos configurados' },
    ],
  },
  routing: {
    supportsRouting: true,
    routingOptions: [
      { key: 'assign_team', label: 'Equipe padrão', description: 'Equipe que recebe mensagens deste canal', type: 'select', options: [
        { value: 'reception', label: 'Recepção' },
        { value: 'clinical', label: 'Equipe Clínica' },
        { value: 'financial', label: 'Financeiro' },
      ]},
      { key: 'auto_reply', label: 'Auto-resposta', description: 'Enviar resposta automática para mensagens recebidas', type: 'toggle' },
    ],
  },
};

// ── Telegram (placeholder) ─────────────────────────────────────────

const TELEGRAM_CONFIG: ChannelWizardConfig = {
  channelType: 'custom',
  label: 'Telegram',
  icon: 'message',
  connectionMethods: [METHOD_MANUAL],
  credentialFields: {
    ...EMPTY_CREDS,
    manual_config: [
      { key: 'bot_token', label: 'Bot Token', type: 'password', placeholder: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', required: true, masked: true, helpText: 'Token do bot obtido via @BotFather.' },
      { key: 'bot_username', label: 'Username do bot', type: 'text', placeholder: '@seubot', required: true },
    ],
  },
  webhook: {
    supportsWebhook: true,
    callbackUrlTemplate: '/api/webhooks/telegram',
    verifyTokenRequired: false,
    eventsAvailable: [
      { key: 'messages', label: 'Mensagens', description: 'Mensagens recebidas no bot' },
    ],
  },
  routing: { supportsRouting: false },
};

// ── Registry ────────────────────────────────────────────────────────

export const CHANNEL_WIZARD_CONFIGS: Record<ChannelType, ChannelWizardConfig> = {
  whatsapp: WHATSAPP_CONFIG,
  instagram: INSTAGRAM_CONFIG,
  facebook: FACEBOOK_CONFIG,
  email: EMAIL_CONFIG,
  sms: SMS_CONFIG,
  phone: PHONE_CONFIG,
  webchat: WEBCHAT_CONFIG,
  custom: CUSTOM_CONFIG,
};

export function getChannelWizardConfig(type: ChannelType): ChannelWizardConfig {
  return CHANNEL_WIZARD_CONFIGS[type];
}
