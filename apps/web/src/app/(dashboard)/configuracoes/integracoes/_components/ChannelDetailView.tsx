'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Glass, Btn, Ico, Mono, Badge, Skeleton, Field, Input, type IcoName } from '@dermaos/ui/ds';
import { T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import type { ChannelViewModel, ChannelType } from '../_lib/channel-adapter';
import type { Channel as BackendChannel } from '@dermaos/shared';

/** Mapeia o tipo de canal da UI para o enum backend (settings.integrations).
 * Apenas WhatsApp/Instagram/Telegram/Email são suportados pelo backend; os
 * demais retornam null e fazem o painel de Conexão exibir um placeholder. */
function toBackendChannel(t: ChannelType): BackendChannel | null {
  switch (t) {
    case 'whatsapp':  return 'whatsapp';
    case 'instagram': return 'instagram';
    case 'sms':       return 'telegram';
    case 'email':     return 'email';
    default:          return null;
  }
}
import { ProviderStatusBadge } from './ProviderStatusBadge';
import { ChannelHealthDetail, type ChannelHealthData } from './ChannelHealthDetail';
import { ChannelTemplatesPanel, type ChannelTemplate } from './ChannelTemplatesPanel';
import { AutomationEligibilityPanel, type AutomationConfig } from './AutomationEligibilityPanel';
import { ConsentAndCompliancePanel, type ChannelConsentConfig } from './ConsentAndCompliancePanel';
import { IntegrationLogsTable, type IntegrationLogEntry } from './IntegrationLogsTable';

// ── Tab types ──────────────────────────────────────────────────────

type ChannelTab = 'resumo' | 'conexao' | 'webhooks' | 'roteamento' | 'templates' | 'automacoes' | 'lgpd' | 'logs';

interface TabDef {
  id: ChannelTab;
  label: string;
  icon: IcoName;
}

const TABS: TabDef[] = [
  { id: 'resumo',     label: 'Resumo',      icon: 'layers' },
  { id: 'conexao',    label: 'Conexão',      icon: 'link' },
  { id: 'webhooks',   label: 'Webhooks',     icon: 'zap' },
  { id: 'roteamento', label: 'Roteamento',   icon: 'layers' },
  { id: 'templates',  label: 'Templates',    icon: 'file' },
  { id: 'automacoes', label: 'Automações',   icon: 'clock' },
  { id: 'lgpd',       label: 'LGPD',         icon: 'shield' },
  { id: 'logs',       label: 'Logs',         icon: 'activity' },
];

// ── Props ──────────────────────────────────────────────────────────

interface ChannelDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ChannelViewModel;
  isOwner?: boolean;
}

// ── Mock data generators ──────────────────────────────────────────

function buildMockHealth(ch: ChannelViewModel): ChannelHealthData {
  const isConnected = ch.status === 'connected';
  const hasError = ch.status === 'error';
  const now = Date.now();
  return {
    channel: ch.type,
    lastInbound: isConnected ? new Date(now - 300_000 * (1 + Math.random() * 10)) : undefined,
    lastOutbound: isConnected ? new Date(now - 120_000 * (1 + Math.random() * 5)) : undefined,
    errorRate: hasError ? 18.2 : isConnected ? 0.3 : 0,
    retryQueueSize: hasError ? 12 : 0,
    tokenExpiresAt: isConnected ? new Date(now + 86_400_000 * 45) : undefined,
    webhookFailingSince: hasError ? new Date(now - 3_600_000 * 6) : undefined,
    missingPermissions: hasError ? ['messages_send'] : [],
    uptimePercent: isConnected ? 99.7 : hasError ? 94.1 : undefined,
    avgLatencyMs: isConnected ? 142 : undefined,
  };
}

function buildMockTemplates(ch: ChannelType): ChannelTemplate[] {
  return [
    {
      id: `${ch}-tpl-1`,
      category: 'confirmacao_consulta',
      name: 'Confirmação padrão',
      body: 'Olá {{nome_paciente}}, sua consulta com {{nome_medico}} está confirmada para {{data_consulta}} às {{hora_consulta}}. Clínica: {{nome_clinica}}.',
      variables: ['nome_paciente', 'nome_medico', 'data_consulta', 'hora_consulta', 'nome_clinica'],
      isActive: true,
      sensitiveVarsBlocked: false,
    },
    {
      id: `${ch}-tpl-2`,
      category: 'lembrete',
      name: 'Lembrete 24h',
      body: 'Olá {{nome_paciente}}! Lembrete: sua consulta é amanhã, {{data_consulta}} às {{hora_consulta}}. Confirme clicando: {{link_confirmacao}}',
      variables: ['nome_paciente', 'data_consulta', 'hora_consulta', 'link_confirmacao'],
      isActive: true,
      sensitiveVarsBlocked: false,
    },
    {
      id: `${ch}-tpl-3`,
      category: 'fora_horario',
      name: 'Fora do horário',
      body: 'Obrigado pelo contato! A {{nome_clinica}} funciona de segunda a sexta, das 8h às 18h. Retornaremos assim que possível.',
      variables: ['nome_clinica'],
      isActive: true,
      sensitiveVarsBlocked: false,
    },
  ];
}

function buildMockAutomations(ch: ChannelType): AutomationConfig[] {
  return [
    { type: 'lembrete_consulta', isActive: true, isEligible: true, totalSent: 234, lastTriggered: new Date(Date.now() - 3_600_000) },
    { type: 'confirmacao', isActive: true, isEligible: true, totalSent: 189, lastTriggered: new Date(Date.now() - 7_200_000) },
    { type: 'pos_procedimento', isActive: false, isEligible: true },
    { type: 'retorno', isActive: false, isEligible: true },
    { type: 'recuperacao_lead', isActive: false, isEligible: true },
    { type: 'aniversario', isActive: true, isEligible: true, totalSent: 42, lastTriggered: new Date(Date.now() - 86_400_000) },
    { type: 'campanha', isActive: false, isEligible: false, ineligibleReason: 'Requer template de campanha ativo e opt-in configurado.' },
    { type: 'aviso_documentos', isActive: false, isEligible: false, ineligibleReason: 'Módulo de documentos não está conectado a este canal.' },
  ];
}

function buildMockConsent(ch: ChannelType): ChannelConsentConfig {
  return {
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
}

function buildMockLogs(ch: ChannelType): IntegrationLogEntry[] {
  const now = Date.now();
  const events = ['message.sent', 'message.received', 'status.delivered', 'status.read', 'webhook.received', 'template.sent', 'error.timeout', 'error.auth'];
  const statuses: Array<'success' | 'error' | 'pending'> = ['success', 'success', 'success', 'success', 'error', 'pending'];
  const providers: Record<ChannelType, string> = {
    whatsapp: 'Meta Cloud API', instagram: 'Meta Graph API', facebook: 'Meta Messenger API',
    email: 'SendGrid', sms: 'Twilio', phone: 'Twilio Voice', webchat: 'Widget ElosMed', custom: 'Webhook',
  };

  return Array.from({ length: 25 }, (_, i): IntegrationLogEntry => {
    const status = statuses[i % statuses.length]!;
    const event = events[i % events.length]!;
    const isError = status === 'error';
    return {
      id: `log-${ch}-${i}`,
      timestamp: new Date(now - i * 900_000 * (1 + Math.random())),
      channel: ch,
      event,
      direction: i % 3 === 0 ? 'inbound' : 'outbound',
      status,
      provider: providers[ch],
      entityType: i % 2 === 0 ? 'Consulta' : i % 3 === 0 ? 'Paciente' : undefined,
      entityId: i % 2 === 0 ? `c-${(1000 + i).toString(36)}` : undefined,
      errorSummary: isError ? (i % 2 === 0 ? 'Token expirado — renovar credenciais no painel do provedor.' : 'Timeout na conexão com API do provedor (>30s).') : undefined,
      canReprocess: isError,
    };
  });
}

// ── Component ──────────────────────────────────────────────────────

export function ChannelDetailView({
  open,
  onOpenChange,
  channel,
  isOwner,
}: ChannelDetailViewProps) {
  const [activeTab, setActiveTab] = React.useState<ChannelTab>('resumo');

  React.useEffect(() => {
    if (open) setActiveTab('resumo');
  }, [open]);

  const health = React.useMemo(() => buildMockHealth(channel), [channel]);
  const templates = React.useMemo(() => buildMockTemplates(channel.type), [channel.type]);
  const automations = React.useMemo(() => buildMockAutomations(channel.type), [channel.type]);
  const consent = React.useMemo(() => buildMockConsent(channel.type), [channel.type]);
  const logs = React.useMemo(() => buildMockLogs(channel.type), [channel.type]);

  const CATEGORY_ICON: Record<string, IcoName> = {
    social: 'message', messaging: 'message', email: 'mail', voice: 'phone', web: 'globe', custom: 'layers', default: 'layers',
  };
  const channelIcon: IcoName = CATEGORY_ICON[channel.category] ?? 'layers';

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(6px)',
            zIndex: 400,
          }}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '94vw', maxWidth: 960,
            maxHeight: '92vh',
            display: 'flex', flexDirection: 'column',
            background: T.bg,
            borderRadius: T.r.xl,
            border: `1px solid ${T.glassBorder}`,
            boxShadow: T.shadow.xl,
            zIndex: 401,
            overflow: 'hidden',
            outline: 'none',
          }}
        >
          <DialogPrimitive.Title
            style={{
              position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
              overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
            }}
          >
            Detalhes do canal {channel.label}
          </DialogPrimitive.Title>

          {/* Header */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 24px',
              borderBottom: `1px solid ${T.divider}`,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44, height: 44, borderRadius: T.r.md,
                  background: channel.status === 'connected' ? T.successBg : T.primaryBg,
                  border: `1px solid ${channel.status === 'connected' ? T.successBorder : T.primaryBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ico
                  name={channelIcon}
                  size={20}
                  color={channel.status === 'connected' ? T.success : T.primary}
                />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>
                    {channel.label}
                  </span>
                  <ProviderStatusBadge status={channel.status} />
                </div>
                <Mono size={10} color={T.textMuted} style={{ marginTop: 2 }}>
                  {channel.provider}
                </Mono>
              </div>
            </div>

            <DialogPrimitive.Close
              aria-label="Fechar"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 6, borderRadius: T.r.sm,
                display: 'flex', alignItems: 'center',
              }}
            >
              <Ico name="x" size={18} color={T.textMuted} />
            </DialogPrimitive.Close>
          </div>

          {/* Tab bar */}
          <div
            style={{
              display: 'flex', gap: 0,
              borderBottom: `1px solid ${T.divider}`,
              flexShrink: 0,
              overflowX: 'auto',
              padding: '0 24px',
            }}
          >
            {TABS.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '10px 16px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: isActive ? `2px solid ${T.primary}` : '2px solid transparent',
                    color: isActive ? T.primary : T.textSecondary,
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 0.15s',
                    marginBottom: -1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Ico name={tab.icon} size={13} color={isActive ? T.primary : T.textMuted} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {activeTab === 'resumo' && (
              <ResumoTab channel={channel} health={health} />
            )}

            {activeTab === 'conexao' && (
              <ConexaoTab channel={channel} isOwner={isOwner} />
            )}

            {activeTab === 'webhooks' && (
              <WebhooksTab channel={channel} />
            )}

            {activeTab === 'roteamento' && (
              <RoteamentoTab channel={channel} />
            )}

            {activeTab === 'templates' && (
              <ChannelTemplatesPanel channel={channel.type} templates={templates} isOwner={isOwner} />
            )}

            {activeTab === 'automacoes' && (
              <AutomationEligibilityPanel channel={channel.type} automations={automations} isOwner={isOwner} />
            )}

            {activeTab === 'lgpd' && (
              <ConsentAndCompliancePanel channel={channel.type} config={consent} isOwner={isOwner} />
            )}

            {activeTab === 'logs' && (
              <IntegrationLogsTable logs={logs} channelFilter={channel.type} />
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ── Tab content components ──────────────────────────────────────

function ResumoTab({ channel, health }: { channel: ChannelViewModel; health: ChannelHealthData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ChannelHealthDetail health={health} />

      {/* Channel info */}
      <Glass style={{ padding: '16px 20px' }}>
        <Mono size={10} color={T.textMuted} spacing="0.8px" style={{ marginBottom: 12, display: 'block' }}>
          INFORMAÇÕES DO CANAL
        </Mono>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <InfoRow label="Tipo" value={channel.type} />
          <InfoRow label="Categoria" value={channel.category} />
          <InfoRow label="Provider" value={channel.provider} />
          <InfoRow label="Suporte backend" value={channel.isBackendSupported ? 'Sim' : 'Não'} />
          {channel.lastSyncAt && (
            <InfoRow label="Última sincronização" value={channel.lastSyncAt.toLocaleString('pt-BR')} />
          )}
          {channel.tokenPreview && (
            <InfoRow label="Token" value={channel.tokenPreview} mono />
          )}
        </div>
      </Glass>

      {/* Error details */}
      {channel.lastError && (
        <Glass
          style={{
            padding: '14px 18px',
            background: T.dangerBg,
            border: `1px solid ${T.dangerBorder}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Ico name="alert" size={16} color={T.danger} style={{ marginTop: 2 }} />
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.danger }}>
                Erro ativo
              </span>
              <p style={{ fontSize: 13, color: T.danger, marginTop: 4, lineHeight: 1.5 }}>
                {channel.lastError}
              </p>
              <Btn small variant="danger" icon="zap" style={{ marginTop: 8 }}>
                Corrigir agora
              </Btn>
            </div>
          </div>
        </Glass>
      )}
    </div>
  );
}

function ConexaoTab({ channel, isOwner }: { channel: ChannelViewModel; isOwner?: boolean }) {
  const backendChannel = toBackendChannel(channel.type);
  const utils = trpc.useUtils();
  const [editing, setEditing] = React.useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});

  function setField(k: string, v: string) { setFields((s) => ({ ...s, [k]: v })); }

  function buildPayload(): Parameters<typeof updateMut.mutate>[0] | null {
    if (!backendChannel) return null;
    switch (backendChannel) {
      case 'whatsapp':
        if (!fields['phoneNumberId'] || !fields['accessToken'] || !fields['appSecret'] || !fields['verifyToken']) return null;
        return {
          channel:        'whatsapp',
          phoneNumberId:  fields['phoneNumberId'],
          accessToken:    fields['accessToken'],
          appSecret:      fields['appSecret'],
          verifyToken:    fields['verifyToken'],
        };
      case 'instagram':
        if (!fields['pageId'] || !fields['accessToken'] || !fields['appSecret'] || !fields['verifyToken']) return null;
        return {
          channel:      'instagram',
          pageId:       fields['pageId'],
          accessToken:  fields['accessToken'],
          appSecret:    fields['appSecret'],
          verifyToken:  fields['verifyToken'],
        };
      case 'telegram':
        if (!fields['botToken']) return null;
        return { channel: 'telegram', botToken: fields['botToken'] };
      case 'email':
        if (!fields['host'] || !fields['user'] || !fields['pass']) return null;
        return {
          channel: 'email',
          host:    fields['host'],
          port:    Number(fields['port'] ?? 587),
          user:    fields['user'],
          pass:    fields['pass'],
        };
    }
  }

  const updateMut = trpc.settings.integrations.updateCredential.useMutation({
    onSuccess: async () => {
      setFeedback({ kind: 'ok', msg: 'Credenciais salvas e cifradas com AES-256-GCM.' });
      setEditing(false);
      setFields({});
      await Promise.all([
        utils.settings.integrations.list.invalidate(),
        utils.omni.listChannels.invalidate(),
      ]);
    },
    onError: (err) => setFeedback({ kind: 'err', msg: err.message }),
  });

  const testMut = trpc.settings.integrations.testConnection.useMutation({
    onSuccess: async (data) => {
      setFeedback(
        data.connected
          ? { kind: 'ok', msg: 'Conexão validada com sucesso.' }
          : { kind: 'err', msg: data.error ?? 'Falha na verificação.' },
      );
      await utils.settings.integrations.list.invalidate();
    },
    onError: (err) => setFeedback({ kind: 'err', msg: err.message }),
  });

  const disconnectMut = trpc.settings.integrations.disconnect.useMutation({
    onSuccess: async () => {
      setFeedback({ kind: 'ok', msg: 'Canal desconectado. Credenciais apagadas.' });
      setConfirmDisconnect(false);
      await Promise.all([
        utils.settings.integrations.list.invalidate(),
        utils.omni.listChannels.invalidate(),
      ]);
    },
    onError: (err) => setFeedback({ kind: 'err', msg: err.message }),
  });

  if (!backendChannel) {
    return (
      <Glass style={{ padding: '18px 20px' }}>
        <p style={{ fontSize: 14, color: T.textSecondary }}>
          A integração com {channel.label} ainda não tem provedor configurado no backend.
        </p>
      </Glass>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Glass style={{ padding: '18px 20px' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>
          Status da Conexão
        </p>
        <p style={{ fontSize: 13, color: T.textSecondary, marginBottom: 14 }}>
          Gerencie as credenciais e parâmetros de conexão deste canal.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <InfoRow label="Status" value={channel.status} />
          <InfoRow label="Provider" value={channel.provider} />
          {channel.tokenPreview && (
            <InfoRow label="Token (preview)" value={`••••${channel.tokenPreview}`} mono />
          )}
          {channel.omniChannelId && (
            <InfoRow label="Channel ID" value={channel.omniChannelId} mono />
          )}
          {channel.lastSyncAt && (
            <InfoRow
              label="Última verificação"
              value={new Date(channel.lastSyncAt).toLocaleString('pt-BR')}
            />
          )}
          {channel.lastError && (
            <InfoRow label="Último erro" value={channel.lastError} />
          )}
        </div>

        {feedback && (
          <div
            style={{
              marginTop: 14,
              padding: '8px 12px',
              borderRadius: T.r.sm,
              fontSize: 13,
              background: feedback.kind === 'ok' ? T.successBg : T.dangerBg,
              border: `1px solid ${feedback.kind === 'ok' ? T.successBorder : T.dangerBorder}`,
              color: feedback.kind === 'ok' ? T.success : T.danger,
            }}
          >
            {feedback.msg}
          </div>
        )}

        {isOwner && !editing && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <Btn
              small
              variant="glass"
              icon="edit"
              onClick={() => { setEditing(true); setFeedback(null); }}
            >
              Editar credenciais
            </Btn>
            <Btn
              small
              variant="glass"
              icon="zap"
              loading={testMut.isPending}
              onClick={() => { setFeedback(null); testMut.mutate({ channel: backendChannel }); }}
              disabled={!channel.tokenPreview}
            >
              Testar conexão
            </Btn>
            {channel.status === 'connected' && (
              <Btn
                small
                variant="danger"
                icon="lock"
                onClick={() => { setFeedback(null); setConfirmDisconnect(true); }}
              >
                Desconectar
              </Btn>
            )}
          </div>
        )}

        {isOwner && editing && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {backendChannel === 'whatsapp' && (
              <>
                <Field label="Phone Number ID" required>
                  <Input value={fields['phoneNumberId'] ?? ''} onChange={(e) => setField('phoneNumberId', e.target.value)} placeholder="ex: 100000000000001" />
                </Field>
                <Field label="Access Token (permanente)" required>
                  <Input type="password" value={fields['accessToken'] ?? ''} onChange={(e) => setField('accessToken', e.target.value)} placeholder="EAA..." style={{ fontFamily: "'IBM Plex Mono', monospace" }} />
                </Field>
                <Field label="App Secret (HMAC dos webhooks)" required>
                  <Input type="password" value={fields['appSecret'] ?? ''} onChange={(e) => setField('appSecret', e.target.value)} style={{ fontFamily: "'IBM Plex Mono', monospace" }} />
                </Field>
                <Field label="Verify Token (handshake GET)" required>
                  <Input value={fields['verifyToken'] ?? ''} onChange={(e) => setField('verifyToken', e.target.value)} placeholder="Token aleatório que você define no painel Meta" />
                </Field>
              </>
            )}
            {backendChannel === 'instagram' && (
              <>
                <Field label="Page ID" required>
                  <Input value={fields['pageId'] ?? ''} onChange={(e) => setField('pageId', e.target.value)} />
                </Field>
                <Field label="Access Token" required>
                  <Input type="password" value={fields['accessToken'] ?? ''} onChange={(e) => setField('accessToken', e.target.value)} />
                </Field>
                <Field label="App Secret" required>
                  <Input type="password" value={fields['appSecret'] ?? ''} onChange={(e) => setField('appSecret', e.target.value)} />
                </Field>
                <Field label="Verify Token" required>
                  <Input value={fields['verifyToken'] ?? ''} onChange={(e) => setField('verifyToken', e.target.value)} />
                </Field>
              </>
            )}
            {backendChannel === 'telegram' && (
              <Field label="Bot Token" required>
                <Input type="password" value={fields['botToken'] ?? ''} onChange={(e) => setField('botToken', e.target.value)} placeholder="123456:AAEhBP..." style={{ fontFamily: "'IBM Plex Mono', monospace" }} />
              </Field>
            )}
            {backendChannel === 'email' && (
              <>
                <Field label="Host SMTP" required>
                  <Input value={fields['host'] ?? ''} onChange={(e) => setField('host', e.target.value)} placeholder="smtp.gmail.com" />
                </Field>
                <Field label="Porta">
                  <Input value={fields['port'] ?? '587'} onChange={(e) => setField('port', e.target.value)} placeholder="587" />
                </Field>
                <Field label="Usuário" required>
                  <Input value={fields['user'] ?? ''} onChange={(e) => setField('user', e.target.value)} placeholder="user@dominio.com" />
                </Field>
                <Field label="Senha" required>
                  <Input type="password" value={fields['pass'] ?? ''} onChange={(e) => setField('pass', e.target.value)} />
                </Field>
              </>
            )}
            <Mono size={10} color={T.textMuted}>
              Os campos sensíveis são cifrados em AES-256-GCM antes de persistir e nunca são exibidos em texto claro depois.
            </Mono>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn
                small
                variant="primary"
                icon="check"
                loading={updateMut.isPending}
                disabled={!buildPayload()}
                onClick={() => {
                  const payload = buildPayload();
                  if (payload) updateMut.mutate(payload);
                }}
              >
                Salvar credenciais
              </Btn>
              <Btn
                small
                variant="glass"
                onClick={() => { setEditing(false); setFields({}); setFeedback(null); }}
              >
                Cancelar
              </Btn>
            </div>
          </div>
        )}

        {isOwner && confirmDisconnect && (
          <div
            style={{
              marginTop: 16,
              padding: '14px 16px',
              borderRadius: T.r.md,
              background: T.dangerBg,
              border: `1px solid ${T.dangerBorder}`,
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 600, color: T.danger, marginBottom: 4 }}>
              Desconectar {channel.label}?
            </p>
            <p style={{ fontSize: 12, color: T.textSecondary, marginBottom: 12 }}>
              As credenciais cifradas serão apagadas e novas mensagens entrantes
              serão rejeitadas. O histórico de conversas é preservado.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn
                small
                variant="danger"
                icon="lock"
                loading={disconnectMut.isPending}
                onClick={() => disconnectMut.mutate({ channel: backendChannel })}
              >
                Confirmar desconexão
              </Btn>
              <Btn small variant="glass" onClick={() => setConfirmDisconnect(false)}>
                Cancelar
              </Btn>
            </div>
          </div>
        )}
      </Glass>
    </div>
  );
}

function WebhooksTab({ channel }: { channel: ChannelViewModel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Glass style={{ padding: '18px 20px' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>
          Webhooks
        </p>
        <p style={{ fontSize: 13, color: T.textSecondary, marginBottom: 14 }}>
          URLs de callback e eventos configurados para este canal.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <Mono size={10} color={T.textMuted} style={{ marginBottom: 4, display: 'block' }}>
              URL DE CALLBACK
            </Mono>
            <div
              style={{
                padding: '8px 12px',
                borderRadius: T.r.sm,
                background: 'rgba(0,0,0,0.025)',
                border: `1px solid ${T.divider}`,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
                color: T.textPrimary,
              }}
            >
              {typeof window !== 'undefined' ? window.location.origin : 'https://app.elosmed.com'}/api/webhooks/{channel.type}
            </div>
          </div>

          <Mono size={10} color={T.textMuted} style={{ marginTop: 8, display: 'block' }}>
            EVENTOS ASSINADOS
          </Mono>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['messages', 'statuses', 'errors'].map((ev) => (
              <Badge key={ev} variant="info">{ev}</Badge>
            ))}
          </div>
        </div>
      </Glass>
    </div>
  );
}

function RoteamentoTab({ channel }: { channel: ChannelViewModel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Glass style={{ padding: '18px 20px' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>
          Regras de Roteamento
        </p>
        <p style={{ fontSize: 13, color: T.textSecondary, marginBottom: 14 }}>
          Defina como as mensagens recebidas por este canal são distribuídas entre as equipes.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <InfoRow label="Equipe padrão" value="Recepção" />
          <InfoRow label="Resposta automática fora do horário" value="Ativo" />
          <InfoRow label="Triagem por IA" value="Ativo" />
        </div>
      </Glass>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.divider}` }}>
      <span style={{ fontSize: 13, color: T.textMuted }}>{label}</span>
      {mono ? (
        <Mono size={11} color={T.textPrimary}>{value}</Mono>
      ) : (
        <span style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary }}>{value}</span>
      )}
    </div>
  );
}
