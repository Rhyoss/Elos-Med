'use client';

import * as React from 'react';
import { Glass, Ico, Mono, T } from '@dermaos/ui/ds';
import type { ConnectionMethodId } from '../../_lib/wizard-config';

interface CustomChannelConnectionConfigProps {
  connectionMethod: ConnectionMethodId;
  credentials: Record<string, string>;
  onCredentialChange: (key: string, value: string) => void;
}

export function CustomChannelConnectionConfig({
  connectionMethod,
  credentials,
}: CustomChannelConnectionConfigProps) {
  if (connectionMethod === 'custom_webhook') {
    const authType = credentials['auth_type'];

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
              <Ico name="layers" size={18} color={T.primary} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                Integração Completa via API / Webhook
              </p>
              <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
                Configure todos os parâmetros da integração: URL base, método HTTP, autenticação,
                headers customizados, schema do payload e webhook inbound para receber eventos.
              </p>
            </div>
          </div>
        </Glass>

        {authType && authType !== 'none' && (
          <AuthTypeHint authType={authType} />
        )}

        <Glass style={{ padding: '14px 16px' }}>
          <Mono size={10} color={T.textMuted} style={{ display: 'block', marginBottom: 8 }}>
            COMO FUNCIONA
          </Mono>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <FlowStep
              step="1"
              title="Envio de mensagens"
              desc={`ElosMed → ${credentials['send_method'] || 'POST'} ${credentials['base_url'] || '{base_url}'}${credentials['send_endpoint'] || '/{endpoint}'}`}
            />
            <FlowStep
              step="2"
              title="Recebimento (inbound)"
              desc={`Sistema externo → POST ${typeof window !== 'undefined' ? window.location.origin : 'https://app.elosmed.com'}/api/webhooks/custom`}
            />
            <FlowStep
              step="3"
              title="Autenticação"
              desc={authType === 'bearer' ? 'Authorization: Bearer {token}'
                : authType === 'api_key' ? 'X-API-Key: {chave}'
                : authType === 'basic' ? 'Authorization: Basic {base64(user:pass)}'
                : authType === 'custom_header' ? `${credentials['auth_header_name'] || '{header}'}: {valor}`
                : 'Sem autenticação'}
            />
          </div>
        </Glass>

        {credentials['payload_schema'] && (
          <Glass style={{ padding: '14px 16px' }}>
            <Mono size={10} color={T.textMuted} style={{ display: 'block', marginBottom: 8 }}>
              PREVIEW DO PAYLOAD
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
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: 120,
                overflowY: 'auto',
              }}
            >
              {formatJson(credentials['payload_schema'])}
            </div>
            <Mono size={10} color={T.textMuted} style={{ marginTop: 6, display: 'block' }}>
              Variáveis disponíveis: {'{{recipient}}'}, {'{{message}}'}, {'{{sender}}'}, {'{{timestamp}}'}
            </Mono>
          </Glass>
        )}

        <div
          style={{
            padding: '10px 14px',
            borderRadius: T.r.md,
            background: T.warningBg,
            border: `1px solid ${T.warningBorder}`,
            fontSize: 12,
            color: T.warning,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <Ico name="alert" size={14} color={T.warning} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            Canais customizados ainda não possuem suporte completo no backend.
            A configuração será salva como rascunho até a implementação do driver genérico de webhook.
          </span>
        </div>
      </div>
    );
  }

  if (connectionMethod === 'manual_config') {
    return (
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
            <Ico name="edit" size={18} color={T.primary} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
              API Simples
            </p>
            <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
              Integração mínima — apenas URL da API, chave de autenticação e nome do canal.
              Use este método para integrações básicas onde não é necessário configurar webhook inbound,
              headers customizados ou schema de payload.
            </p>
          </div>
        </div>
      </Glass>
    );
  }

  return null;
}

function AuthTypeHint({ authType }: { authType: string }) {
  const hints: Record<string, { label: string; desc: string }> = {
    bearer: {
      label: 'Bearer Token',
      desc: 'Informe o token sem o prefixo "Bearer". O ElosMed adicionará o header "Authorization: Bearer {token}" automaticamente.',
    },
    api_key: {
      label: 'API Key',
      desc: 'A chave será enviada no header "X-API-Key". Alguns provedores usam "Authorization: ApiKey {key}".',
    },
    basic: {
      label: 'Basic Auth',
      desc: 'Informe no formato "usuario:senha". O ElosMed codificará em Base64 automaticamente.',
    },
    custom_header: {
      label: 'Header Customizado',
      desc: 'Defina o nome do header no campo abaixo e o valor na autenticação.',
    },
  };

  const hint = hints[authType];
  if (!hint) return null;

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
      <Ico name="shield" size={14} color={T.info} style={{ marginTop: 1, flexShrink: 0 }} />
      <span>
        <strong>{hint.label}:</strong> {hint.desc}
      </span>
    </div>
  );
}

function FlowStep({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: T.primaryBg,
          border: `1px solid ${T.primaryBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 600, color: T.primary }}>{step}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary }}>{title}</p>
        <code
          style={{
            fontSize: 11,
            color: T.textMuted,
            fontFamily: "'IBM Plex Mono', monospace",
            wordBreak: 'break-all',
          }}
        >
          {desc}
        </code>
      </div>
    </div>
  );
}

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
