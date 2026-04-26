'use client';

import * as React from 'react';
import {
  Glass, Btn, Mono, Badge, MetalTag, Ico,
  PageHero, T, type ShellModule,
} from '@dermaos/ui/ds';

/**
 * Configurações — usuários, RBAC, integrações & compliance.
 *
 * Phase-4 deliverable: layout 1:1 com o reference (RBAC + Integrações +
 * compliance metal banner), mock data até Phase 5 ligar tRPC
 * `settings.*` (Prompt 19 cobre o backend; sub-rotas
 * `/configuracoes/usuarios|servicos|integracoes|ia|auditoria` já
 * existem com legacy chrome).
 */
export default function ConfiguracoesPage() {
  const users: Array<{
    name: string;
    role: string;
    email: string;
    perms: string[];
  }> = [
    { name: 'Dra. Ana Souza',     role: 'Dermatologista', email: 'ana@clinica.com',     perms: ['prontuário', 'prescrição', 'protocolo'] },
    { name: 'Dr. Carlos Lima',    role: 'Dermatologista', email: 'lima@clinica.com',    perms: ['prontuário', 'prescrição'] },
    { name: 'Marina Recepção',    role: 'Recepcionista',  email: 'marina@clinica.com',  perms: ['agenda', 'comunicação'] },
    { name: 'Roberto Admin',      role: 'Gestor',         email: 'roberto@clinica.com', perms: ['financeiro', 'analytics', 'configurações'] },
  ];

  const integrations: Array<{
    name: string;
    st: 'Conectado' | 'Pendente';
    icon: 'message' | 'creditCard' | 'shield' | 'zap' | 'box';
    mod: ShellModule;
  }> = [
    { name: 'WhatsApp Business API',     st: 'Conectado', icon: 'message',    mod: 'aiMod' },
    { name: 'Gateway de Pagamento',       st: 'Conectado', icon: 'creditCard', mod: 'financial' },
    { name: 'ANVISA — Rastreabilidade',   st: 'Conectado', icon: 'shield',     mod: 'supply' },
    { name: 'Claude API — Aurora IA',     st: 'Conectado', icon: 'zap',        mod: 'aiMod' },
    { name: 'MinIO — Storage S3',          st: 'Conectado', icon: 'box',        mod: 'supply' },
    { name: 'Instagram API',               st: 'Pendente',  icon: 'message',    mod: 'aiMod' },
  ];

  const compliance = [
    { l: 'LGPD Ativo',          d: 'Consentimentos atualizados' },
    { l: 'ANVISA Rastreável',   d: 'SHA-256 + PDF auditável' },
    { l: 'AES-256-GCM',         d: 'Dados cifrados' },
    { l: 'JWT httpOnly',        d: 'Sessões seguras' },
    { l: 'RLS Multi-tenant',    d: 'Isolamento por tenant' },
    { l: 'Auditoria imutável',  d: 'Logs append-only' },
  ];

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '22px 26px' }}>
      <PageHero
        eyebrow="USUÁRIOS, RBAC & INTEGRAÇÕES"
        title="Configurações"
        icon="settings"
        actions={<Btn small icon="plus">Novo usuário</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        {/* Usuários & RBAC */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '12px 18px',
              borderBottom: `1px solid ${T.divider}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Ico name="users" size={14} color={T.primary} />
              <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Usuários &amp; RBAC</span>
            </div>
            <MetalTag>LGPD</MetalTag>
          </div>
          {users.map((u, i) => (
            <div
              key={u.email}
              style={{
                padding: '11px 18px',
                borderBottom: i < users.length - 1 ? `1px solid ${T.divider}` : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>{u.name}</p>
                  <Mono size={8}>{u.role} · {u.email}</Mono>
                </div>
                <Badge variant="success">Ativo</Badge>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {u.perms.map((p) => <MetalTag key={p}>{p}</MetalTag>)}
              </div>
            </div>
          ))}
        </Glass>

        {/* Integrações */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '12px 18px',
              borderBottom: `1px solid ${T.divider}`,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
            }}
          >
            <Ico name="layers" size={14} color={T.aiMod.color} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Integrações</span>
          </div>
          {integrations.map((intg, i) => {
            const m = T[intg.mod];
            return (
              <div
                key={intg.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 18px',
                  borderBottom: i < integrations.length - 1 ? `1px solid ${T.divider}` : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: T.r.sm,
                      background: m.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ico name={intg.icon} size={12} color={m.color} />
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: T.textPrimary }}>{intg.name}</p>
                </div>
                <Badge variant={intg.st === 'Conectado' ? 'success' : 'warning'}>{intg.st}</Badge>
              </div>
            );
          })}
        </Glass>
      </div>

      {/* Compliance & Segurança */}
      <Glass metal style={{ padding: '18px 22px' }}>
        <Mono size={9} spacing="1.3px" color={T.primary}>COMPLIANCE &amp; SEGURANÇA</Mono>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {compliance.map((c) => (
            <div
              key={c.l}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: T.r.md,
                background: T.primaryBg,
                border: `1px solid ${T.primaryBorder}`,
              }}
            >
              <Ico name="shield" size={14} color={T.primary} />
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary }}>{c.l}</p>
                <Mono size={7}>{c.d}</Mono>
              </div>
            </div>
          ))}
        </div>
      </Glass>
    </div>
  );
}
