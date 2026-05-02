'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Ico, Mono, PageHero, T, type IcoName } from '@dermaos/ui/ds';
import { useAuth, usePermission } from '@/lib/auth';

interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: IcoName;
  adminOnly?: boolean;
  ownerOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'clinica',     href: '/configuracoes',           label: 'Clínica',         icon: 'home'    },
  { id: 'usuarios',    href: '/configuracoes/usuarios',  label: 'Usuários & RBAC', icon: 'users',  adminOnly: true },
  { id: 'servicos',    href: '/configuracoes/servicos',  label: 'Serviços',        icon: 'box',    adminOnly: true },
  { id: 'integracoes', href: '/configuracoes/integracoes', label: 'Integrações',   icon: 'layers', ownerOnly: true },
  { id: 'seguranca',   href: '/configuracoes/seguranca', label: 'Segurança',       icon: 'shield'  },
  { id: 'auditoria',   href: '/configuracoes/auditoria', label: 'Auditoria',       icon: 'file',   adminOnly: true },
  { id: 'ia',          href: '/configuracoes/ia',        label: 'Aurora IA',       icon: 'zap',    adminOnly: true },
  { id: 'aparencia',   href: '/configuracoes/aparencia', label: 'Aparência',       icon: 'grid'    },
];

const SECTION_DESCRIPTIONS: Record<string, string> = {
  clinica:     'Dados cadastrais, endereço, horários de funcionamento e LGPD',
  usuarios:    'Gerenciamento de usuários, convites e matriz de permissões',
  servicos:    'Catálogo de procedimentos, valores e configurações por serviço',
  integracoes: 'WhatsApp, e-mail, webhooks e conexões com serviços externos',
  seguranca:   'Compliance, política de senha, sessões e criptografia',
  auditoria:   'Logs de eventos, rastreabilidade e exportação de relatórios',
  ia:          'Configuração da Aurora IA, modelo, prompt e histórico',
  aparencia:   'Logo, paleta de cores, tipografia e superfícies do sistema',
};

function resolveActiveSection(pathname: string): string {
  if (pathname.startsWith('/configuracoes/integracoes')) return 'integracoes';
  if (pathname.startsWith('/configuracoes/usuarios'))    return 'usuarios';
  if (pathname.startsWith('/configuracoes/servicos'))    return 'servicos';
  if (pathname.startsWith('/configuracoes/seguranca'))   return 'seguranca';
  if (pathname.startsWith('/configuracoes/auditoria'))   return 'auditoria';
  if (pathname.startsWith('/configuracoes/ia'))          return 'ia';
  if (pathname.startsWith('/configuracoes/aparencia'))   return 'aparencia';
  return 'clinica';
}

interface ConfiguracoesLayoutProps {
  children: React.ReactNode;
}

export default function ConfiguracoesLayout({ children }: ConfiguracoesLayoutProps) {
  const pathname      = usePathname();
  const { user }      = useAuth();
  const canAdmin      = usePermission('admin', 'read');
  const isOwner       = user?.role === 'owner';
  const isAdmin       = user?.role === 'admin' || isOwner;
  const activeSection = resolveActiveSection(pathname);

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.ownerOnly && !isOwner) return false;
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  const activeItem = NAV_ITEMS.find((n) => n.id === activeSection);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Page-level hero — shared across all configuracoes sections */}
      <div style={{ padding: '22px 26px 0' }}>
        <PageHero
          eyebrow="CENTRO ADMINISTRATIVO"
          title="Configurações"
          icon="settings"
          description="Administre clínica, usuários, serviços, integrações e segurança"
        />
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden', minHeight: 0 }}>
        {/* Sidebar */}
        <nav
          aria-label="Seções de configuração"
          style={{
            width: 'max-content',
            flexShrink: 0,
            borderRight: `1px solid ${T.divider}`,
            overflowY: 'auto',
            padding: '12px 0',
          }}
        >
          {visibleNav.map((item) => {
            const isActive = item.id === activeSection;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 19px 12px 20px',
                  textDecoration: 'none',
                  background:   isActive ? T.primaryBg : 'transparent',
                  borderLeft:   isActive ? `3px solid ${T.primary}` : '3px solid transparent',
                  color:        isActive ? T.primary : T.textSecondary,
                  transition:   'all 0.15s',
                }}
              >
                <Ico name={item.icon} size={16} color={isActive ? T.primary : T.textMuted} />
                <span
                  style={{
                    fontSize:   14,
                    fontWeight: isActive ? 600 : 400,
                    fontFamily: "'IBM Plex Sans', sans-serif",
                  }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 26px 26px' }}>
          {/* Section header */}
          <div
            style={{
              padding: '20px 0 16px',
              borderBottom: `1px solid ${T.divider}`,
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Ico name={activeItem?.icon ?? 'settings'} size={20} color={T.primary} />
              <h2 style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>
                {activeItem?.label ?? 'Configurações'}
              </h2>
            </div>
            {SECTION_DESCRIPTIONS[activeSection] && (
              <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 4, marginLeft: 30 }}>
                {SECTION_DESCRIPTIONS[activeSection]}
              </p>
            )}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
