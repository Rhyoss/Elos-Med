'use client';

import * as React from 'react';
import { Menu, X } from 'lucide-react';
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
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  const [mobileOpen, setMobileOpen] = React.useState(false);

  function handleCollapseChange(next: boolean) {
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

  /* Fecha drawer mobile com Escape */
  React.useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-app">
      <SkipToContent />

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
            className="fixed inset-0 bg-bg-overlay/60 backdrop-blur-sm md:hidden animate-in-up"
            style={{ zIndex: 'var(--z-overlay)', animationDuration: '180ms' }}
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="fixed inset-y-0 left-0 md:hidden flex shadow-xl"
            style={{ zIndex: 'var(--z-modal)', animation: 'slide-in-from-right 220ms cubic-bezier(0,0,0.2,1) reverse' }}
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
        {/* TopBar com sticky e blur */}
        <TopBar
          {...topBarProps}
          className={cn('sticky top-0', topBarProps?.className)}
        />

        {/* Botão hamburger mobile — dentro da TopBar via posicionamento absoluto */}
        <button
          type="button"
          className={cn(
            'fixed top-3 left-3 md:hidden',
            'flex h-9 w-9 items-center justify-center rounded-md border border-border/70 bg-card text-foreground shadow-sm',
            'hover:bg-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          style={{ zIndex: 'calc(var(--z-sticky) + 1)' }}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
        </button>

        {/* Conteúdo da página */}
        <main
          id="main-content"
          className={cn('flex-1 overflow-y-auto overflow-x-hidden', contentClassName)}
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
        'absolute top-2 left-2 rounded-md px-4 py-2',
        'bg-primary text-primary-foreground font-medium text-sm shadow-md',
        'opacity-0 -translate-y-12 focus:opacity-100 focus:translate-y-0 transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
      )}
      style={{ zIndex: 'var(--z-critical-alert)' }}
    >
      Pular para o conteúdo
    </a>
  );
}
