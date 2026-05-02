'use client';

import * as React from 'react';
import { Glass, Ico, Mono, Btn, T } from '@dermaos/ui/ds';
import type { ConnectionMethodId } from '../../_lib/wizard-config';

interface EmailConnectionConfigProps {
  connectionMethod: ConnectionMethodId;
  credentials: Record<string, string>;
  onCredentialChange: (key: string, value: string) => void;
}

export function EmailConnectionConfig({
  connectionMethod,
}: EmailConnectionConfigProps) {
  if (connectionMethod === 'oauth_google') {
    return <OAuthPanel provider="Google Workspace / Gmail" icon="mail" />;
  }

  if (connectionMethod === 'oauth_microsoft') {
    return <OAuthPanel provider="Microsoft 365 / Outlook" icon="mail" />;
  }

  if (connectionMethod === 'manual_config') {
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
              <Ico name="mail" size={18} color={T.primary} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                SMTP / IMAP — Configuração Manual
              </p>
              <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
                Configure o servidor SMTP para envio e, opcionalmente, IMAP para recebimento de e-mails.
                Funciona com Gmail, Outlook, Yahoo, e qualquer servidor que suporte estes protocolos.
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
          <Ico name="shield" size={14} color={T.warning} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            Para Gmail e Outlook, recomendamos usar <strong>App Passwords</strong> em vez da senha principal.
            Ative a verificação em duas etapas e gere uma senha de app nas configurações de segurança da sua conta.
          </span>
        </div>
      </div>
    );
  }

  if (connectionMethod === 'external_bsp') {
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
            <Ico name="globe" size={18} color={T.primary} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
              Provedor Transacional
            </p>
            <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
              Serviços transacionais oferecem alta taxa de entrega e suporte a domínios verificados.
              O domínio do remetente precisa estar configurado e verificado no painel do provedor (SPF/DKIM/DMARC).
            </p>
          </div>
        </div>
      </Glass>
    );
  }

  return null;
}

function OAuthPanel({ provider, icon }: { provider: string; icon: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* TODO: Implement OAuth 2.0 flow when backend supports Google/Microsoft OAuth for email */}
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
          A conexão OAuth 2.0 com <strong>{provider}</strong> ainda não está disponível.
          O backend precisa implementar o fluxo de autorização OAuth, troca de tokens e refresh automático.
        </p>
      </div>

      <Glass style={{ padding: '16px 18px' }}>
        <Mono size={10} color={T.textMuted} style={{ display: 'block', marginBottom: 10 }}>
          FLUXO PREVISTO
        </Mono>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { step: '1', label: 'Autorizar acesso', desc: `Clique em "Conectar" e autorize o ElosMed na tela de login do ${provider}.` },
            { step: '2', label: 'Selecionar conta', desc: 'Escolha a conta de e-mail que será usada para envio e recebimento.' },
            { step: '3', label: 'Permissões', desc: 'O ElosMed solicitará permissões para ler e enviar e-mails em nome da conta.' },
            { step: '4', label: 'Testar conexão', desc: 'Validação automática de envio e recebimento.' },
          ].map((item) => (
            <div key={item.step} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: T.glass,
                  border: `1px solid ${T.glassBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted }}>{item.step}</span>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary }}>{item.label}</p>
                <p style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{item.desc}</p>
              </div>
            </div>
          ))}
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
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Ico name="shield" size={14} color={T.info} />
        Enquanto isso, use <strong style={{ margin: '0 4px' }}>SMTP/IMAP Manual</strong> ou um
        <strong style={{ margin: '0 4px' }}>Provedor Transacional</strong> para conectar e-mails.
      </div>
    </div>
  );
}
