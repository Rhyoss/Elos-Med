'use client';
import * as React from 'react';
import { T } from '../../tokens';
import { Ico } from '../components/Ico';
import { Mono } from '../components/Mono';
import type { ShellModule, ShellNavItem, ShellUser } from './Sidebar';

export interface TopBarBreadcrumb {
  label: string;
  href?: string;
}

export interface TopBarQuickAction {
  id: string;
  label: string;
  icon: 'plus' | 'calendar' | 'user' | 'mail';
  onClick: () => void;
}

export interface TopBarProps {
  brandName?: string;
  module?: ShellModule;
  navItems?: ShellNavItem[];
  currentPath?: string;
  title?: string;
  trail?: TopBarBreadcrumb[];
  user?: ShellUser;
  notificationCount?: number;
  onSearchClick?: () => void;
  onNotificationsClick?: () => void;
  onUserClick?: () => void;
  onNavigate?: (href: string) => void;
  trailing?: React.ReactNode;
  quickActions?: TopBarQuickAction[];
  clinicSelector?: React.ReactNode;
}

const TOPBAR_H = 56;

function findActiveItem(
  items: ShellNavItem[] | undefined,
  pathname: string | undefined,
): ShellNavItem | undefined {
  if (!items?.length || !pathname) return undefined;
  const matches = items
    .filter((it) => {
      if (it.href === '/' || it.href === '/dashboard')
        return pathname === '/' || pathname === '/dashboard';
      return pathname === it.href || pathname.startsWith(it.href + '/');
    })
    .sort((a, b) => b.href.length - a.href.length);
  return matches[0];
}

export function TopBar({
  brandName = 'ElosMed',
  module,
  navItems,
  currentPath,
  title,
  trail,
  user,
  notificationCount = 0,
  onSearchClick,
  onNotificationsClick,
  onUserClick,
  onNavigate,
  trailing,
  quickActions,
  clinicSelector,
}: TopBarProps) {
  const active = findActiveItem(navItems, currentPath);
  const moduleKey: ShellModule | undefined = active?.module ?? module;
  const m = moduleKey ? T[moduleKey] : null;
  const accent = m ? m.color : T.primary;
  const accentBg = m ? m.bg : T.primaryBg;
  const accentBorder = m ? `${m.color}30` : T.primaryBorder;
  const pageTitle = title ?? active?.label ?? 'Dashboard';
  const pageIcon = active?.icon ?? 'grid';

  function go(e: React.MouseEvent, href?: string) {
    if (!href) return;
    if (onNavigate) {
      e.preventDefault();
      onNavigate(href);
    }
  }

  return (
    <header
      role="banner"
      aria-label={`${brandName} — barra superior`}
      style={{
        height: TOPBAR_H,
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 200,
        background: T.glass,
        backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
        WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
        borderBottom: `1px solid ${T.glassBorder}`,
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.55) inset, 0 4px 12px rgba(0,0,0,0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        gap: 12,
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}
    >
      {/* ── Left: module title + breadcrumb ──────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
          flex: 1,
        }}
      >
        {/* Module title pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRadius: T.r.pill,
            background: accentBg,
            border: `1px solid ${accentBorder}`,
            color: accent,
            flexShrink: 0,
          }}
        >
          <Ico name={pageIcon} size={14} color={accent} sw={2} />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '-0.005em',
              whiteSpace: 'nowrap',
            }}
          >
            {pageTitle}
          </span>
        </div>

        {/* Breadcrumb trail */}
        {trail && trail.length > 0 && (
          <nav
            aria-label="Trilha de navegação"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              minWidth: 0,
            }}
          >
            {trail.map((seg, idx) => (
              <React.Fragment key={`${seg.label}-${idx}`}>
                <Ico name="arrowRight" size={10} color={T.textMuted} sw={2} />
                {seg.href && idx < trail.length - 1 ? (
                  <a
                    href={seg.href}
                    onClick={(e) => go(e, seg.href)}
                    style={{
                      fontSize: 12,
                      color: T.textTertiary,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 180,
                    }}
                  >
                    {seg.label}
                  </a>
                ) : (
                  <span
                    style={{
                      fontSize: 12,
                      color: idx === trail.length - 1 ? T.textSecondary : T.textTertiary,
                      fontWeight: idx === trail.length - 1 ? 500 : 400,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 200,
                    }}
                  >
                    {seg.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
      </div>

      {/* ── Right: quick actions · clinic · search · bell · trailing · user */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}
      >
        {/* Quick actions */}
        {quickActions && quickActions.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {quickActions.map((qa) => (
                <SmallBtn
                  key={qa.id}
                  icon={qa.icon}
                  label={qa.label}
                  onClick={qa.onClick}
                />
              ))}
            </div>
            <div
              aria-hidden
              style={{
                width: 1,
                height: 22,
                background: T.divider,
                flexShrink: 0,
              }}
            />
          </>
        )}

        {clinicSelector}

        {onSearchClick && (
          <button
            type="button"
            onClick={onSearchClick}
            aria-label="Buscar (⌘K)"
            title="Buscar (⌘K)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              padding: '0 10px 0 8px',
              borderRadius: T.r.md,
              background: T.glass,
              border: `1px solid ${T.glassBorder}`,
              color: T.textSecondary,
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s',
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = T.glassHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = T.glass;
            }}
          >
            <Ico name="search" size={13} color={T.textSecondary} sw={1.7} />
            <span style={{ fontSize: 12, fontWeight: 500 }}>Buscar</span>
            <span
              aria-hidden
              style={{
                marginLeft: 2,
                padding: '1px 5px',
                borderRadius: T.r.xs,
                background: 'rgba(0,0,0,0.04)',
                border: `1px solid ${T.divider}`,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 9,
                color: T.textMuted,
              }}
            >
              ⌘K
            </span>
          </button>
        )}

        <IconBtn
          icon="bell"
          ariaLabel={
            notificationCount > 0
              ? `${notificationCount} notificações`
              : 'Notificações'
          }
          onClick={onNotificationsClick}
          badge={notificationCount}
        />

        {trailing}

        {user && (
          <button
            type="button"
            onClick={onUserClick}
            aria-label={`Conta de ${user.name}${user.role ? ` (${user.role})` : ''}`}
            title={`${user.name}${user.role ? ' · ' + user.role : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 36,
              padding: '0 5px 0 6px',
              borderRadius: T.r.pill,
              background: T.glass,
              border: `1px solid ${T.glassBorder}`,
              cursor: 'pointer',
              transition: 'background 0.15s',
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = T.glassHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = T.glass;
            }}
          >
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                lineHeight: 1.1,
                maxWidth: 140,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: T.textPrimary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {user.name}
              </span>
              {user.role && (
                <Mono size={8} spacing="0.6px" color={T.textMuted}>
                  {user.role}
                </Mono>
              )}
            </span>
            <span
              aria-hidden
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: user.avatarUrl
                  ? `url("${user.avatarUrl}") center/cover`
                  : T.primaryGrad,
                color: '#fff',
                fontWeight: 700,
                fontSize: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(23,77,56,0.20)',
              }}
            >
              {!user.avatarUrl &&
                (user.initials ?? user.name.charAt(0).toUpperCase())}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}

function SmallBtn({
  icon,
  label,
  onClick,
}: {
  icon: 'plus' | 'calendar' | 'user' | 'mail';
  label: string;
  onClick: () => void;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 30,
        height: 30,
        borderRadius: T.r.sm,
        background: hover ? T.primaryBg : 'transparent',
        border: `1px solid ${hover ? T.primaryBorder : 'transparent'}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
        color: hover ? T.primary : T.textMuted,
      }}
    >
      <Ico name={icon} size={14} color={hover ? T.primary : T.textMuted} sw={1.8} />
    </button>
  );
}

function IconBtn({
  icon,
  ariaLabel,
  onClick,
  badge,
}: {
  icon: 'bell' | 'mail' | 'settings';
  ariaLabel: string;
  onClick?: () => void;
  badge?: number;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        width: 34,
        height: 34,
        borderRadius: T.r.md,
        background: hover ? T.glassHover : T.glass,
        border: `1px solid ${T.glassBorder}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.15s',
      }}
    >
      <Ico name={icon} size={15} color={T.textSecondary} sw={1.7} />
      {badge != null && badge > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -3,
            right: -3,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            borderRadius: 999,
            background: T.danger,
            color: '#fff',
            fontSize: 9,
            fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(154,32,32,0.35)',
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
