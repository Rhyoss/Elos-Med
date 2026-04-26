'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  AppShell,
  CommandPalette,
  type CommandItem,
  type NavItem,
  type NavGroup,
} from '@dermaos/ui';
import {
  Home, Users, Calendar, MessageSquare,
  Package, DollarSign, BarChart3, Settings,
} from 'lucide-react';
import { ROLE_LABELS } from '@dermaos/shared';
import { useAuth, usePermission } from '@/lib/auth';
import { initials } from '@/lib/utils';
import { trpc } from '@/lib/trpc-provider';
import { useSocket } from '@/hooks/use-socket';
import { SocketProvider } from '@/providers/socket-provider';
import { NotificationCenter } from '@/components/notification-center';
import { useNotifications } from '@/hooks/use-notifications';

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
    if (!seg) continue;
    current += `/${seg}`;
    const isLast = i === segments.length - 1;
    const isId = /^[a-z0-9_-]{20,}$/i.test(seg) || /^[0-9a-f-]{36}$/i.test(seg);
    const label = isId ? '...' : (PATH_LABELS[seg] ?? seg);
    crumbs.push(isLast ? { label } : { label, href: current });
  }

  return crumbs;
}

/* ── Inner shell — receives unreadCount from hooks ──────────────────────────── */

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const router     = useRouter();
  const pathname   = usePathname();
  const { user, clinic, logout } = useAuth();

  const canOmni      = usePermission('omni', 'read');
  const canSupply    = usePermission('supply', 'read');
  const canFinancial = usePermission('financial', 'read');
  const canAnalytics = usePermission('analytics', 'read');
  const canAdmin     = usePermission('admin', 'read');

  /* Omni unread badge — invalidated by real-time inbox events */
  const omniUnreadQuery = trpc.omni.unreadCount.useQuery(undefined, {
    enabled: canOmni,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
  const omniUnread = omniUnreadQuery.data?.count ?? 0;
  const utils = trpc.useUtils();

  useSocket(['new_message', 'inbox:new_message', 'conversation_read'], () => {
    if (canOmni) void utils.omni.unreadCount.invalidate();
  });

  /* Notifications */
  const { unreadCount: notifUnread } = useNotifications();

  /* Navegação organizada em grupos semânticos para hierarquia premium */
  const navGroups = React.useMemo<NavGroup[]>(() => {
    const atendimento: NavItem[] = [
      { id: 'pacientes', label: 'Pacientes', href: '/pacientes', icon: <Users className="h-[18px] w-[18px]" aria-hidden="true" />, tone: 'clinical' },
      { id: 'agenda',    label: 'Agenda',    href: '/agenda',    icon: <Calendar className="h-[18px] w-[18px]" aria-hidden="true" />, tone: 'clinical' },
    ];
    if (canOmni) {
      atendimento.push({
        id: 'comunicacoes', label: 'Comunicações', href: '/comunicacoes',
        icon: <MessageSquare className="h-[18px] w-[18px]" aria-hidden="true" />, tone: 'primary',
        badge: omniUnread,
      });
    }

    const operacao: NavItem[] = [];
    if (canSupply)    operacao.push({ id: 'suprimentos', label: 'Suprimentos', href: '/suprimentos', icon: <Package className="h-[18px] w-[18px]" aria-hidden="true" />, tone: 'supply' });
    if (canFinancial) operacao.push({ id: 'financeiro',  label: 'Financeiro',  href: '/financeiro',  icon: <DollarSign className="h-[18px] w-[18px]" aria-hidden="true" />, tone: 'financial' });
    if (canAnalytics) operacao.push({ id: 'analytics',   label: 'Analytics',   href: '/analytics',   icon: <BarChart3 className="h-[18px] w-[18px]" aria-hidden="true" />, tone: 'ai' });

    const sistema: NavItem[] = [];
    if (canAdmin) sistema.push({ id: 'configuracoes', label: 'Configurações', href: '/configuracoes', icon: <Settings className="h-[18px] w-[18px]" aria-hidden="true" />, tone: 'neutral' });

    const groups: NavGroup[] = [
      { items: [{ id: 'home', label: 'Início', href: '/', icon: <Home className="h-[18px] w-[18px]" aria-hidden="true" />, tone: 'primary' }] },
      { label: 'Atendimento', items: atendimento },
    ];
    if (operacao.length > 0) groups.push({ label: 'Operação', items: operacao });
    if (sistema.length > 0)  groups.push({ label: 'Sistema',  items: sistema });

    return groups;
  }, [canOmni, canSupply, canFinancial, canAnalytics, canAdmin, omniUnread]);

  const [cmdOpen, setCmdOpen] = React.useState(false);

  const quickActions = React.useMemo<CommandItem[]>(() => [
    { id: 'novo-agendamento',  label: 'Novo Agendamento',  group: 'quick-actions', onSelect: () => router.push('/agenda') },
    { id: 'cadastrar-paciente', label: 'Cadastrar Paciente', group: 'quick-actions', onSelect: () => router.push('/pacientes/novo') },
    { id: 'ver-estoque',       label: 'Ver Estoque',        group: 'quick-actions', onSelect: () => router.push('/suprimentos') },
    { id: 'meu-perfil',        label: 'Meu Perfil',         group: 'quick-actions', onSelect: () => router.push('/configuracoes') },
  ], [router]);

  const sidebarUser = user
    ? { name: user.name, role: ROLE_LABELS[user.role] ?? user.role, initials: initials(user.name), avatarUrl: user.avatarUrl ?? undefined }
    : undefined;

  const topBarUser = user ? { name: user.name, email: user.email } : undefined;

  return (
    <>
      <AppShell
        sidebarProps={{
          currentPath: pathname,
          groups:      navGroups,
          onNavigate:  (href) => router.push(href),
          clinicName:  clinic?.name ?? 'DermaOS',
          user:        sidebarUser,
        }}
        topBarProps={{
          breadcrumbs:         getBreadcrumbs(pathname),
          user:                topBarUser,
          clinicName:          clinic?.name,
          notificationCount:   notifUnread,
          notificationsSlot:   <NotificationCenter />,
          onSearchClick:       () => setCmdOpen(true),
          onLogoutClick:       logout,
          onSettingsClick:     () => router.push('/configuracoes'),
          onProfileClick:      () => router.push('/configuracoes'),
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

/* ── DashboardShell — wraps SocketProvider ───────────────────────────────── */

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SocketProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </SocketProvider>
  );
}
