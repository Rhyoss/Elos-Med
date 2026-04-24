'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  AppShell,
  CommandPalette,
  type CommandItem,
  type NavItem,
} from '@dermaos/ui';
import {
  Home, Users, Calendar, MessageSquare,
  Package, DollarSign, BarChart3, Settings,
} from 'lucide-react';
import { ROLE_LABELS } from '@dermaos/shared';
import { useAuth, usePermission } from '@/lib/auth';
import { initials } from '@/lib/utils';
import { trpc } from '@/lib/trpc-provider';
import { useRealtime } from '@/hooks/use-realtime';

/* ── Mapa de labels para breadcrumbs ─────────────────────────────────────── */

const PATH_LABELS: Record<string, string> = {
  pacientes:       'Pacientes',
  novo:            'Novo Paciente',
  leads:           'Leads',
  perfil:          'Perfil',
  prontuario:      'Prontuário',
  imagens:         'Imagens',
  protocolos:      'Protocolos',
  agendamentos:    'Agendamentos',
  financeiro:      'Financeiro',
  comunicacao:     'Comunicação',
  insumos:         'Insumos',
  agenda:          'Agenda',
  semana:          'Semana',
  fila:            'Fila de Espera',
  bloqueios:       'Bloqueios',
  comunicacoes:    'Comunicações',
  ligacoes:        'Ligações',
  automacoes:      'Automações',
  templates:       'Templates',
  agentes:         'Agentes IA',
  suprimentos:     'Suprimentos',
  kits:            'Kits',
  compras:         'Compras',
  recebimento:     'Recebimento',
  rastreabilidade: 'Rastreabilidade',
  analytics:       'Analytics',
  supply:          'Supply Intelligence',
  omni:            'Omnichannel',
  configuracoes:   'Configurações',
  usuarios:        'Usuários',
  servicos:        'Serviços',
  integracoes:     'Integrações',
  ia:              'Configuração IA',
  auditoria:       'Auditoria',
  faturas:         'Faturas',
  metas:           'Metas',
  dre:             'DRE Gerencial',
};

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [{ label: 'Dashboard' }];

  const crumbs: { label: string; href?: string }[] = [
    { label: 'Dashboard', href: '/' },
  ];

  let current = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    current += `/${seg}`;
    const isLast = i === segments.length - 1;

    /* Segmentos que são IDs (UUIDs / cuid) mostram um placeholder */
    const isId = /^[a-z0-9_-]{20,}$/i.test(seg) || /^[0-9a-f-]{36}$/i.test(seg);
    const label = isId ? '...' : (PATH_LABELS[seg] ?? seg);

    crumbs.push(isLast ? { label } : { label, href: current });
  }

  return crumbs;
}

/* ── DashboardShell ───────────────────────────────────────────────────────── */

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router     = useRouter();
  const pathname   = usePathname();
  const { user, clinic, logout } = useAuth();

  /* RBAC — visibilidade dos itens do menu */
  const canOmni      = usePermission('omni', 'read');
  const canSupply    = usePermission('supply', 'read');
  const canFinancial = usePermission('financial', 'read');
  const canAnalytics = usePermission('analytics', 'read');
  const canAdmin     = usePermission('admin', 'read');

  /* Badge de não-lidas no item "Comunicações" (polling + realtime) */
  const unreadQuery = trpc.omni.unreadCount.useQuery(undefined, {
    enabled:         canOmni,
    refetchInterval: 60_000,
    staleTime:       15_000,
  });
  const unreadCount = unreadQuery.data?.count ?? 0;
  const utils = trpc.useUtils();

  useRealtime(['new_message', 'conversation_read'], () => {
    if (canOmni) void utils.omni.unreadCount.invalidate();
  });

  /* Nav items filtrados por permissão */
  const navItems = React.useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      {
        id:    'home',
        label: 'Dashboard',
        href:  '/',
        icon:  <Home className="h-5 w-5" aria-hidden="true" />,
      },
      {
        id:    'pacientes',
        label: 'Pacientes & Leads',
        href:  '/pacientes',
        icon:  <Users className="h-5 w-5" aria-hidden="true" />,
      },
      {
        id:    'agenda',
        label: 'Agenda',
        href:  '/agenda',
        icon:  <Calendar className="h-5 w-5" aria-hidden="true" />,
      },
    ];

    if (canOmni) {
      items.push({
        id:    'comunicacoes',
        label: 'Comunicações',
        href:  '/comunicacoes',
        icon:  <MessageSquare className="h-5 w-5" aria-hidden="true" />,
        badge: unreadCount,
      });
    }

    if (canSupply) {
      items.push({
        id:    'suprimentos',
        label: 'Suprimentos',
        href:  '/suprimentos',
        icon:  <Package className="h-5 w-5" aria-hidden="true" />,
      });
    }

    if (canFinancial) {
      items.push({
        id:    'financeiro',
        label: 'Financeiro',
        href:  '/financeiro',
        icon:  <DollarSign className="h-5 w-5" aria-hidden="true" />,
      });
    }

    if (canAnalytics) {
      items.push({
        id:    'analytics',
        label: 'Analytics',
        href:  '/analytics',
        icon:  <BarChart3 className="h-5 w-5" aria-hidden="true" />,
      });
    }

    if (canAdmin) {
      items.push({
        id:    'configuracoes',
        label: 'Configurações',
        href:  '/configuracoes',
        icon:  <Settings className="h-5 w-5" aria-hidden="true" />,
      });
    }

    return items;
  }, [canOmni, canSupply, canFinancial, canAnalytics, canAdmin, unreadCount]);

  /* Command Palette */
  const [cmdOpen, setCmdOpen] = React.useState(false);

  const quickActions = React.useMemo<CommandItem[]>(() => [
    {
      id:       'novo-agendamento',
      label:    'Novo Agendamento',
      group:    'quick-actions',
      onSelect: () => router.push('/agenda'),
    },
    {
      id:       'cadastrar-paciente',
      label:    'Cadastrar Paciente',
      group:    'quick-actions',
      onSelect: () => router.push('/pacientes/novo'),
    },
    {
      id:       'ver-estoque',
      label:    'Ver Estoque',
      group:    'quick-actions',
      onSelect: () => router.push('/suprimentos'),
    },
    {
      id:       'meu-perfil',
      label:    'Meu Perfil',
      group:    'quick-actions',
      onSelect: () => router.push('/configuracoes'),
    },
  ], [router]);

  /* Sidebar user */
  const sidebarUser = user
    ? {
        name:     user.name,
        role:     ROLE_LABELS[user.role] ?? user.role,
        initials: initials(user.name),
        avatarUrl: user.avatarUrl ?? undefined,
      }
    : undefined;

  /* TopBar user */
  const topBarUser = user
    ? { name: user.name, email: user.email }
    : undefined;

  return (
    <>
      <AppShell
        sidebarProps={{
          currentPath:    pathname,
          customNavItems: navItems,
          onNavigate:     (href) => router.push(href),
          clinicName:     clinic?.name ?? 'DermaOS',
          user:           sidebarUser,
        }}
        topBarProps={{
          breadcrumbs:        getBreadcrumbs(pathname),
          user:               topBarUser,
          clinicName:         clinic?.name,
          onSearchClick:      () => setCmdOpen(true),
          onLogoutClick:      logout,
          onSettingsClick:    () => router.push('/configuracoes'),
          onProfileClick:     () => router.push('/configuracoes'),
          onNotificationsClick: () => {},
        }}
      >
        {children}
      </AppShell>

      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        items={quickActions}
      />
    </>
  );
}
