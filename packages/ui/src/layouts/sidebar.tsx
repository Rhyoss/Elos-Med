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
  children?: NavItem[];
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
  onNavigate?: (href: string) => void;
  customNavItems?: NavItem[];
  className?: string;
}

/* ── Itens de navegação padrão ────────────────────────────────────────────── */

const defaultNavItems: NavItem[] = [
  { id: 'home',           label: 'Início',              href: '/dashboard',      icon: <Home className="h-5 w-5" aria-hidden="true" /> },
  { id: 'patients',       label: 'Pacientes & Leads',   href: '/patients',       icon: <Users className="h-5 w-5" aria-hidden="true" /> },
  { id: 'appointments',   label: 'Agenda',              href: '/appointments',   icon: <Calendar className="h-5 w-5" aria-hidden="true" /> },
  { id: 'communications', label: 'Comunicações',        href: '/communications', icon: <MessageSquare className="h-5 w-5" aria-hidden="true" /> },
  { id: 'supply',         label: 'Suprimentos',         href: '/supply',         icon: <Package className="h-5 w-5" aria-hidden="true" /> },
  { id: 'financial',      label: 'Financeiro',          href: '/financial',      icon: <DollarSign className="h-5 w-5" aria-hidden="true" /> },
  { id: 'analytics',      label: 'Analytics',           href: '/analytics',      icon: <BarChart3 className="h-5 w-5" aria-hidden="true" /> },
  { id: 'settings',       label: 'Configurações',       href: '/settings',       icon: <Settings className="h-5 w-5" aria-hidden="true" /> },
];

/* ── Avatar do usuário ───────────────────────────────────────────────────── */

function UserAvatar({ user, size = 'md' }: { user: SidebarUser; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm';
  const initials = user.initials ?? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className={cn('rounded-full object-cover shrink-0', sizeClass)}
      />
    );
  }

  return (
    <span
      className={cn(
        'rounded-full bg-primary-700 text-white font-semibold flex items-center justify-center shrink-0',
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
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
          isActive
            ? 'bg-bg-selected text-white border-l-2 border-gold-500 pl-[10px]'
            : 'text-slate-300 hover:bg-white/10 hover:text-white',
          collapsed && 'justify-center px-2',
        )}
        aria-current={isActive ? 'page' : undefined}
        title={collapsed ? item.label : undefined}
      >
        <span className="shrink-0">{item.icon}</span>
        {!collapsed && (
          <span className="truncate flex-1">{item.label}</span>
        )}
        {!collapsed && item.badge !== undefined && item.badge > 0 && (
          <span
            className="ml-auto rounded-full bg-primary-600 px-1.5 py-0.5 text-xs font-medium text-white min-w-[1.25rem] text-center"
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
  onNavigate,
  customNavItems,
  className,
}: SidebarProps) {
  const navItems = customNavItems ?? defaultNavItems;

  function isActive(href: string) {
    if (href === '/dashboard') return currentPath === '/' || currentPath === '/dashboard';
    return currentPath.startsWith(href);
  }

  return (
    <nav
      className={cn(
        'flex flex-col h-full bg-sidebar text-white transition-all duration-200',
        collapsed ? 'w-16' : 'w-sidebar',
        className,
      )}
      aria-label="Navegação principal"
    >
      {/* Logo */}
      <div
        className={cn(
          'flex items-center h-topbar border-b border-white/10 px-4 shrink-0',
          collapsed ? 'justify-center px-2' : 'gap-2',
        )}
      >
        {/* Logo mark */}
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-600 text-white font-bold text-sm">
          D
        </span>
        {!collapsed && (
          <span className="font-semibold text-base tracking-tight">{clinicName}</span>
        )}
      </div>

      {/* Navegação */}
      <div className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="flex flex-col gap-0.5" role="list">
          {navItems.map((item) => (
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

      {/* Usuário */}
      {user && (
        <div className={cn('border-t border-white/10 p-3 shrink-0', collapsed && 'flex justify-center')}>
          {collapsed ? (
            <UserAvatar user={user} size="sm" />
          ) : (
            <div className="flex items-center gap-2.5">
              <UserAvatar user={user} />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-white truncate">{user.name}</span>
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
            'bg-sidebar border border-white/20 text-slate-300 hover:text-white',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
            'shadow-md transition-colors',
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
