'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Shell, type ShellNavItem } from '@dermaos/ui/ds';
import { CommandPalette, type CommandItem } from '@dermaos/ui';
import { ROLE_LABELS } from '@dermaos/shared';
import { useAuth, usePermission } from '@/lib/auth';
import { initials } from '@/lib/utils';
import { trpc } from '@/lib/trpc-provider';
import { useRealtime } from '@/hooks/use-realtime';

/**
 * DashboardShell — wires the DS `Shell` (Quite Clear) to the live RBAC,
 * realtime + tRPC integrations, and the global CommandPalette.
 *
 * Page-level chrome (titles, breadcrumbs, action buttons) lives inside
 * each page per the Quite Clear reference; this shell only owns the
 * sidebar, the ambient background, and global widgets.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, clinic, logout } = useAuth();

  /* ── RBAC — visibilidade dos itens do menu ─────────────────────────── */
  const canOmni      = usePermission('omni', 'read');
  const canSupply    = usePermission('supply', 'read');
  const canFinancial = usePermission('financial', 'read');
  const canAnalytics = usePermission('analytics', 'read');
  const canAdmin     = usePermission('admin', 'read');

  /* ── Badge de não-lidas em "Comunicações" (polling + realtime) ─────── */
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

  /* ── Nav items filtrados por permissão ────────────────────────────────
     Labels seguem o reference DS NAV (ds-final-pages.jsx:4-13) — abreviações
     "Comunic./Suprim./Config." aparecem no reference; "Dashboard/Agenda/
     Pacientes/Financeiro/Analytics" são sliced em 8 chars pelo Sidebar. */
  const navItems = React.useMemo<ShellNavItem[]>(() => {
    const items: ShellNavItem[] = [
      { id: 'dashboard', label: 'Dashboard', href: '/',          icon: 'grid' },
      { id: 'agenda',    label: 'Agenda',    href: '/agenda',    icon: 'calendar', module: 'clinical' },
      { id: 'pacientes', label: 'Pacientes', href: '/pacientes', icon: 'user',     module: 'clinical' },
    ];
    if (canOmni) {
      items.push({
        id: 'comunicacoes', label: 'Comunic.',
        href: '/comunicacoes', icon: 'message', module: 'aiMod', badge: unreadCount,
      });
    }
    if (canSupply) {
      items.push({
        id: 'suprimentos', label: 'Suprim.',
        href: '/suprimentos', icon: 'box', module: 'supply',
      });
    }
    if (canFinancial) {
      items.push({
        id: 'financeiro', label: 'Financeiro',
        href: '/financeiro', icon: 'creditCard', module: 'financial',
      });
    }
    if (canAnalytics) {
      items.push({
        id: 'analytics', label: 'Analytics',
        href: '/analytics', icon: 'barChart',
      });
    }
    if (canAdmin) {
      items.push({
        id: 'configuracoes', label: 'Config.',
        href: '/configuracoes', icon: 'settings',
      });
    }
    return items;
  }, [canOmni, canSupply, canFinancial, canAnalytics, canAdmin, unreadCount]);

  /* ── Command Palette (Cmd+K) ───────────────────────────────────────── */
  const [cmdOpen, setCmdOpen] = React.useState(false);

  const quickActions = React.useMemo<CommandItem[]>(() => [
    { id: 'novo-agendamento',   label: 'Novo Agendamento',   group: 'quick-actions', onSelect: () => router.push('/agenda') },
    { id: 'cadastrar-paciente', label: 'Cadastrar Paciente', group: 'quick-actions', onSelect: () => router.push('/pacientes/novo') },
    { id: 'ver-estoque',        label: 'Ver Estoque',        group: 'quick-actions', onSelect: () => router.push('/suprimentos') },
    { id: 'meu-perfil',         label: 'Meu Perfil',         group: 'quick-actions', onSelect: () => router.push('/configuracoes') },
    { id: 'sair',               label: 'Sair',               group: 'quick-actions', onSelect: () => logout() },
  ], [router, logout]);

  /* ── User para o avatar do sidebar ─────────────────────────────────── */
  const shellUser = user
    ? {
        name:      user.name,
        role:      ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role,
        initials:  initials(user.name),
        avatarUrl: user.avatarUrl ?? undefined,
      }
    : undefined;

  return (
    <>
      <Shell
        navItems={navItems}
        currentPath={pathname}
        user={shellUser}
        brandName={clinic?.name ?? 'ElosMed'}
        onNavigate={(href) => router.push(href)}
        onSearchClick={() => setCmdOpen(true)}
        onUserClick={() => router.push('/configuracoes')}
      >
        {children}
      </Shell>

      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        items={quickActions}
      />
    </>
  );
}
