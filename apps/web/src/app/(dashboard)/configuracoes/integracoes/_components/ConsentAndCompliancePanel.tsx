'use client';

import * as React from 'react';
import { Glass, Btn, Mono, Ico, Toggle, Badge, Input, type IcoName } from '@dermaos/ui/ds';
import { T } from '@dermaos/ui/ds';
import type { ChannelType } from '../_lib/channel-adapter';

// ── Types ──────────────────────────────────────────────────────────

export interface ChannelConsentConfig {
  optInEnabled: boolean;
  optInMessage: string;
  optOutEnabled: boolean;
  optOutKeywords: string[];
  retentionDays: number;
  allowedHoursStart: string;
  allowedHoursEnd: string;
  blockSensitiveData: boolean;
  sensitiveDataPolicy: 'block' | 'mask' | 'warn';
  auditEnabled: boolean;
  auditRetentionDays: number;
  consentRequired: boolean;
  consentCollectedAt?: Date;
  consentExpiresAt?: Date;
  lastAuditAt?: Date;
}

interface ConsentAndCompliancePanelProps {
  channel: ChannelType;
  config: ChannelConsentConfig;
  onUpdate?: (field: keyof ChannelConsentConfig, value: unknown) => void;
  isOwner?: boolean;
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

const SENSITIVE_POLICY_LABELS: Record<string, string> = {
  block: 'Bloquear envio',
  mask:  'Mascarar dados',
  warn:  'Alertar antes de enviar',
};

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// ── Section subcomponent ──────────────────────────────────────────

function ComplianceSection({
  icon,
  title,
  description,
  status,
  children,
}: {
  icon: IcoName;
  title: string;
  description: string;
  status?: 'ok' | 'warning' | 'error';
  children: React.ReactNode;
}) {
  const statusColors = {
    ok:      { bg: T.successBg, border: T.successBorder, color: T.success, icon: 'check' as IcoName },
    warning: { bg: T.warningBg, border: T.warningBorder, color: T.warning, icon: 'alert' as IcoName },
    error:   { bg: T.dangerBg,  border: T.dangerBorder,  color: T.danger,  icon: 'x' as IcoName },
  };

  return (
    <Glass style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: T.r.md,
            background: T.primaryBg,
            border: `1px solid ${T.primaryBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Ico name={icon} size={16} color={T.primary} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
              {title}
            </span>
            {status && (
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: statusColors[status].bg,
                  border: `1px solid ${statusColors[status].border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ico name={statusColors[status].icon} size={10} color={statusColors[status].color} />
              </div>
            )}
          </div>
          <p style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{description}</p>
        </div>
      </div>
      {children}
    </Glass>
  );
}

// ── Component ──────────────────────────────────────────────────────

export function ConsentAndCompliancePanel({
  channel,
  config,
  onUpdate,
  isOwner,
}: ConsentAndCompliancePanelProps) {
  const disabled = !isOwner;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
          LGPD e Conformidade — {CHANNEL_LABEL[channel]}
        </p>
        <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>
          Configure consentimento, retenção de dados e políticas de privacidade para este canal.
        </p>
      </div>

      {/* LGPD notice */}
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
          As configurações abaixo seguem os requisitos da <strong>LGPD (Lei 13.709/2018)</strong> e{' '}
          <strong>Resolução CFM 2.314/2022</strong>. Alterações são registradas na auditoria imutável.
        </div>
      </div>

      {/* Opt-In */}
      <ComplianceSection
        icon="check"
        title="Opt-In (Consentimento)"
        description="Paciente deve consentir antes de receber mensagens neste canal."
        status={config.optInEnabled ? 'ok' : 'warning'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: T.textSecondary }}>Exigir opt-in explícito</span>
            <Toggle
              checked={config.optInEnabled}
              onChange={() => onUpdate?.('optInEnabled', !config.optInEnabled)}
              label="Ativar opt-in"
              disabled={disabled}
            />
          </div>
          {config.optInEnabled && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, display: 'block', marginBottom: 4 }}>
                Mensagem de opt-in
              </label>
              <Input
                value={config.optInMessage}
                onChange={(e) => onUpdate?.('optInMessage', e.target.value)}
                placeholder="Deseja receber mensagens por este canal?"
                disabled={disabled}
              />
            </div>
          )}
          {config.consentCollectedAt && (
            <Mono size={10} color={T.textMuted}>
              Consentimento coletado em {formatDate(config.consentCollectedAt)}
              {config.consentExpiresAt && ` · Expira em ${formatDate(config.consentExpiresAt)}`}
            </Mono>
          )}
        </div>
      </ComplianceSection>

      {/* Opt-Out */}
      <ComplianceSection
        icon="x"
        title="Opt-Out (Descadastro)"
        description="Mecanismo para o paciente cancelar o recebimento de mensagens."
        status={config.optOutEnabled ? 'ok' : 'error'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: T.textSecondary }}>Opt-out automático por palavra-chave</span>
            <Toggle
              checked={config.optOutEnabled}
              onChange={() => onUpdate?.('optOutEnabled', !config.optOutEnabled)}
              label="Ativar opt-out"
              disabled={disabled}
            />
          </div>
          {config.optOutEnabled && (
            <div>
              <Mono size={10} color={T.textMuted} style={{ marginBottom: 6, display: 'block' }}>
                PALAVRAS-CHAVE DE OPT-OUT
              </Mono>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {config.optOutKeywords.map((kw) => (
                  <span
                    key={kw}
                    style={{
                      padding: '3px 10px',
                      borderRadius: T.r.pill,
                      background: T.dangerBg,
                      border: `1px solid ${T.dangerBorder}`,
                      fontSize: 11,
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: T.danger,
                    }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </ComplianceSection>

      {/* Retenção */}
      <ComplianceSection
        icon="clock"
        title="Retenção de Dados"
        description="Período máximo de armazenamento de mensagens e dados de interação."
        status={config.retentionDays > 0 ? 'ok' : 'warning'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 13, color: T.textSecondary, whiteSpace: 'nowrap' }}>
            Reter mensagens por
          </label>
          <div style={{ width: 100 }}>
            <Input
              type="number"
              value={String(config.retentionDays)}
              onChange={(e) => onUpdate?.('retentionDays', Number(e.target.value))}
              disabled={disabled}
            />
          </div>
          <span style={{ fontSize: 13, color: T.textSecondary }}>dias</span>
        </div>
        <Mono size={10} color={T.textMuted} style={{ marginTop: 8, display: 'block' }}>
          Após o período, mensagens são anonimizadas conforme política LGPD. Mínimo recomendado: 365 dias.
        </Mono>
      </ComplianceSection>

      {/* Horário permitido */}
      <ComplianceSection
        icon="clock"
        title="Horário Permitido de Envio"
        description="Janela de horário em que mensagens podem ser enviadas por este canal."
        status="ok"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, color: T.textSecondary }}>De</label>
          <div style={{ width: 90 }}>
            <Input
              type="time"
              value={config.allowedHoursStart}
              onChange={(e) => onUpdate?.('allowedHoursStart', e.target.value)}
              disabled={disabled}
            />
          </div>
          <label style={{ fontSize: 13, color: T.textSecondary }}>até</label>
          <div style={{ width: 90 }}>
            <Input
              type="time"
              value={config.allowedHoursEnd}
              onChange={(e) => onUpdate?.('allowedHoursEnd', e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
        <Mono size={10} color={T.textMuted} style={{ marginTop: 8, display: 'block' }}>
          Mensagens fora deste horário ficam em fila e são enviadas no próximo horário permitido.
        </Mono>
      </ComplianceSection>

      {/* Dados sensíveis */}
      <ComplianceSection
        icon="shield"
        title="Envio de Dados Sensíveis"
        description="Política para tratamento de dados clínicos e pessoais sensíveis neste canal."
        status={config.blockSensitiveData ? 'ok' : 'warning'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: T.textSecondary }}>Bloquear dados sensíveis</span>
            <Toggle
              checked={config.blockSensitiveData}
              onChange={() => onUpdate?.('blockSensitiveData', !config.blockSensitiveData)}
              label="Bloquear dados sensíveis"
              disabled={disabled}
            />
          </div>

          <div>
            <Mono size={10} color={T.textMuted} style={{ marginBottom: 6, display: 'block' }}>
              POLÍTICA QUANDO DETECTADO
            </Mono>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['block', 'mask', 'warn'] as const).map((policy) => {
                const isSelected = config.sensitiveDataPolicy === policy;
                return (
                  <button
                    key={policy}
                    type="button"
                    onClick={() => onUpdate?.('sensitiveDataPolicy', policy)}
                    disabled={disabled}
                    style={{
                      padding: '8px 14px',
                      borderRadius: T.r.md,
                      background: isSelected ? T.primaryBg : T.glass,
                      border: `1.5px solid ${isSelected ? T.primary : T.glassBorder}`,
                      color: isSelected ? T.primary : T.textSecondary,
                      fontSize: 12,
                      fontWeight: isSelected ? 600 : 400,
                      cursor: disabled ? 'default' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {SENSITIVE_POLICY_LABELS[policy]}
                  </button>
                );
              })}
            </div>
          </div>

          <Mono size={10} color={T.textMuted}>
            Dados protegidos: CPF, RG, diagnóstico, CID, prescrição, resultados de exames, laudos.
          </Mono>
        </div>
      </ComplianceSection>

      {/* Auditoria */}
      <ComplianceSection
        icon="eye"
        title="Auditoria"
        description="Registro imutável de todas as interações e alterações neste canal."
        status={config.auditEnabled ? 'ok' : 'error'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: T.textSecondary }}>Auditoria ativa</span>
            <Toggle
              checked={config.auditEnabled}
              onChange={() => onUpdate?.('auditEnabled', !config.auditEnabled)}
              label="Ativar auditoria"
              disabled={disabled}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, color: T.textSecondary, whiteSpace: 'nowrap' }}>
              Reter logs de auditoria por
            </label>
            <div style={{ width: 100 }}>
              <Input
                type="number"
                value={String(config.auditRetentionDays)}
                onChange={(e) => onUpdate?.('auditRetentionDays', Number(e.target.value))}
                disabled={disabled}
              />
            </div>
            <span style={{ fontSize: 13, color: T.textSecondary }}>dias</span>
          </div>
          {config.lastAuditAt && (
            <Mono size={10} color={T.textMuted}>
              Último registro de auditoria: {formatDate(config.lastAuditAt)}
            </Mono>
          )}
        </div>
      </ComplianceSection>

      {/* Consentimento por canal */}
      <ComplianceSection
        icon="check"
        title="Consentimento por Canal"
        description="Status do consentimento do paciente para receber comunicações neste canal específico."
        status={config.consentRequired ? 'ok' : 'warning'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: T.textSecondary }}>Exigir consentimento específico</span>
            <Toggle
              checked={config.consentRequired}
              onChange={() => onUpdate?.('consentRequired', !config.consentRequired)}
              label="Exigir consentimento"
              disabled={disabled}
            />
          </div>
          <Mono size={10} color={T.textMuted}>
            Quando ativo, o paciente deve consentir especificamente para receber mensagens por {CHANNEL_LABEL[channel]},
            além do consentimento geral de comunicação.
          </Mono>
        </div>
      </ComplianceSection>
    </div>
  );
}
