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
  label: string;
  shortLabel?: string;
  href: string;
  icon: IcoName;
  module?: ShellModule;
  badge?: number;
  group?: string;
  disabled?: boolean;
}

export interface ShellNavGroup {
  id: string;
  label: string;
}

export interface ShellUser {
  name: string;
  role?: string;
  initials?: string;
  avatarUrl?: string;
}

export interface SidebarProps {
  navItems: ShellNavItem[];
  groups?: ShellNavGroup[];
  currentPath?: string;
  user?: ShellUser;
  brandMark?: React.ReactNode;
  brandName?: string;
  onNavigate?: (href: string) => void;
  onSearchClick?: () => void;
  onUserClick?: () => void;
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export const SIDEBAR_COLLAPSED_W = 72;
export const SIDEBAR_EXPANDED_W = 240;

function isActive(itemHref: string, currentPath: string | undefined): boolean {
  if (!currentPath) return false;
  if (itemHref === '/' || itemHref === '/dashboard')
    return currentPath === '/' || currentPath === '/dashboard';
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

function Tooltip({
  label,
  children,
  visible,
}: {
  label: string;
  children: React.ReactNode;
  visible: boolean;
}) {
  const [show, setShow] = React.useState(false);
  if (!visible) return <>{children}</>;
  return (
    <div
      style={{ position: 'relative', width: '100%' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            left: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            marginLeft: 8,
            padding: '6px 12px',
            borderRadius: T.r.sm,
            background: T.textPrimary,
            color: '#fff',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: "'IBM Plex Sans', sans-serif",
            whiteSpace: 'nowrap',
            zIndex: 1000,
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  navItems,
  groups,
  currentPath,
  user,
  brandMark = 'E',
  brandName = 'ElosMed',
  onNavigate,
  onSearchClick,
  onUserClick,
  className,
  collapsed = true,
  onCollapsedChange,
}: SidebarProps) {
  const width = collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W;

  function go(e: React.MouseEvent, href: string) {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(href);
    }
  }

  const groupedItems = React.useMemo(() => {
    if (!groups?.length) return [{ group: null, items: navItems }];
    const grouped: { group: ShellNavGroup | null; items: ShellNavItem[] }[] = [];
    const ungrouped = navItems.filter((i) => !i.group);
    if (ungrouped.length) grouped.push({ group: null, items: ungrouped });
    for (const g of groups) {
      const items = navItems.filter((i) => i.group === g.id);
      if (items.length) grouped.push({ group: g, items });
    }
    return grouped;
  }, [navItems, groups]);

  return (
    <nav
      aria-label={`${brandName} — navegação principal`}
      className={className}
      style={{
        width,
        minWidth: width,
        background: T.metalGrad,
        backdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
        WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
        borderRight: `1px solid ${T.metalBorder}`,
        display: 'flex',
        flexDirection: 'column',
        padding: collapsed ? '14px 8px' : '14px 12px',
        gap: 2,
        position: 'relative',
        height: '100%',
        boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.58)',
        flexShrink: 0,
        transition: 'width 0.2s ease, min-width 0.2s ease, padding 0.2s ease',
        overflow: 'hidden',
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

      {/* ── Brand mark + toggle ──────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 6,
          zIndex: 1,
          flexShrink: 0,
          justifyContent: collapsed ? 'center' : 'flex-start',
          paddingLeft: collapsed ? 0 : 4,
        }}
      >
        <a
          href="/"
          onClick={(e) => go(e, '/')}
          aria-label={brandName}
          title={brandName}
          style={{
            width: 36,
            height: 36,
            minWidth: 36,
            borderRadius: T.r.md,
            background: T.primaryGrad,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            boxShadow: '0 4px 14px rgba(23,77,56,0.28)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 16,
            fontFamily: "'IBM Plex Sans', sans-serif",
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          {brandMark}
        </a>
        {!collapsed && (
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: T.textPrimary,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {brandName}
          </span>
        )}
      </div>

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

      {/* ── Nav list with groups ─────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          width: '100%',
          zIndex: 1,
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          minHeight: 0,
        }}
      >
        {groupedItems.map((section, sIdx) => (
          <React.Fragment key={section.group?.id ?? '_ungrouped'}>
            {section.group && (
              <div
                style={{
                  marginTop: sIdx > 0 ? 8 : 2,
                  marginBottom: 2,
                  paddingLeft: collapsed ? 0 : 8,
                }}
              >
                {!collapsed ? (
                  <Mono size={9} spacing="1px" color={T.textMuted}>
                    {section.group.label.toUpperCase()}
                  </Mono>
                ) : (
                  <div
                    aria-hidden
                    style={{
                      width: '60%',
                      height: 1,
                      background: T.divider,
                      margin: '4px auto',
                    }}
                  />
                )}
              </div>
            )}
            {section.items.map((item) => {
              const active = isActive(item.href, currentPath);
              const m = item.module ? T[item.module] : null;
              const accent = active ? (m ? m.color : T.primary) : T.textMuted;
              const tintBg = active
                ? (m ? m.bg : T.primaryBg)
                : 'transparent';
              const tintBorder = active
                ? (m ? `${m.color}30` : T.primaryBorder)
                : 'transparent';

              const linkContent = (
                <a
                  href={item.href}
                  onClick={(e) => go(e, item.href)}
                  aria-current={active ? 'page' : undefined}
                  aria-disabled={item.disabled || undefined}
                  title={collapsed ? undefined : item.label}
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: collapsed ? 'column' : 'row',
                    alignItems: 'center',
                    gap: collapsed ? 2 : 10,
                    padding: collapsed ? '8px 4px' : '8px 10px',
                    borderRadius: T.r.md,
                    border: `1px solid ${tintBorder}`,
                    background: tintBg,
                    cursor: item.disabled ? 'not-allowed' : 'pointer',
                    opacity: item.disabled ? 0.4 : 1,
                    transition: 'all 0.15s',
                    textDecoration: 'none',
                    position: 'relative',
                    flexShrink: 0,
                  }}
                >
                  <Ico
                    name={item.icon}
                    size={collapsed ? 18 : 16}
                    color={accent}
                    sw={active ? 2 : 1.6}
                  />
                  {collapsed ? (
                    <Mono size={8} spacing="0.3px" color={accent}>
                      {item.shortLabel ?? item.label.slice(0, 8)}
                    </Mono>
                  ) : (
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: active ? 600 : 500,
                        color: active ? accent : T.textSecondary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                      }}
                    >
                      {item.label}
                    </span>
                  )}
                  {item.badge != null && item.badge > 0 && (
                    <span
                      aria-label={`${item.badge} novos`}
                      style={{
                        position: collapsed ? 'absolute' : 'relative',
                        top: collapsed ? 3 : undefined,
                        right: collapsed ? 3 : undefined,
                        minWidth: 18,
                        height: 18,
                        padding: '0 5px',
                        borderRadius: 999,
                        background: T.danger,
                        color: '#fff',
                        fontSize: 10,
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 3px rgba(154,32,32,0.30)',
                        flexShrink: 0,
                      }}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </a>
              );

              return (
                <Tooltip
                  key={item.id}
                  label={item.label}
                  visible={collapsed}
                >
                  {linkContent}
                </Tooltip>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* ── Footer: collapse toggle + search + user ──────────────── */}
      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          zIndex: 1,
          paddingTop: 8,
          flexShrink: 0,
        }}
      >
        {/* Collapse toggle */}
        {onCollapsedChange && (
          <Tooltip label={collapsed ? 'Expandir menu' : 'Recolher menu'} visible={collapsed}>
            <button
              type="button"
              onClick={() => onCollapsedChange(!collapsed)}
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: collapsed ? 'center' : 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 10,
                padding: collapsed ? '7px 4px' : '7px 10px',
                borderRadius: T.r.md,
                border: `1px solid ${T.glassBorder}`,
                background: T.glass,
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: "'IBM Plex Sans', sans-serif",
                color: T.textSecondary,
                fontSize: 12,
              }}
            >
              <Ico
                name={collapsed ? 'arrowRight' : 'arrowLeft'}
                size={14}
                color={T.textMuted}
                sw={1.7}
              />
              {!collapsed && (
                <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                  Recolher
                </span>
              )}
            </button>
          </Tooltip>
        )}

        {onSearchClick && (
          <Tooltip label="Buscar (⌘K)" visible={collapsed}>
            <button
              type="button"
              onClick={onSearchClick}
              aria-label="Buscar (⌘K)"
              title={collapsed ? undefined : 'Buscar (⌘K)'}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 10,
                padding: collapsed ? '7px 4px' : '7px 10px',
                borderRadius: T.r.md,
                border: `1px solid ${T.glassBorder}`,
                background: T.glass,
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              <Ico name="search" size={14} color={T.textSecondary} sw={1.7} />
              {collapsed ? (
                <Mono size={9} spacing="0.3px" color={T.textMuted}>
                  ⌘K
                </Mono>
              ) : (
                <>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: T.textSecondary,
                      flex: 1,
                      textAlign: 'left',
                    }}
                  >
                    Buscar
                  </span>
                  <Mono size={9} spacing="0.3px" color={T.textMuted}>
                    ⌘K
                  </Mono>
                </>
              )}
            </button>
          </Tooltip>
        )}

        {user && (
          <Tooltip label={`${user.name}${user.role ? ' · ' + user.role : ''}`} visible={collapsed}>
            <button
              type="button"
              onClick={onUserClick}
              aria-label={`Conta de ${user.name}${user.role ? ` (${user.role})` : ''}`}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 10,
                padding: collapsed ? '6px 4px' : '6px 10px',
                borderRadius: T.r.md,
                border: `1px solid transparent`,
                background: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  borderRadius: '50%',
                  border: `1px solid ${T.primaryBorder}`,
                  background: user.avatarUrl
                    ? `url("${user.avatarUrl}") center/cover`
                    : T.primaryGrad,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(23,77,56,0.22)',
                }}
              >
                {!user.avatarUrl &&
                  (user.initials ?? fallbackInitials(user.name))}
              </span>
              {!collapsed && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    lineHeight: 1.2,
                    overflow: 'hidden',
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
                      maxWidth: 140,
                    }}
                  >
                    {user.name}
                  </span>
                  {user.role && (
                    <Mono size={9} spacing="0.4px" color={T.textMuted}>
                      {user.role}
                    </Mono>
                  )}
                </div>
              )}
            </button>
          </Tooltip>
        )}
      </div>
    </nav>
  );
}
