'use client';

import * as React from 'react';
import { Glass, Btn, Ico, Mono, T } from '@dermaos/ui/ds';
import type { ConnectionMethodId } from '../../_lib/wizard-config';

interface FacebookConnectionConfigProps {
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
  { key: 'page_selected', label: 'Página selecionada', description: 'Página do Facebook com Messenger habilitado selecionada.', status: 'pending' },
  { key: 'page_token', label: 'Page Token salvo', description: 'Page Access Token de longa duração armazenado via backend.', status: 'pending' },
  { key: 'webhook_subscribed', label: 'Webhooks assinados', description: 'Inscrição ativa para messages, messaging_postbacks, messaging_optins.', status: 'pending' },
  { key: 'test_inbound', label: 'Teste inbound', description: 'Mensagem recebida pelo Messenger e processada pelo ElosMed.', status: 'pending' },
  { key: 'test_outbound', label: 'Teste outbound', description: 'Mensagem enviada pelo ElosMed e entregue ao destinatário.', status: 'pending' },
];

export function FacebookConnectionConfig({
  connectionMethod,
  credentials,
  onCredentialChange,
}: FacebookConnectionConfigProps) {
  if (connectionMethod === 'oauth_meta') {
    return <FacebookOAuthPanel credentials={credentials} onCredentialChange={onCredentialChange} />;
  }

  return null;
}

function FacebookOAuthPanel({
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
  const [pages, setPages] = React.useState<{ id: string; name: string }[]>([]);
  const [selectedPage, setSelectedPage] = React.useState<string | null>(null);

  function handleFacebookConnect() {
    setIsConnecting(true);
    setConnectionError(null);
    // TODO: Implement Meta OAuth flow for Facebook Messenger.
    // Should open FB.login with scope: pages_messaging, pages_manage_metadata, pages_read_engagement
    // On success: fetch user's pages, let user select, exchange for page token, subscribe webhooks.
    setTimeout(() => {
      setIsConnecting(false);
      setChecklistState((s) => ({ ...s, meta_login: 'done' }));
      setPages([
        { id: '100200300...', name: 'Clínica Dermatológica Centro' },
        { id: '100200300...', name: 'Clínica Dermatológica Norte' },
      ]);
    }, 2000);
  }

  function handleSelectPage(pageId: string) {
    setSelectedPage(pageId);
    setChecklistState((s) => ({ ...s, page_selected: 'done' }));
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
              background: 'linear-gradient(135deg, #0668E1 0%, #0080FB 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ico name="message" size={24} color="#fff" />
          </div>

          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>
              Conectar Página
            </p>
            <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 4, maxWidth: 420 }}>
              Conecte a página do Facebook da sua clínica para receber e responder mensagens do Messenger diretamente no ElosMed.
            </p>
          </div>

          <Btn
            variant="primary"
            icon="shield"
            onClick={handleFacebookConnect}
            loading={isConnecting}
            disabled={isConnecting}
          >
            {isConnecting ? 'Conectando...' : 'Conectar Página'}
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

      {/* Page selector */}
      {pages.length > 0 && (
        <Glass style={{ padding: '16px 18px' }}>
          <Mono size={10} color={T.textMuted} style={{ marginBottom: 10 }}>
            SELECIONAR PÁGINA
          </Mono>
          <p style={{ fontSize: 13, color: T.textSecondary, marginBottom: 12 }}>
            Selecione a página do Facebook que receberá mensagens no ElosMed.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pages.map((page) => {
              const isSelected = selectedPage === page.id;
              return (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => handleSelectPage(page.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: T.r.md,
                    background: isSelected ? T.primaryBg : T.glass,
                    border: `1.5px solid ${isSelected ? T.primary : T.glassBorder}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    outline: 'none',
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: `2px solid ${isSelected ? T.primary : T.glassBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && (
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: T.primary }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary }}>{page.name}</p>
                    <Mono size={10} color={T.textMuted}>ID: {page.id}</Mono>
                  </div>
                </button>
              );
            })}
          </div>
        </Glass>
      )}

      {/* Connected page info */}
      {selectedPage && (
        <Glass style={{ padding: '16px 18px' }}>
          <Mono size={10} color={T.textMuted} style={{ marginBottom: 10 }}>
            PÁGINA CONECTADA
          </Mono>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <InfoRow label="Página" value={pages.find((p) => p.id === selectedPage)?.name ?? ''} />
            <InfoRow label="Page ID" value={selectedPage} masked />
            <InfoRow label="Page Token" value="Salvo via backend (criptografado)" />
            <InfoRow label="Webhooks" value="messages, messaging_postbacks, messaging_optins" />
            <InfoRow label="Status" value="Pendente de teste" />
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

      {/* Info notice */}
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
        <Ico name="message" size={14} color={T.primary} style={{ marginTop: 1, flexShrink: 0 }} />
        <div>
          <strong>Nota:</strong> Instagram e Facebook podem pertencer ao mesmo Meta Business, mas cada canal mantém status de conexão independente. A desconexão de um não afeta o outro.
        </div>
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
          <strong>TODO técnico:</strong> O fluxo OAuth requer integração com o Facebook JavaScript SDK (FB.login com scope pages_messaging + pages_manage_metadata) e endpoint backend para trocar code por page token, salvar credenciais e assinar webhooks. Implementação pendente.
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
