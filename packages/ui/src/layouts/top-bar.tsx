'use client';

import * as React from 'react';
import { Bell, Search, ChevronRight, LogOut, User, Settings } from 'lucide-react';
import { cn } from '../utils.js';
import { Button } from '../primitives/button.js';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../primitives/dropdown-menu.js';

/* ── Tipos ──────────────────────────────────────────────────────────────── */

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface TopBarUser {
  name: string;
  email?: string;
  avatarUrl?: string;
  initials?: string;
}

export interface TopBarProps {
  breadcrumbs?: BreadcrumbItem[];
  user?: TopBarUser;
  notificationCount?: number;
  clinicName?: string;
  onSearchClick?: () => void;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
  onLogoutClick?: () => void;
  onNotificationsClick?: () => void;
  className?: string;
}

/* ── Avatar ──────────────────────────────────────────────────────────────── */

function TopBarAvatar({ user }: { user: TopBarUser }) {
  const initials = user.initials
    ?? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className="h-8 w-8 rounded-full object-cover"
      />
    );
  }

  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white text-xs font-semibold">
      {initials}
    </span>
  );
}

/* ── TopBar ──────────────────────────────────────────────────────────────── */

export function TopBar({
  breadcrumbs = [],
  user,
  notificationCount = 0,
  clinicName,
  onSearchClick,
  onProfileClick,
  onSettingsClick,
  onLogoutClick,
  onNotificationsClick,
  className,
}: TopBarProps) {
  return (
    <header
      className={cn(
        'flex items-center h-topbar border-b border-border bg-card px-4 gap-4 shrink-0',
        className,
      )}
      style={{ zIndex: 'var(--z-sticky)' }}
    >
      {/* Breadcrumb */}
      <nav aria-label="Localização atual" className="flex-1 min-w-0">
        {breadcrumbs.length > 0 ? (
          <ol className="flex items-center gap-1 text-sm" role="list">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <li key={idx} className="flex items-center gap-1">
                  {idx > 0 && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  )}
                  {isLast ? (
                    <span className="font-medium text-foreground truncate" aria-current="page">
                      {crumb.label}
                    </span>
                  ) : crumb.href ? (
                    <a
                      href={crumb.href}
                      className="text-muted-foreground hover:text-foreground transition-colors truncate focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                    >
                      {crumb.label}
                    </a>
                  ) : (
                    <span className="text-muted-foreground truncate">{crumb.label}</span>
                  )}
                </li>
              );
            })}
          </ol>
        ) : clinicName ? (
          <span className="text-sm font-medium text-foreground">{clinicName}</span>
        ) : null}
      </nav>

      {/* Centro: busca global */}
      {onSearchClick && (
        <Button
          variant="outline"
          size="sm"
          onClick={onSearchClick}
          className="hidden md:flex items-center gap-2 text-muted-foreground border-dashed min-w-[180px] justify-start"
          aria-label="Abrir busca global (⌘K)"
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="flex-1 text-left">Buscar...</span>
          <kbd className="text-xs border rounded px-1 py-0.5 bg-muted ml-auto">⌘K</kbd>
        </Button>
      )}

      {/* Direita */}
      <div className="flex items-center gap-1.5 ml-auto">
        {/* Busca mobile */}
        {onSearchClick && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onSearchClick}
            className="md:hidden"
            aria-label="Buscar"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}

        {/* Notificações */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={onNotificationsClick}
            aria-label={notificationCount > 0 ? `${notificationCount} notificações não lidas` : 'Notificações'}
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
          </Button>
          {notificationCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger-500 text-white text-xs font-bold px-0.5"
              aria-hidden="true"
            >
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </div>

        {/* Menu do usuário */}
        {user && (
          <DropdownMenuRoot>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-md p-1 hover:bg-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Menu do usuário: ${user.name}`}
              >
                <TopBarAvatar user={user} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="normal-case text-sm font-normal">
                <div className="font-medium text-foreground">{user.name}</div>
                {user.email && (
                  <div className="text-xs text-muted-foreground mt-0.5">{user.email}</div>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onProfileClick}>
                <User className="h-4 w-4" aria-hidden="true" />
                Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSettingsClick}>
                <Settings className="h-4 w-4" aria-hidden="true" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogoutClick} destructive>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuRoot>
        )}
      </div>
    </header>
  );
}
