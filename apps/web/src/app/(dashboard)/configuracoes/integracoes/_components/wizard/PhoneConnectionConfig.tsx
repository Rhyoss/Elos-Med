'use client';

import * as React from 'react';
import { Glass, Ico, Mono, T } from '@dermaos/ui/ds';
import type { ConnectionMethodId } from '../../_lib/wizard-config';

interface PhoneConnectionConfigProps {
  connectionMethod: ConnectionMethodId;
  credentials: Record<string, string>;
  onCredentialChange: (key: string, value: string) => void;
}

export function PhoneConnectionConfig({
  connectionMethod,
  credentials,
}: PhoneConnectionConfigProps) {
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
              <Ico name="phone" size={18} color={T.primary} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                Provedor VoIP
              </p>
              <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
                Conecte com um provedor VoIP para receber e fazer chamadas com gravação automática,
                URA inteligente e transferência de chamadas. Requer número de voz ativo no provedor.
              </p>
            </div>
          </div>
        </Glass>

        {provider === 'twilio' && (
          <ProviderHint
            name="Twilio Voice"
            hint="Use o Account SID e Auth Token do Console Twilio. O número precisa ter capability de Voice habilitada. Configure o TwiML App URL para receber chamadas."
          />
        )}

        {provider === 'vonage' && (
          <ProviderHint
            name="Vonage Voice"
            hint="Use a API Key e API Secret do dashboard Vonage. Configure a Application ID e o número LVN (Long Virtual Number)."
          />
        )}

        {provider === 'totalvoice' && (
          <ProviderHint
            name="Total Voice"
            hint="Use o token de autenticação da API Total Voice. O número DID deve estar ativo e associado à sua conta."
          />
        )}

        {provider === 'custom' && (
          <ProviderHint
            name="Custom"
            hint="Para provedores custom, preencha a Base URL, credenciais e, opcionalmente, o domínio SIP para registro de ramais."
          />
        )}

        <Glass style={{ padding: '14px 16px' }}>
          <Mono size={10} color={T.textMuted} style={{ display: 'block', marginBottom: 8 }}>
            FUNCIONALIDADES COM VOIP
          </Mono>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { icon: 'phone', label: 'Chamadas de entrada e saída via API' },
              { icon: 'activity', label: 'Gravação automática de chamadas' },
              { icon: 'layers', label: 'URA inteligente com Aurora IA' },
              { icon: 'zap', label: 'Transferência e conferência' },
              { icon: 'clock', label: 'Fila de espera e callback' },
            ].map((feat) => (
              <div key={feat.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Ico name={feat.icon as any} size={13} color={T.success} />
                <span style={{ fontSize: 12, color: T.textSecondary }}>{feat.label}</span>
              </div>
            ))}
          </div>
        </Glass>
      </div>
    );
  }

  if (connectionMethod === 'manual_link') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Glass style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: T.r.md,
                background: T.warningBg,
                border: `1px solid ${T.warningBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Ico name="phone" size={18} color={T.warning} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                Discador Manual — Sem integração automática
              </p>
              <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
                Registra o número de telefone da clínica no ElosMed para referência.
                Chamadas são feitas manualmente pelo atendente — sem URA, gravação ou automação.
              </p>
            </div>
          </div>
        </Glass>

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
          <div>
            <p style={{ fontWeight: 600, marginBottom: 2 }}>Limitações do modo manual:</p>
            <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.6 }}>
              <li>Sem gravação automática de chamadas</li>
              <li>Sem URA ou menu de voz automatizado</li>
              <li>Sem registro de chamadas no inbox</li>
              <li>Sem transferência automatizada</li>
            </ul>
          </div>
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
