'use client';

import * as React from 'react';
import { Glass, Ico, Mono, T } from '@dermaos/ui/ds';
import type { ConnectionMethodId } from '../../_lib/wizard-config';

interface SmsConnectionConfigProps {
  connectionMethod: ConnectionMethodId;
  credentials: Record<string, string>;
  onCredentialChange: (key: string, value: string) => void;
}

export function SmsConnectionConfig({
  connectionMethod,
  credentials,
}: SmsConnectionConfigProps) {
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
              <Ico name="message" size={18} color={T.primary} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                Provedor Externo de SMS
              </p>
              <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
                Conecte com um provedor de SMS para enviar lembretes de consulta, confirmações e alertas.
                O número de envio deve estar registrado e ativo no provedor escolhido.
              </p>
            </div>
          </div>
        </Glass>

        {provider === 'twilio' && (
          <ProviderHint
            name="Twilio"
            hint="Encontre o Account SID e Auth Token no Console da Twilio → Dashboard. O número deve ter capability de SMS habilitada."
          />
        )}

        {provider === 'zenvia' && (
          <ProviderHint
            name="Zenvia"
            hint="Use o token de integração da plataforma Zenvia. O número ou short code deve estar configurado no canal SMS da Zenvia."
          />
        )}

        {provider === 'custom' && (
          <ProviderHint
            name="Custom"
            hint="Para provedores custom, preencha a Base URL da API. O ElosMed fará POST para {base_url}/send com o payload de SMS."
          />
        )}
      </div>
    );
  }

  if (connectionMethod === 'custom_webhook') {
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
              <Ico name="zap" size={18} color={T.primary} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                Gateway SMS Customizado
              </p>
              <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
                Integre com qualquer gateway SMS via API REST. Configure a URL base, endpoint de envio e credenciais.
                Ideal para gateways internos ou provedores regionais.
              </p>
            </div>
          </div>
        </Glass>

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
            O ElosMed enviará um <strong>POST</strong> para <code style={{ fontSize: 11 }}>{'{base_url}/{endpoint}'}</code> com
            body <code style={{ fontSize: 11 }}>{'{"to": "+55...", "message": "..."}'}</code>.
            Configure o webhook inbound para receber respostas dos pacientes.
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
