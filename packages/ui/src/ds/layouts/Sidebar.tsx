'use client';
import * as React from 'react';
import { T } from '../../tokens';
import { Ico, type IcoName } from '../components/Ico';
import { Mono } from '../components/Mono';

export type ShellModule =
  | 'clinical'
  | 'aiMod'
  | 'supply'
  | 'financial'
  | 'accentMod';

export interface ShellNavItem {
  id: string;
  /** Full human label (used for `title` / aria). */
  label: string;
  /** Optional 8-char label rendered in the 88px sidebar — defaults to `label`. */
  shortLabel?: string;
  href: string;
  icon: IcoName;
  /** Module accent — colors the active state. */
  module?: ShellModule;
  /** Unread / pending count rendered as a corner badge. */
  badge?: number;
}

export interface ShellUser {
  name: string;
  role?: string;
  initials?: string;
  avatarUrl?: string;
}

export interface SidebarProps {
  navItems: ShellNavItem[];
  /** Current pathname — used for active-state detection. */
  currentPath?: string;
  user?: ShellUser;
  /** Brand mark inside the top tile. Defaults to "E". */
  brandMark?: React.ReactNode;
  /** Used for `aria-label` and the brand link tooltip. */
  brandName?: string;
  /** Override navigation (Next.js `router.push`); falls back to `<a href>`. */
  onNavigate?: (href: string) => void;
  /** Renders a search trigger button at the bottom of the sidebar. */
  onSearchClick?: () => void;
  /** User-avatar click handler. */
  onUserClick?: () => void;
  className?: string;
}

const SIDEBAR_W = 88;

function isActive(itemHref: string, currentPath: string | undefined): boolean {
  if (!currentPath) return false;
  if (itemHref === '/') return currentPath === '/' || currentPath === '/dashboard';
  return currentPath === itemHref || currentPath.startsWith(itemHref + '/');
}

function fallbackInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function Sidebar({
  navItems,
  currentPath,
  user,
  brandMark = 'E',
  brandName = 'ElosMed',
  onNavigate,
  onSearchClick,
  onUserClick,
  className,
}: SidebarProps) {
  function go(e: React.MouseEvent, href: string) {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(href);
    }
  }
  return (
    <nav
      aria-label={`${brandName} — navegação principal`}
      className={className}
      style={{
        width: SIDEBAR_W,
        background: T.metalGrad,
        backdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
        WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
        borderRight: `1px solid ${T.metalBorder}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '14px 6px',
        gap: 2,
        position: 'relative',
        height: '100%',
        boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.58)',
        flexShrink: 0,
      }}
    >
      {/* Anisotropic banding sheen */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: T.metalSheen,
          opacity: 0.5,
          pointerEvents: 'none',
        }}
      />
      {/* Top diffuse highlight */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '40%',
          background: T.metalHighlight,
          opacity: 0.55,
          pointerEvents: 'none',
        }}
      />

      {/* ── Brand mark ─────────────────────────────────────────────── */}
      <a
        href="/"
        onClick={(e) => go(e, '/')}
        aria-label={brandName}
        title={brandName}
        style={{
          width: 38,
          height: 38,
          borderRadius: T.r.md,
          background: T.primaryGrad,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
          zIndex: 1,
          boxShadow: '0 4px 14px rgba(23,77,56,0.28)',
          color: '#fff',
          fontWeight: 700,
          fontSize: 17,
          fontFamily: "'IBM Plex Sans', sans-serif",
          textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        {brandMark}
      </a>

      {/* Divider */}
      <div
        aria-hidden
        style={{
          width: '100%',
          height: 1,
          background: T.divider,
          marginBottom: 6,
          zIndex: 1,
          flexShrink: 0,
        }}
      />

      {/* ── Nav list ───────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          width: '100%',
          zIndex: 1,
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {navItems.map((item) => {
          const active = isActive(item.href, currentPath);
          const m = item.module ? T[item.module] : null;
          const accent = active ? (m ? m.color : T.primary) : T.textMuted;
          const tintBg = active ? (m ? m.bg : T.primaryBg) : 'transparent';
          const tintBorder = active
            ? (m ? `${m.color}30` : T.primaryBorder)
            : 'transparent';
          return (
            <a
              key={item.id}
              href={item.href}
              onClick={(e) => go(e, item.href)}
              aria-current={active ? 'page' : undefined}
              title={item.label}
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '7px 4px',
                borderRadius: T.r.md,
                border: `1px solid ${tintBorder}`,
                background: tintBg,
                cursor: 'pointer',
                transition: 'all 0.15s',
                textDecoration: 'none',
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <Ico
                name={item.icon}
                size={17}
                color={accent}
                sw={active ? 2 : 1.6}
              />
              <Mono size={7} spacing="0.3px" color={accent}>
                {(item.shortLabel ?? item.label).slice(0, 8)}
              </Mono>
              {item.badge != null && item.badge > 0 && (
                <span
                  aria-label={`${item.badge} novos`}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    borderRadius: 999,
                    background: T.danger,
                    color: '#fff',
                    fontSize: 8,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 1px 3px rgba(154,32,32,0.30)',
                  }}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </a>
          );
        })}
      </div>

      {/* ── Footer slots ────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          zIndex: 1,
          paddingTop: 8,
          flexShrink: 0,
        }}
      >
        {onSearchClick && (
          <button
            type="button"
            onClick={onSearchClick}
            aria-label="Buscar (⌘K)"
            title="Buscar (⌘K)"
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '7px 4px',
              borderRadius: T.r.md,
              border: `1px solid ${T.glassBorder}`,
              background: T.glass,
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          >
            <Ico name="search" size={15} color={T.textSecondary} sw={1.7} />
            <Mono size={7} spacing="0.3px" color={T.textMuted}>⌘K</Mono>
          </button>
        )}
        {user && (
          <button
            type="button"
            onClick={onUserClick}
            aria-label={`Conta de ${user.name}${user.role ? ` (${user.role})` : ''}`}
            title={`${user.name}${user.role ? ' · ' + user.role : ''}`}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              border: `1px solid ${T.primaryBorder}`,
              background: user.avatarUrl
                ? `url("${user.avatarUrl}") center/cover`
                : T.primaryGrad,
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              fontFamily: "'IBM Plex Sans', sans-serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(23,77,56,0.22)',
            }}
          >
            {!user.avatarUrl &&
              (user.initials ?? fallbackInitials(user.name))}
          </button>
        )}
      </div>
    </nav>
  );
}
