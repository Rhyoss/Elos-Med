'use client';

import * as React from 'react';
import { cn } from '../utils';
import {
  Home, Users, Calendar, MessageSquare,
  Package, DollarSign, BarChart3, Settings,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

/* ── Tipos ──────────────────────────────────────────────────────────────── */

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  /** Cor de domínio para o ícone — opcional */
  tone?: 'primary' | 'clinical' | 'financial' | 'supply' | 'ai' | 'gold' | 'neutral';
  children?: NavItem[];
}

export interface NavGroup {
  /** Rótulo da seção (omitido quando colapsado) */
  label?: string;
  items: NavItem[];
}

export interface SidebarUser {
  name: string;
  role: string;
  avatarUrl?: string;
  initials?: string;
}

export interface SidebarProps {
  currentPath?: string;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  user?: SidebarUser;
  clinicName?: string;
  /** Logomark customizada (substitui o "D" padrão) */
  logoMark?: React.ReactNode;
  onNavigate?: (href: string) => void;
  /** Lista plana — para compatibilidade. Se groups for fornecido, prevalece. */
  customNavItems?: NavItem[];
  /** Agrupamentos com rótulos de seção (preferido para visual premium) */
  groups?: NavGroup[];
  /** Footer customizado (acima do bloco de usuário) */
  footerSlot?: React.ReactNode;
  className?: string;
}

/* ── Itens padrão organizados em grupos ───────────────────────────────────── */

const defaultGroups: NavGroup[] = [
  {
    items: [
      { id: 'home', label: 'Início', href: '/dashboard', icon: <Home className="h-[18px] w-[18px]" aria-hidden="true" />, tone: 'primary' },
    ],
  },
  {
    label: 'Atendimento',
    items: [
      { id: 'patients',     label: 'Pacientes',     href: '/pacientes', icon: <Users className="h-[18px] w-[18px]" aria-hidden="true" />, tone: 'clinical' },
      { id: 'appointments', label: 'Agenda',        href: '/agenda', icon: <Calendar className="h-[18px] w-[18px]" aria-hidden="true" />, tone: 'clinical' },
      { id: 'communications', label: 'Comunicações', href: '/comunicacoes', icon: <MessageSquare className="h-[18px] w-[18px]" aria-hidden="true" />, tone: 'primary' },
    ],
  },
  {
    label: 'Operação',
    items: [
      { id: 'supply',    label: 'Suprimentos', href: '/suprimentos', icon: <Package className="h-[18px] w-[18px]" aria-hidden="true" />, tone: 'supply' },
      { id: 'financial', label: 'Financeiro',  href: '/financeiro', icon: <DollarSign className="h-[18px] w-[18px]" aria-hidden="true" />, tone: 'financial' },
      { id: 'analytics', label: 'Analytics',   href: '/analytics', icon: <BarChart3 className="h-[18px] w-[18px]" aria-hidden="true" />, tone: 'ai' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { id: 'settings', label: 'Configurações', href: '/configuracoes', icon: <Settings className="h-[18px] w-[18px]" aria-hidden="true" />, tone: 'neutral' },
    ],
  },
];

/* ── Avatar do usuário ───────────────────────────────────────────────────── */

function UserAvatar({ user, size = 'md' }: { user: SidebarUser; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm';
  const initials = user.initials ?? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        className={cn('rounded-full object-cover shrink-0 ring-2 ring-white/10', sizeClass)}
      />
    );
  }

  return (
    <span
      className={cn(
        'rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white font-semibold flex items-center justify-center shrink-0 ring-2 ring-white/10',
        sizeClass,
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/* ── NavItem individual ──────────────────────────────────────────────────── */

interface NavItemButtonProps {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onNavigate?: (href: string) => void;
}

function NavItemButton({ item, isActive, collapsed, onNavigate }: NavItemButtonProps) {
  return (
    <li>
      <a
        href={item.href}
        onClick={onNavigate ? (e) => { e.preventDefault(); onNavigate(item.href); } : undefined}
        className={cn(
          'group relative flex items-center gap-3 rounded-md px-3 h-10 text-sm font-medium',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60',
          isActive
            ? 'bg-white/[0.08] text-white'
            : 'text-slate-300 hover:bg-white/[0.05] hover:text-white',
          collapsed && 'justify-center px-0',
        )}
        aria-current={isActive ? 'page' : undefined}
        title={collapsed ? item.label : undefined}
      >
        {/* Indicador ativo dourado à esquerda */}
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gold-500"
          />
        )}
        <span className={cn(
          'shrink-0 transition-colors',
          isActive ? 'text-white' : 'text-slate-400 group-hover:text-white',
        )}>{item.icon}</span>
        {!collapsed && (
          <span className="truncate flex-1">{item.label}</span>
        )}
        {!collapsed && item.badge !== undefined && item.badge > 0 && (
          <span
            className={cn(
              'ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold min-w-[1.25rem] text-center',
              isActive ? 'bg-gold-500 text-gold-foreground' : 'bg-white/10 text-slate-200',
            )}
            aria-label={`${item.badge} itens`}
          >
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </a>
    </li>
  );
}

/* ── Sidebar principal ───────────────────────────────────────────────────── */

export function Sidebar({
  currentPath = '/',
  collapsed = false,
  onCollapseChange,
  user,
  clinicName = 'DermaOS',
  logoMark,
  onNavigate,
  customNavItems,
  groups,
  footerSlot,
  className,
}: SidebarProps) {
  const navGroups: NavGroup[] = groups
    ?? (customNavItems ? [{ items: customNavItems }] : defaultGroups);

  function isActive(href: string) {
    if (href === '/dashboard') return currentPath === '/' || currentPath === '/dashboard';
    return currentPath.startsWith(href);
  }

  return (
    <nav
      className={cn(
        'relative flex flex-col h-full text-white transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-sidebar',
        className,
      )}
      style={{ background: 'var(--gradient-sidebar)' }}
      aria-label="Navegação principal"
    >
      {/* Logo / brand mark */}
      <div
        className={cn(
          'flex items-center h-topbar border-b border-white/[0.08] shrink-0',
          collapsed ? 'justify-center px-0' : 'gap-2.5 px-4',
        )}
      >
        {logoMark ?? (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white font-bold text-sm shadow-md"
            style={{ background: 'var(--gradient-brand)' }}
            aria-hidden="true"
          >
            <span className="font-serif italic">D</span>
          </span>
        )}
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-base tracking-tight leading-tight truncate">{clinicName}</span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400 font-medium">Clinical OS</span>
          </div>
        )}
      </div>

      {/* Navegação por grupos */}
      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx}>
            {group.label && !collapsed && (
              <div className="mb-1.5 px-3">
                <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-500">
                  {group.label}
                </span>
              </div>
            )}
            {group.label && collapsed && gIdx > 0 && (
              <div className="mx-3 mb-2 mt-1 border-t border-white/[0.06]" aria-hidden="true" />
            )}
            <ul className="flex flex-col gap-0.5" role="list">
              {group.items.map((item) => (
                <NavItemButton
                  key={item.id}
                  item={item}
                  isActive={isActive(item.href)}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {footerSlot && !collapsed && (
        <div className="px-3 pb-2">{footerSlot}</div>
      )}

      {/* Usuário */}
      {user && (
        <div className={cn('border-t border-white/[0.08] p-3 shrink-0', collapsed && 'flex justify-center')}>
          {collapsed ? (
            <UserAvatar user={user} size="sm" />
          ) : (
            <div className="flex items-center gap-2.5">
              <UserAvatar user={user} />
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-sm font-semibold text-white truncate">{user.name}</span>
                <span className="text-xs text-slate-400 truncate">{user.role}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botão collapse */}
      {onCollapseChange && (
        <button
          type="button"
          onClick={() => onCollapseChange(!collapsed)}
          className={cn(
            'absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full',
            'bg-card text-foreground border border-border',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            'shadow-md hover:bg-hover transition-colors z-10',
          )}
          aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      )}
    </nav>
  );
}
