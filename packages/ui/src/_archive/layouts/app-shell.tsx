'use client';

import * as React from 'react';
import { cn } from '../utils';
import { Sidebar, type SidebarProps } from './sidebar';
import { TopBar, type TopBarProps } from './top-bar';
import { Toaster } from '../primitives/toast';

/* ── Tipos ──────────────────────────────────────────────────────────────── */

export interface AppShellProps {
  children: React.ReactNode;
  sidebarProps?: Omit<SidebarProps, 'collapsed' | 'onCollapseChange'>;
  topBarProps?: TopBarProps;
  contentClassName?: string;
  fullWidth?: boolean;
}

const STORAGE_KEY = 'dermaos-sidebar-collapsed';

/* ── AppShell ────────────────────────────────────────────────────────────── */

export function AppShell({
  children,
  sidebarProps,
  topBarProps,
  contentClassName,
  fullWidth = false,
}: AppShellProps) {
  /* Persiste estado da sidebar no localStorage */
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  /* Estado do drawer mobile */
  const [mobileOpen, setMobileOpen] = React.useState(false);

  function handleCollapseChange(next: boolean) {
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

  return (
    <div className="flex h-screen overflow-hidden bg-app">
      {/* ── Sidebar desktop ─────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex relative flex-none"
        aria-label="Barra lateral"
      >
        <Sidebar
          {...sidebarProps}
          collapsed={collapsed}
          onCollapseChange={handleCollapseChange}
        />
      </aside>

      {/* ── Drawer mobile ────────────────────────────────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-bg-overlay/60 backdrop-blur-sm md:hidden"
            style={{ zIndex: 'var(--z-overlay)' }}
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="fixed inset-y-0 left-0 md:hidden flex"
            style={{ zIndex: 'var(--z-modal)' }}
            aria-label="Barra lateral móvel"
          >
            <Sidebar
              {...sidebarProps}
              collapsed={false}
              onCollapseChange={() => setMobileOpen(false)}
            />
          </aside>
        </>
      )}

      {/* ── Área principal ───────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* TopBar */}
        <TopBar
          {...topBarProps}
          className={cn('sticky top-0', topBarProps?.className)}
        />

        {/* Botão hamburger mobile */}
        <button
          type="button"
          className={cn(
            'fixed top-4 left-4 z-sticky md:hidden',
            'flex h-8 w-8 items-center justify-center rounded-md border bg-card text-foreground',
            'hover:bg-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={mobileOpen}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
          </svg>
        </button>

        {/* Conteúdo da página */}
        <main
          id="main-content"
          className={cn('flex-1 overflow-y-auto', contentClassName)}
          tabIndex={-1}
        >
          {fullWidth ? (
            children
          ) : (
            <div className="max-w-screen-2xl mx-auto w-full">
              {children}
            </div>
          )}
        </main>
      </div>

      {/* Sistema de notificações global */}
      <Toaster />
    </div>
  );
}

/* ── Link de acessibilidade para pular para o conteúdo ──────────────────── */

export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className={cn(
        'fixed top-2 left-2 z-[--z-critical-alert] rounded-md px-4 py-2',
        'bg-primary text-primary-foreground font-medium text-sm',
        'translate-y-[-100px] focus:translate-y-0 transition-transform',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
      )}
    >
      Pular para o conteúdo
    </a>
  );
}
