'use client';

import * as React from 'react';
import { Glass, Ico, Mono, T } from '@dermaos/ui/ds';
import type { ConnectionMethodId } from '../../_lib/wizard-config';

interface WebchatConnectionConfigProps {
  connectionMethod: ConnectionMethodId;
  credentials: Record<string, string>;
  onCredentialChange: (key: string, value: string) => void;
}

export function WebchatConnectionConfig({
  connectionMethod,
  credentials,
}: WebchatConnectionConfigProps) {
  if (connectionMethod === 'manual_config') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* TODO: Implement native webchat widget when backend WebSocket/polling support ships */}
        <div
          style={{
            padding: '20px 18px',
            borderRadius: T.r.lg,
            background: T.warningBg,
            border: `1px solid ${T.warningBorder}`,
            textAlign: 'center',
          }}
        >
          <Ico name="alert" size={28} color={T.warning} />
          <p style={{ fontSize: 14, fontWeight: 600, color: T.warning, marginTop: 10 }}>
            Requer implementação no backend
          </p>
          <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 6, lineHeight: 1.5 }}>
            O widget nativo do ElosMed ainda requer implementação do backend de WebSocket/polling para
            comunicação em tempo real. A configuração abaixo será salva como rascunho.
          </p>
        </div>

        <Glass style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
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
              <Ico name="globe" size={18} color={T.primary} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                Widget Próprio ElosMed
              </p>
              <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
                Widget de chat nativo integrado ao inbox do ElosMed e Aurora IA.
                Após configurar, você receberá um snippet de código para colar no HTML do seu site.
              </p>
            </div>
          </div>
        </Glass>

        <Glass style={{ padding: '14px 16px' }}>
          <Mono size={10} color={T.textMuted} style={{ display: 'block', marginBottom: 8 }}>
            PREVIEW DO EMBED CODE
          </Mono>
          <div
            style={{
              padding: '10px 14px',
              borderRadius: T.r.sm,
              background: 'rgba(0,0,0,0.03)',
              border: `1px solid ${T.divider}`,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              color: T.textSecondary,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {`<!-- ElosMed Webchat Widget -->\n<script\n  src="https://app.elosmed.com/widget.js"\n  data-clinic-id="{{CLINIC_ID}}"\n  data-color="${credentials['primary_color'] || '#174D38'}"\n  data-position="${credentials['position'] || 'bottom-right'}"\n  async\n></script>`}
          </div>
          <Mono size={10} color={T.textMuted} style={{ marginTop: 6, display: 'block' }}>
            O código embed real será gerado após ativação do canal.
          </Mono>
        </Glass>
      </div>
    );
  }

  if (connectionMethod === 'external_bsp') {
    const provider = credentials['provider'];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Glass style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
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
              <Ico name="globe" size={18} color={T.primary} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                Provider Externo de Chat
              </p>
              <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
                Use um widget de terceiro já existente no seu site. Configure o bridge para
                encaminhar conversas ao inbox do ElosMed.
              </p>
            </div>
          </div>
        </Glass>

        {provider === 'tawk' && (
          <ProviderHint
            name="Tawk.to"
            hint="Encontre o Property ID no dashboard do Tawk.to → Administration → Chat Widget. O Widget ID está na URL."
          />
        )}

        {provider === 'crisp' && (
          <ProviderHint
            name="Crisp"
            hint="Use o Website ID do painel Crisp → Settings → Website Settings. A API Key está em Settings → API."
          />
        )}

        {provider === 'intercom' && (
          <ProviderHint
            name="Intercom"
            hint="Use o App ID do Intercom → Settings → Installation. A API Key está em Settings → Developers → API Keys."
          />
        )}

        {provider === 'zendesk' && (
          <ProviderHint
            name="Zendesk Chat"
            hint="Use o Account Key do Zendesk Chat → Settings → Widget. Configure a API Key em Settings → Account → API."
          />
        )}

        {provider === 'custom' && (
          <ProviderHint
            name="Custom"
            hint="Para provedores custom, preencha o Widget ID, Base URL da API e configure o webhook de bridge para receber mensagens no ElosMed."
          />
        )}

        <div
          style={{
            padding: '10px 14px',
            borderRadius: T.r.md,
            background: T.infoBg,
            border: `1px solid ${T.infoBorder}`,
            fontSize: 12,
            color: T.info,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <Ico name="alert" size={14} color={T.info} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            O bridge encaminha mensagens do provider externo para o inbox do ElosMed via webhook.
            Configure a URL de webhook no painel do provider para completar a integração.
          </span>
        </div>
      </div>
    );
  }

  return null;
}

function ProviderHint({ name, hint }: { name: string; hint: string }) {
  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: T.r.md,
        background: T.infoBg,
        border: `1px solid ${T.infoBorder}`,
        fontSize: 12,
        color: T.info,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      <Ico name="alert" size={14} color={T.info} style={{ marginTop: 1, flexShrink: 0 }} />
      <span>
        <strong>{name}:</strong> {hint}
      </span>
    </div>
  );
}
