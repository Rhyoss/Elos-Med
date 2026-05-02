'use client';

import * as React from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import {
  Shell,
  type ShellNavItem,
  type ShellNavGroup,
  type TopBarQuickAction,
} from '@dermaos/ui/ds';
import { CommandPalette, type CommandItem } from '@dermaos/ui';
import { ROLE_LABELS } from '@dermaos/shared';
import { useAuth, usePermission } from '@/lib/auth';
import { initials } from '@/lib/utils';
import { trpc } from '@/lib/trpc-provider';
import { useRealtime } from '@/hooks/use-realtime';

const NAV_GROUPS: ShellNavGroup[] = [
  { id: 'clinical', label: 'Clínico' },
  { id: 'operations', label: 'Operações' },
  { id: 'management', label: 'Gestão' },
];

const SEGMENT_LABELS: Record<string, string> = {
  prontuario: 'Prontuário',
  consulta: 'Consulta',
  consultas: 'Consultas',
  prescricoes: 'Prescrições',
  procedimentos: 'Procedimentos',
  protocolos: 'Protocolos',
  imagens: 'Imagens',
  documentos: 'Documentos',
  timeline: 'Timeline',
  novo: 'Novo',
  leads: 'Leads',
  semana: 'Semana',
  fila: 'Fila',
  bloqueios: 'Bloqueios',
  compras: 'Compras',
  recebimento: 'Recebimento',
  lotes: 'Lotes',
  kits: 'Kits',
  consumir: 'Consumir',
  rastreabilidade: 'Rastreabilidade',
  faturas: 'Faturas',
  dre: 'DRE',
  metas: 'Metas',
  usuarios: 'Usuários',
  integracoes: 'Integrações',
  servicos: 'Serviços',
  auditoria: 'Auditoria',
  ia: 'Inteligência Artificial',
  agentes: 'Agentes',
  templates: 'Templates',
  automacoes: 'Automações',
  ligacoes: 'Ligações',
  knowledge: 'Base de Conhecimento',
  escalacao: 'Escalação',
  metricas: 'Métricas',
  financeiro: 'Financeiro',
  pacientes: 'Pacientes',
  omni: 'Comunicações',
  supply: 'Suprimentos',
};

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const { user, clinic, logout } = useAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  React.useEffect(() => {
    setSidebarCollapsed(localStorage.getItem('sidebar_collapsed') === 'true');
  }, []);

  const toggleSidebar = React.useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    localStorage.setItem('sidebar_collapsed', String(collapsed));
  }, []);

  /* ── RBAC ──────────────────────────────────────────────────────── */
  const canOmni = usePermission('omni', 'read');
  const canSupply = usePermission('supply', 'read');
  const canFinancial = usePermission('financial', 'read');
  const canAnalytics = usePermission('analytics', 'read');
  const canAdmin = usePermission('admin', 'read');

  /* ── Unread badge ──────────────────────────────────────────────── */
  const unreadQuery = trpc.omni.unreadCount.useQuery(undefined, {
    enabled: canOmni,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
  const unreadCount = unreadQuery.data?.count ?? 0;
  const utils = trpc.useUtils();

  useRealtime(['new_message', 'conversation_read'], () => {
    if (canOmni) void utils.omni.unreadCount.invalidate();
  });

  /* ── Patient name for breadcrumbs ──────────────────────────────── */
  const patientId = typeof params?.id === 'string' ? params.id : undefined;
  const isPatientRoute = pathname?.startsWith('/pacientes/') && patientId;
  const patientQuery = trpc.patients.getById.useQuery(
    { id: patientId! },
    { enabled: !!isPatientRoute && !!patientId, staleTime: 60_000 },
  );
  const patientName = patientQuery.data?.patient?.name;

  /* ── Nav items ─────────────────────────────────────────────────── */
  const navItems = React.useMemo<ShellNavItem[]>(() => {
    const items: ShellNavItem[] = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        shortLabel: 'Home',
        href: '/',
        icon: 'grid',
      },
      {
        id: 'agenda',
        label: 'Agenda',
        href: '/agenda',
        icon: 'calendar',
        module: 'clinical',
        group: 'clinical',
      },
      {
        id: 'pacientes',
        label: 'Pacientes',
        href: '/pacientes',
        icon: 'users',
        module: 'clinical',
        group: 'clinical',
      },
    ];

    if (canOmni) {
      items.push({
        id: 'comunicacoes',
        label: 'Comunicações',
        shortLabel: 'Comunic.',
        href: '/comunicacoes',
        icon: 'message',
        module: 'aiMod',
        group: 'clinical',
        badge: unreadCount,
      });
    }

    if (canSupply) {
      items.push({
        id: 'suprimentos',
        label: 'Estoque',
        shortLabel: 'Estoque',
        href: '/suprimentos',
        icon: 'box',
        module: 'supply',
        group: 'operations',
      });
    }

    if (canFinancial) {
      items.push({
        id: 'financeiro',
        label: 'Financeiro',
        shortLabel: 'Financ.',
        href: '/financeiro',
        icon: 'creditCard',
        module: 'financial',
        group: 'operations',
      });
    }

    if (canAnalytics) {
      items.push({
        id: 'analytics',
        label: 'Analytics',
        href: '/analytics',
        icon: 'barChart',
        group: 'management',
      });
    }

    if (canAdmin) {
      items.push({
        id: 'configuracoes',
        label: 'Configurações',
        shortLabel: 'Config.',
        href: '/configuracoes',
        icon: 'settings',
        group: 'management',
      });
    }

    return items;
  }, [canOmni, canSupply, canFinancial, canAnalytics, canAdmin, unreadCount]);

  /* ── Quick actions for TopBar ───────────────────────────────────── */
  const quickActions = React.useMemo<TopBarQuickAction[]>(() => {
    const actions: TopBarQuickAction[] = [
      {
        id: 'novo-agendamento',
        label: 'Novo Agendamento',
        icon: 'calendar',
        onClick: () => router.push('/agenda'),
      },
      {
        id: 'novo-paciente',
        label: 'Novo Paciente',
        icon: 'user',
        onClick: () => router.push('/pacientes/novo'),
      },
    ];
    return actions;
  }, [router]);

  /* ── Command Palette ───────────────────────────────────────────── */
  const [cmdOpen, setCmdOpen] = React.useState(false);

  const cmdItems = React.useMemo<CommandItem[]>(
    () => [
      {
        id: 'novo-agendamento',
        label: 'Novo Agendamento',
        group: 'quick-actions',
        onSelect: () => router.push('/agenda'),
      },
      {
        id: 'cadastrar-paciente',
        label: 'Cadastrar Paciente',
        group: 'quick-actions',
        onSelect: () => router.push('/pacientes/novo'),
      },
      {
        id: 'ver-estoque',
        label: 'Ver Estoque',
        group: 'quick-actions',
        onSelect: () => router.push('/suprimentos'),
      },
      {
        id: 'meu-perfil',
        label: 'Meu Perfil',
        group: 'quick-actions',
        onSelect: () => router.push('/configuracoes'),
      },
      {
        id: 'sair',
        label: 'Sair',
        group: 'quick-actions',
        onSelect: () => logout(),
      },
    ],
    [router, logout],
  );

  /* ── User ──────────────────────────────────────────────────────── */
  const shellUser = user
    ? {
        name: user.name,
        role:
          ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role,
        initials: initials(user.name),
        avatarUrl: user.avatarUrl ?? undefined,
      }
    : undefined;

  /* ── Breadcrumbs ───────────────────────────────────────────────── */
  const breadcrumb = React.useMemo(() => {
    if (!pathname) return undefined;
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length <= 1) return undefined;

    const trail = parts.slice(1).map((seg, idx) => {
      const href = '/' + parts.slice(0, idx + 2).join('/');
      let label = SEGMENT_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');

      if (patientName && patientId && seg === patientId) {
        label = patientName;
      }

      return { label, href };
    });

    return trail;
  }, [pathname, patientName, patientId]);

  return (
    <>
      <Shell
        navItems={navItems}
        groups={NAV_GROUPS}
        currentPath={pathname}
        user={shellUser}
        brandName={clinic?.name ?? 'ElosMed'}
        onNavigate={(href) => router.push(href)}
        onSearchClick={() => setCmdOpen(true)}
        onUserClick={() => router.push('/configuracoes')}
        collapsed={sidebarCollapsed}
        onCollapsedChange={toggleSidebar}
        topBar={{
          notificationCount: unreadCount,
          trail: breadcrumb,
          onNotificationsClick: () => router.push('/comunicacoes'),
          quickActions,
        }}
      >
        {children}
      </Shell>

      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        items={cmdItems}
      />
    </>
  );
}
