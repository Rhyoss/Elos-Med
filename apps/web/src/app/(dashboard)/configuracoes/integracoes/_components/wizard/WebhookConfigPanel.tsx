'use client';

import * as React from 'react';
import { Glass, Btn, Ico, Mono, Input, Toggle, T } from '@dermaos/ui/ds';
import { copyText } from '@/lib/clipboard';
import type { WebhookConfig } from '../../_lib/wizard-config';

interface WebhookConfigPanelProps {
  config: WebhookConfig;
  verifyToken: string;
  onVerifyTokenChange: (token: string) => void;
  selectedEvents: string[];
  onToggleEvent: (eventKey: string) => void;
}

export function WebhookConfigPanel({
  config,
  verifyToken,
  onVerifyTokenChange,
  selectedEvents,
  onToggleEvent,
}: WebhookConfigPanelProps) {
  const [copied, setCopied] = React.useState(false);

  if (!config.supportsWebhook) {
    return (
      <div
        style={{
          padding: '32px 20px',
          borderRadius: T.r.lg,
          background: T.glass,
          border: `1px solid ${T.glassBorder}`,
          textAlign: 'center',
        }}
      >
        <Ico name="zap" size={28} color={T.textMuted} />
        <p style={{ fontSize: 14, color: T.textSecondary, fontWeight: 500, marginTop: 10 }}>
          Este canal não utiliza webhooks.
        </p>
        <p style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
          Você pode pular esta etapa.
        </p>
      </div>
    );
  }

  const callbackUrl = config.callbackUrlTemplate
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://app.elosmed.com'}${config.callbackUrlTemplate}`
    : '';

  async function handleCopy() {
    if (!callbackUrl) return;
    if (await copyText(callbackUrl)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <p style={{ fontSize: 15, color: T.textPrimary, fontWeight: 600, marginBottom: 4 }}>
          Configuração de Webhook
        </p>
        <p style={{ fontSize: 13, color: T.textSecondary }}>
          Configure a URL de callback e selecione os eventos que deseja receber.
        </p>
      </div>

      {/* Callback URL */}
      {callbackUrl && (
        <Glass style={{ padding: '16px 18px' }}>
          <Mono size={10} color={T.textMuted} style={{ marginBottom: 8, display: 'block' }}>
            URL DE CALLBACK
          </Mono>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: T.r.sm,
                background: 'rgba(0,0,0,0.03)',
                border: `1px solid ${T.divider}`,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
                color: T.textPrimary,
                wordBreak: 'break-all',
              }}
            >
              {callbackUrl}
            </div>
            <Btn
              small
              variant="ghost"
              icon={copied ? 'check' : 'copy'}
              iconOnly
              onClick={handleCopy}
              aria-label="Copiar URL"
            />
          </div>
          <Mono size={10} color={T.textMuted} style={{ marginTop: 6, display: 'block' }}>
            Cole esta URL no painel do provedor para receber notificações.
          </Mono>
        </Glass>
      )}

      {/* Verify Token */}
      {config.verifyTokenRequired && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary }}>
            Verify Token
          </label>
          <Input
            value={verifyToken}
            onChange={(e) => onVerifyTokenChange(e.target.value)}
            placeholder="Token de verificação do webhook"
            leadingIcon="shield"
            autoComplete="off"
          />
          <Mono size={10} color={T.textMuted}>
            Token usado pelo provedor para validar a URL de callback. Gere um token seguro e cole no painel do provedor.
          </Mono>
        </div>
      )}

      {/* Events */}
      {config.eventsAvailable && config.eventsAvailable.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Mono size={10} color={T.textMuted}>EVENTOS</Mono>
          {config.eventsAvailable.map((ev) => {
            const isOn = selectedEvents.includes(ev.key);
            return (
              <div
                key={ev.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 14,
                  padding: '12px 16px',
                  borderRadius: T.r.md,
                  background: isOn ? T.primaryBg : T.glass,
                  border: `1px solid ${isOn ? T.primaryBorder : T.glassBorder}`,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary }}>
                    {ev.label}
                  </p>
                  <p style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                    {ev.description}
                  </p>
                </div>
                <Toggle
                  checked={isOn}
                  onChange={() => onToggleEvent(ev.key)}
                  label={`Ativar evento ${ev.label}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
