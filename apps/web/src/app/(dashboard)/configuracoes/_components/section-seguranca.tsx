'use client';

import * as React from 'react';
import { Glass, Mono, Ico, MetalTag, T } from '@dermaos/ui/ds';
import { useAuth } from '@/lib/auth';

const COMPLIANCE_ITEMS: Array<{ label: string; description: string; icon: import('@dermaos/ui/ds').IcoName; status: 'active' }> = [
  { label: 'LGPD Ativo', description: 'Consentimentos e anonimização conformes à Lei Geral de Proteção de Dados', icon: 'shield', status: 'active' },
  { label: 'ANVISA Rastreável', description: 'Rastreabilidade de lotes com SHA-256 e PDF auditável', icon: 'shield', status: 'active' },
  { label: 'AES-256-GCM', description: 'Criptografia autenticada para credenciais, tokens e dados sensíveis', icon: 'lock', status: 'active' },
  { label: 'JWT httpOnly', description: 'Sessões com tokens httpOnly, jti para revogação e pv para invalidação por senha', icon: 'lock', status: 'active' },
  { label: 'RLS Multi-tenant', description: 'Isolamento de dados por clínica via Row Level Security no PostgreSQL', icon: 'shield', status: 'active' },
  { label: 'Auditoria Imutável', description: 'Logs append-only em audit.domain_events com sanitização de PII', icon: 'file', status: 'active' },
  { label: 'Rate Limiting', description: 'Limites por IP e path no nginx + hook Fastify para tRPC', icon: 'zap', status: 'active' },
  { label: 'Blind Index', description: 'HMAC para busca por nome sem expor dados em texto claro', icon: 'search', status: 'active' },
];

const PASSWORD_POLICY = [
  { rule: 'Mínimo 12 caracteres', met: true },
  { rule: 'Hash Argon2id com salt aleatório', met: true },
  { rule: 'Bloqueio após 5 tentativas falhas', met: true },
  { rule: 'Reset por e-mail com token SHA-256, expira em 1h', met: true },
  { rule: 'Invalidação de tokens anteriores ao redefinir', met: true },
];

const SESSION_FEATURES = [
  { label: 'Token de acesso', value: '15 min', description: 'Access token JWT com expiração curta' },
  { label: 'Token de refresh', value: '7 dias', description: 'Refresh token httpOnly com rotação' },
  { label: 'Session ID (jti)', value: 'UUID v4', description: 'Identificador único para revogação individual' },
  { label: 'Password version (pv)', value: 'Auto', description: 'Invalida todos os tokens ao alterar senha' },
  { label: 'Idle timeout', value: '30 min', description: 'Sessão expirada por inatividade' },
  { label: 'Multi-device', value: 'Suportado', description: 'Cada dispositivo tem sessão independente' },
];

export function SectionSeguranca() {
  const { user } = useAuth();
  const isPrivileged = user?.role === 'owner' || user?.role === 'admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Compliance */}
      <Glass style={{ padding: '24px 28px' }}>
        <Mono size={10} spacing="1.1px" color={T.primary}>COMPLIANCE & CERTIFICAÇÕES</Mono>
        <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 4, marginBottom: 20 }}>
          Status de conformidade e mecanismos de segurança ativos
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {COMPLIANCE_ITEMS.map((item) => (
            <div
              key={item.label}
              style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '14px 16px', borderRadius: T.r.md,
                background: T.primaryBg, border: `1px solid ${T.primaryBorder}`,
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: T.r.sm,
                background: T.primary, display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Ico name={item.icon} size={16} color="#fff" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{item.label}</p>
                <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 2, lineHeight: 1.4 }}>{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Glass>

      {/* Política de Senha */}
      <Glass style={{ padding: '24px 28px' }}>
        <Mono size={10} spacing="1.1px" color={T.primary}>POLÍTICA DE SENHA</Mono>
        <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 4, marginBottom: 20 }}>
          Requisitos aplicados automaticamente pelo sistema
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PASSWORD_POLICY.map((p) => (
            <div
              key={p.rule}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: T.r.sm,
                background: 'rgba(0,0,0,0.02)', border: `1px solid ${T.divider}`,
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: T.successBg, border: `1px solid ${T.successBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ico name="check" size={12} color={T.success} />
              </div>
              <span style={{ fontSize: 14, color: T.textPrimary }}>{p.rule}</span>
            </div>
          ))}
        </div>
      </Glass>

      {/* Sessões */}
      <Glass style={{ padding: '24px 28px' }}>
        <Mono size={10} spacing="1.1px" color={T.primary}>CONFIGURAÇÃO DE SESSÕES</Mono>
        <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 4, marginBottom: 20 }}>
          Parâmetros de autenticação e gerenciamento de sessões
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {SESSION_FEATURES.map((f) => (
            <div
              key={f.label}
              style={{
                padding: '14px 16px', borderRadius: T.r.md,
                background: T.inputBg, border: `1px solid ${T.divider}`,
              }}
            >
              <Mono size={9} spacing="1px" color={T.textMuted}>{f.label.toUpperCase()}</Mono>
              <p style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary, marginTop: 6, fontFamily: "'IBM Plex Mono', monospace" }}>
                {f.value}
              </p>
              <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>{f.description}</p>
            </div>
          ))}
        </div>
      </Glass>

      {/* TLS/HSTS */}
      <Glass metal style={{ padding: '18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Ico name="lock" size={18} color={T.primary} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>TLS 1.3 / HSTS</p>
            <p style={{ fontSize: 12, color: T.textSecondary }}>
              Todas as conexões são protegidas por TLS 1.3 com HSTS habilitado. Headers de segurança (CSP, X-Frame-Options, X-Content-Type-Options) configurados no nginx.
            </p>
          </div>
          <MetalTag style={{ marginLeft: 'auto' }}>ENFORCED</MetalTag>
        </div>
      </Glass>
    </div>
  );
}
