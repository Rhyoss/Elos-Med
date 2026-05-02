'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Glass, Btn, Ico, Mono, Badge, Skeleton, type IcoName } from '@dermaos/ui/ds';
import { T } from '@dermaos/ui/ds';
import type { ChannelViewModel, ChannelType } from '../_lib/channel-adapter';
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
            <InfoRow label="Token (preview)" value={channel.tokenPreview} mono />
          )}
          {channel.omniChannelId && (
            <InfoRow label="Channel ID" value={channel.omniChannelId} mono />
          )}
        </div>
        {isOwner && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Btn small variant="glass" icon="edit">Editar credenciais</Btn>
            <Btn small variant="glass" icon="zap">Testar conexão</Btn>
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
