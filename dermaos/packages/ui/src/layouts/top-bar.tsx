'use client';

import * as React from 'react';
import { Bell, Search, ChevronRight, LogOut, User, Settings } from 'lucide-react';
import { cn } from '../utils';
import { Button } from '../primitives/button';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../primitives/dropdown-menu';

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
  notificationsSlot?: React.ReactNode;
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
        alt=""
        className="h-8 w-8 rounded-full object-cover ring-2 ring-border"
      />
    );
  }

  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white text-xs font-semibold ring-2 ring-border">
      {initials}
    </span>
  );
}

/* ── TopBar ──────────────────────────────────────────────────────────────── */

export function TopBar({
  breadcrumbs = [],
  user,
  notificationCount = 0,
  notificationsSlot,
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
        'flex items-center h-topbar border-b border-border/70 bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/75 px-4 gap-4 shrink-0',
        className,
      )}
      style={{ zIndex: 'var(--z-sticky)' }}
    >
      {/* Breadcrumb */}
      <nav aria-label="Localização atual" className="flex-1 min-w-0 ml-12 md:ml-0">
        {breadcrumbs.length > 0 ? (
          <ol className="flex items-center gap-1 text-sm" role="list">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <li key={idx} className="flex items-center gap-1 min-w-0">
                  {idx > 0 && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" aria-hidden="true" />
                  )}
                  {isLast ? (
                    <span className="font-semibold text-foreground truncate" aria-current="page">
                      {crumb.label}
                    </span>
                  ) : crumb.href ? (
                    <a
                      href={crumb.href}
                      className="text-muted-foreground hover:text-foreground transition-colors truncate focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1 -mx-1"
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
          <span className="text-sm font-semibold text-foreground">{clinicName}</span>
        ) : null}
      </nav>

      {/* Centro: busca global — refinada com fundo soft */}
      {onSearchClick && (
        <button
          type="button"
          onClick={onSearchClick}
          className={cn(
            'hidden md:flex items-center gap-2.5 h-9 px-3 rounded-md text-sm',
            'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground',
            'border border-transparent hover:border-border/60',
            'transition-colors min-w-[260px]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          )}
          aria-label="Abrir busca global (⌘K)"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-left">Busca global...</span>
          <kbd className="font-mono text-[10px] font-semibold border border-border rounded px-1.5 py-0.5 bg-background text-muted-foreground">⌘K</kbd>
        </button>
      )}

      {/* Direita */}
      <div className="flex items-center gap-1 ml-auto">
        {/* Busca mobile */}
        {onSearchClick && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onSearchClick}
            className="md:hidden"
            aria-label="Buscar"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}

        {/* Notificações */}
        {notificationsSlot ?? (
          <div className="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onNotificationsClick}
              aria-label={notificationCount > 0 ? `${notificationCount} notificações não lidas` : 'Notificações'}
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
            </Button>
            {notificationCount > 0 && (
              <span
                className="pointer-events-none absolute top-1 right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger text-white text-[10px] font-bold px-1 ring-2 ring-card"
                aria-hidden="true"
              >
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </div>
        )}

        {/* Divider sutil */}
        {user && <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />}

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
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="normal-case text-sm font-normal">
                <div className="flex items-center gap-3 py-1">
                  <TopBarAvatar user={user} />
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-foreground truncate">{user.name}</span>
                    {user.email && (
                      <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                    )}
                  </div>
                </div>
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
