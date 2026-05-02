'use client';

import * as React from 'react';
import { Glass, Mono, Ico, PageHero, T, type IcoName } from '@dermaos/ui/ds';
import { useAuth, usePermission } from '@/lib/auth';
import { SectionClinica } from './_components/section-clinica';
import { SectionUsuarios } from './_components/section-usuarios';
import { SectionServicos } from './_components/section-servicos';
import { SectionIntegracoes } from './_components/section-integracoes';
import { SectionSeguranca } from './_components/section-seguranca';
import { SectionAuditoria } from './_components/section-auditoria';
import { SectionIA } from './_components/section-ia';
import { SectionAparencia } from './_components/section-aparencia';

interface NavItem {
  id: string;
  label: string;
  icon: IcoName;
  adminOnly?: boolean;
  ownerOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'clinica',      label: 'Clínica',           icon: 'home' },
  { id: 'usuarios',     label: 'Usuários & RBAC',   icon: 'users',     adminOnly: true },
  { id: 'servicos',     label: 'Serviços',          icon: 'box',       adminOnly: true },
  { id: 'integracoes',  label: 'Integrações',       icon: 'layers',    ownerOnly: true },
  { id: 'seguranca',    label: 'Segurança',         icon: 'shield' },
  { id: 'auditoria',    label: 'Auditoria',         icon: 'file',      adminOnly: true },
  { id: 'ia',           label: 'Aurora IA',         icon: 'zap',       adminOnly: true },
  { id: 'aparencia',    label: 'Aparência',         icon: 'grid' },
];

const SECTION_DESCRIPTIONS: Record<string, string> = {
  clinica: 'Dados cadastrais, endereço, horários de funcionamento e LGPD',
  usuarios: 'Gerenciamento de usuários, convites e matriz de permissões',
  servicos: 'Catálogo de procedimentos, valores e configurações por serviço',
  integracoes: 'WhatsApp, e-mail, webhooks e conexões com serviços externos',
  seguranca: 'Compliance, política de senha, sessões e criptografia',
  auditoria: 'Logs de eventos, rastreabilidade e exportação de relatórios',
  ia: 'Configuração da Aurora IA, modelo, prompt e histórico',
  aparencia: 'Logo, paleta de cores, tipografia e superfícies do sistema',
};

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const canAdmin = usePermission('admin', 'read');
  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'admin' || isOwner;

  const [activeSection, setActiveSection] = React.useState('clinica');

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.ownerOnly && !isOwner) return false;
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  React.useEffect(() => {
    if (!visibleNav.find((n) => n.id === activeSection)) {
      setActiveSection(visibleNav[0]?.id ?? 'clinica');
    }
  }, [visibleNav, activeSection]);

  function renderSection() {
    switch (activeSection) {
      case 'clinica':     return <SectionClinica />;
      case 'usuarios':    return <SectionUsuarios />;
      case 'servicos':    return <SectionServicos />;
      case 'integracoes': return <SectionIntegracoes />;
      case 'seguranca':   return <SectionSeguranca />;
      case 'auditoria':   return <SectionAuditoria />;
      case 'ia':          return <SectionIA />;
      case 'aparencia':   return <SectionAparencia />;
      default:            return <SectionClinica />;
    }
  }

  const activeItem = NAV_ITEMS.find((n) => n.id === activeSection);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
            width: 240, flexShrink: 0, borderRight: `1px solid ${T.divider}`,
            overflowY: 'auto', padding: '12px 0',
          }}
        >
          {visibleNav.map((item) => {
            const isActive = item.id === activeSection;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 20px', border: 'none',
                  background: isActive ? T.primaryBg : 'transparent',
                  borderLeft: isActive ? `3px solid ${T.primary}` : '3px solid transparent',
                  cursor: 'pointer', transition: 'all 0.15s',
                  color: isActive ? T.primary : T.textSecondary,
                }}
              >
                <Ico name={item.icon} size={16} color={isActive ? T.primary : T.textMuted} />
                <span style={{
                  fontSize: 14, fontWeight: isActive ? 600 : 400,
                  fontFamily: "'IBM Plex Sans', sans-serif",
                }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 26px 26px' }}>
          {/* Section Header */}
          <div style={{ padding: '20px 0 16px', borderBottom: `1px solid ${T.divider}`, marginBottom: 20 }}>
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

          {renderSection()}
        </div>
      </div>
    </div>
  );
}
