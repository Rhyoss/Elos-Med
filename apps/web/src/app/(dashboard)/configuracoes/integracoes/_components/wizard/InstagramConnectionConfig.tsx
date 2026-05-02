'use client';

import * as React from 'react';
import { Glass, Btn, Ico, Mono, T } from '@dermaos/ui/ds';
import type { ConnectionMethodId } from '../../_lib/wizard-config';

interface InstagramConnectionConfigProps {
  connectionMethod: ConnectionMethodId | null;
  credentials: Record<string, string>;
  onCredentialChange: (key: string, value: string) => void;
}

interface OAuthCheckItem {
  key: string;
  label: string;
  description: string;
  status: 'pending' | 'done' | 'error';
}

const OAUTH_CHECKLIST: OAuthCheckItem[] = [
  { key: 'meta_login', label: 'Login Meta autorizado', description: 'Autenticação OAuth com Meta Business concluída.', status: 'pending' },
  { key: 'ig_account', label: 'Conta profissional selecionada', description: 'Conta Instagram Professional vinculada ao Business Manager.', status: 'pending' },
  { key: 'page_linked', label: 'Página vinculada confirmada', description: 'Página do Facebook conectada à conta Instagram identificada.', status: 'pending' },
  { key: 'permissions', label: 'Permissões concedidas', description: 'instagram_manage_messages, pages_messaging, pages_read_engagement.', status: 'pending' },
  { key: 'webhook_subscribed', label: 'Webhook inscrito', description: 'Webhook configurado para receber eventos de mensagens do Instagram.', status: 'pending' },
  { key: 'test_inbound', label: 'Teste de recebimento', description: 'DM de teste recebido e processado pelo ElosMed.', status: 'pending' },
];

export function InstagramConnectionConfig({
  connectionMethod,
  credentials,
  onCredentialChange,
}: InstagramConnectionConfigProps) {
  if (connectionMethod === 'oauth_meta') {
    return <InstagramOAuthPanel credentials={credentials} onCredentialChange={onCredentialChange} />;
  }

  return null;
}

function InstagramOAuthPanel({
  credentials,
  onCredentialChange,
}: {
  credentials: Record<string, string>;
  onCredentialChange: (key: string, value: string) => void;
}) {
  const [checklistState, setChecklistState] = React.useState<Record<string, 'pending' | 'done' | 'error'>>(
    () => Object.fromEntries(OAUTH_CHECKLIST.map((c) => [c.key, 'pending']))
  );
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [connectionError, setConnectionError] = React.useState<string | null>(null);

  function handleInstagramConnect() {
    setIsConnecting(true);
    setConnectionError(null);
    // TODO: Implement Meta OAuth flow for Instagram.
    // Should open FB.login with scope: instagram_manage_messages, pages_messaging, pages_read_engagement
    // On success: exchange code for long-lived token, fetch IG accounts, save via backend.
    setTimeout(() => {
      setIsConnecting(false);
      setChecklistState((s) => ({ ...s, meta_login: 'done' }));
    }, 2000);
  }

  function toggleCheckItem(key: string) {
    setChecklistState((s) => ({
      ...s,
      [key]: s[key] === 'done' ? 'pending' : 'done',
    }));
  }

  const completedCount = Object.values(checklistState).filter((v) => v === 'done').length;
  const totalCount = OAUTH_CHECKLIST.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Meta Connect CTA */}
      <Glass style={{ padding: '24px 22px', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #833AB4 0%, #E1306C 50%, #F77737 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ico name="message" size={24} color="#fff" />
          </div>

          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>
              Conectar Instagram
            </p>
            <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 4, maxWidth: 420 }}>
              Conecte sua conta Instagram Professional via Meta OAuth para receber e responder DMs diretamente no ElosMed.
            </p>
          </div>

          <Btn
            variant="primary"
            icon="shield"
            onClick={handleInstagramConnect}
            loading={isConnecting}
            disabled={isConnecting}
          >
            {isConnecting ? 'Conectando...' : 'Conectar Instagram'}
          </Btn>

          <Mono size={10} color={T.textMuted}>
            Você será redirecionado para o Meta Business Suite para autorizar a conexão.
          </Mono>
        </div>
      </Glass>

      {/* Connection error */}
      {connectionError && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: T.r.md,
            background: T.dangerBg,
            border: `1px solid ${T.dangerBorder}`,
            fontSize: 13,
            color: T.danger,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <Ico name="alert" size={14} color={T.danger} style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <strong>Erro de permissão:</strong> {connectionError}
          </div>
        </div>
      )}

      {/* Account info placeholder */}
      {checklistState.meta_login === 'done' && (
        <Glass style={{ padding: '16px 18px' }}>
          <Mono size={10} color={T.textMuted} style={{ marginBottom: 10 }}>
            CONTA CONECTADA
          </Mono>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <InfoRow label="Username" value="@clinica_exemplo" />
            <InfoRow label="Account ID" value="1784140...••••" masked />
            <InfoRow label="Página vinculada" value="Clínica Dermatológica (Pendente)" />
            <InfoRow label="Permissões" value="instagram_manage_messages, pages_messaging" />
            <InfoRow label="Webhook" value="Pendente de configuração" />
          </div>
        </Glass>
      )}

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            background: T.glass,
            border: `1px solid ${T.glassBorder}`,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #833AB4, #E1306C)',
              borderRadius: 3,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <Mono size={10} color={T.textMuted}>
          {completedCount}/{totalCount}
        </Mono>
      </div>

      {/* Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Mono size={10} color={T.textMuted} style={{ marginBottom: 4 }}>
          CHECKLIST DE CONFIGURAÇÃO
        </Mono>

        {OAUTH_CHECKLIST.map((item) => {
          const status = checklistState[item.key];
          const isDone = status === 'done';
          const isError = status === 'error';

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => toggleCheckItem(item.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: T.r.md,
                background: isDone ? T.successBg : isError ? T.dangerBg : T.glass,
                border: `1px solid ${isDone ? T.successBorder : isError ? T.dangerBorder : T.glassBorder}`,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                outline: 'none',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: isDone ? T.success : isError ? T.danger : 'transparent',
                  border: `2px solid ${isDone ? T.success : isError ? T.danger : T.glassBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isDone && <Ico name="check" size={12} color={T.textInverse} />}
                {isError && <Ico name="x" size={12} color={T.textInverse} />}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: isDone ? T.success : isError ? T.danger : T.textPrimary,
                    textDecoration: isDone ? 'line-through' : 'none',
                  }}
                >
                  {item.label}
                </p>
                <p style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Permission warning */}
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
          <strong>Requisitos:</strong> A conta Instagram deve ser Professional (Business ou Creator) e estar vinculada a uma Página do Facebook. Permissões insuficientes resultarão em erro de conexão.
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, masked }: { label: string; value: string; masked?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Mono size={10} color={T.textMuted}>{label}</Mono>
      <span style={{ fontSize: 13, color: T.textPrimary, fontFamily: masked ? 'monospace' : 'inherit' }}>
        {value}
      </span>
    </div>
  );
}
