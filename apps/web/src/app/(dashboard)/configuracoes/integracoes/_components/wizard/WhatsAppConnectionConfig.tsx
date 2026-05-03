'use client';

import * as React from 'react';
import { Glass, Btn, Ico, Mono, Input, Toggle, T, Field } from '@dermaos/ui/ds';
import type { ConnectionMethodId } from '../../_lib/wizard-config';

// ── Types ──────────────────────────────────────────────────────────

interface EmbeddedSignupCheckItem {
  key: string;
  label: string;
  description: string;
  status: 'pending' | 'done' | 'error';
}

interface WhatsAppConnectionConfigProps {
  connectionMethod: ConnectionMethodId | null;
  credentials: Record<string, string>;
  onCredentialChange: (key: string, value: string) => void;
}

// ── Embedded Signup Checklist ──────────────────────────────────────

const EMBEDDED_SIGNUP_CHECKLIST: EmbeddedSignupCheckItem[] = [
  { key: 'business_account', label: 'Conta Business verificada', description: 'Conta Meta Business Manager verificada e ativa.', status: 'pending' },
  { key: 'waba_id', label: 'WABA ID configurado', description: 'WhatsApp Business Account ID gerado após Embedded Signup.', status: 'pending' },
  { key: 'phone_number_id', label: 'Phone Number ID vinculado', description: 'Número registrado na Cloud API com ID disponível.', status: 'pending' },
  { key: 'phone_verified', label: 'Número verificado', description: 'Verificação por SMS ou chamada de voz concluída.', status: 'pending' },
  { key: 'webhook_configured', label: 'Webhook configurado', description: 'URL de callback registrada no painel Meta for Developers.', status: 'pending' },
  { key: 'test_send', label: 'Teste de envio', description: 'Mensagem de teste enviada com sucesso para número autorizado.', status: 'pending' },
  { key: 'test_receive', label: 'Teste de recebimento', description: 'Mensagem recebida pelo webhook e processada pelo ElosMed.', status: 'pending' },
];

export function WhatsAppConnectionConfig({
  connectionMethod,
  credentials,
  onCredentialChange,
}: WhatsAppConnectionConfigProps) {
  // Embedded Signup ainda não tem o redirect OAuth implementado, então tanto
  // ele quanto manual_config caem no mesmo formulário simplificado de 4
  // campos — os únicos exigidos pelo backend (`updateCredential`).
  if (connectionMethod === 'embedded_signup' || connectionMethod === 'manual_config') {
    return <ManualWhatsAppForm credentials={credentials} onCredentialChange={onCredentialChange} />;
  }

  if (connectionMethod === 'manual_link') {
    return <ManualLinkWarning />;
  }

  return null;
}

// ── Formulário manual (4 campos exigidos pelo backend) ────────────

function ManualWhatsAppForm({
  credentials,
  onCredentialChange,
}: {
  credentials: Record<string, string>;
  onCredentialChange: (key: string, value: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Glass style={{ padding: '16px 18px' }}>
        <p style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.55 }}>
          Cole as credenciais do <strong>Meta Business Manager</strong> →
          WhatsApp → Configuração → API. Os campos sensíveis são cifrados em
          AES-256-GCM antes de persistir.
        </p>
      </Glass>

      <Field label="Phone Number ID" required>
        <Input
          value={credentials['phoneNumberId'] ?? ''}
          onChange={(e) => onCredentialChange('phoneNumberId', e.target.value)}
          placeholder="ex: 100200300400500"
        />
      </Field>

      <Field label="Access Token (permanente)" required>
        <Input
          type="password"
          value={credentials['accessToken'] ?? ''}
          onChange={(e) => onCredentialChange('accessToken', e.target.value)}
          placeholder="EAA..."
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        />
      </Field>

      <Field label="App Secret (HMAC dos webhooks)" required>
        <Input
          type="password"
          value={credentials['appSecret'] ?? ''}
          onChange={(e) => onCredentialChange('appSecret', e.target.value)}
          placeholder="Secret do app Meta"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        />
      </Field>

      <Field label="Verify Token (handshake GET)" required>
        <Input
          value={credentials['verifyToken'] ?? ''}
          onChange={(e) => onCredentialChange('verifyToken', e.target.value)}
          placeholder="Você define este valor no painel Meta"
        />
      </Field>

      <Mono size={10} color={T.textMuted}>
        Onde encontrar: Phone Number ID e Access Token ficam em
        Meta for Developers → Sua App → WhatsApp → API Setup. App Secret em
        App → Configurações → Básico. Verify Token é definido por você no
        painel de Webhooks.
      </Mono>
    </div>
  );
}

// ── Embedded Signup Panel ──────────────────────────────────────────

function EmbeddedSignupPanel({
  credentials,
  onCredentialChange,
}: {
  credentials: Record<string, string>;
  onCredentialChange: (key: string, value: string) => void;
}) {
  const [checklistState, setChecklistState] = React.useState<Record<string, 'pending' | 'done' | 'error'>>(
    () => Object.fromEntries(EMBEDDED_SIGNUP_CHECKLIST.map((c) => [c.key, 'pending']))
  );
  const [isConnecting, setIsConnecting] = React.useState(false);

  function handleMetaConnect() {
    setIsConnecting(true);
    // TODO: Implement Meta Embedded Signup OAuth flow.
    // This should open Meta's Embedded Signup dialog via Facebook SDK (FB.login)
    // and handle the callback to extract WABA ID, Phone Number ID, and token.
    // For now we simulate the flow with a timeout.
    setTimeout(() => {
      setIsConnecting(false);
      setChecklistState((s) => ({ ...s, business_account: 'done' }));
    }, 2000);
  }

  function toggleCheckItem(key: string) {
    setChecklistState((s) => ({
      ...s,
      [key]: s[key] === 'done' ? 'pending' : 'done',
    }));
  }

  const completedCount = Object.values(checklistState).filter((v) => v === 'done').length;
  const totalCount = EMBEDDED_SIGNUP_CHECKLIST.length;
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
              background: 'linear-gradient(135deg, #0668E1 0%, #0080FB 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ico name="shield" size={24} color="#fff" />
          </div>

          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>
              Conectar com Meta
            </p>
            <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 4, maxWidth: 420 }}>
              O Embedded Signup conecta automaticamente sua conta Meta Business, configura o WABA e vincula o número verificado.
            </p>
          </div>

          <Btn
            variant="primary"
            icon="shield"
            onClick={handleMetaConnect}
            loading={isConnecting}
            disabled={isConnecting}
          >
            {isConnecting ? 'Conectando...' : 'Conectar com Meta'}
          </Btn>

          <Mono size={10} color={T.textMuted}>
            Você será redirecionado para o Meta Business Suite para autorizar a conexão.
          </Mono>
        </div>
      </Glass>

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
              background: T.primaryGrad,
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

        {EMBEDDED_SIGNUP_CHECKLIST.map((item) => {
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

      {/* TODO notice */}
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
          <strong>TODO técnico:</strong> O fluxo de Embedded Signup requer a integração com o Facebook JavaScript SDK (FB.login com scope whatsapp_business_management) e um endpoint backend para trocar o code por token permanente e registrar o webhook. Implementação pendente.
        </div>
      </div>
    </div>
  );
}

// ── Manual Link Warning ────────────────────────────────────────────

function ManualLinkWarning() {
  return (
    <div
      style={{
        padding: '20px 22px',
        borderRadius: T.r.lg,
        background: T.warningBg,
        border: `1.5px solid ${T.warningBorder}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Ico name="alert" size={20} color={T.warning} />
        <p style={{ fontSize: 14, fontWeight: 600, color: T.warning }}>
          Modo sem integração de API
        </p>
      </div>

      <p style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6 }}>
        Este modo apenas gera um link <code style={{ fontSize: 12, background: 'rgba(0,0,0,0.04)', padding: '1px 4px', borderRadius: 3 }}>wa.me/</code> que
        abre o WhatsApp manualmente no dispositivo do paciente.
      </p>

      <div
        style={{
          padding: '12px 14px',
          borderRadius: T.r.md,
          background: 'rgba(255,255,255,0.6)',
          border: `1px solid ${T.warningBorder}`,
          fontSize: 13,
          color: T.danger,
          fontWeight: 500,
          lineHeight: 1.5,
        }}
      >
        Este modo abre o WhatsApp manualmente e não recebe mensagens no inbox.
      </div>

      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: T.textSecondary, lineHeight: 1.8 }}>
        <li>Mensagens enviadas pelo paciente <strong>não</strong> aparecem no inbox do ElosMed.</li>
        <li>Não há rastreamento de entrega, leitura ou resposta.</li>
        <li>Não é possível usar Aurora IA ou roteamento automático.</li>
        <li>Indicado apenas para clínicas que ainda não possuem WABA ou BSP configurado.</li>
      </ul>
    </div>
  );
}
