'use client';
import * as React from 'react';
import { T } from '../../tokens';
import {
  Sidebar,
  SIDEBAR_COLLAPSED_W,
  SIDEBAR_EXPANDED_W,
  type SidebarProps,
} from './Sidebar';
import { TopBar, type TopBarProps } from './TopBar';

export interface ShellProps extends Omit<SidebarProps, 'className' | 'collapsed' | 'onCollapsedChange'> {
  children: React.ReactNode;
  ambient?: boolean;
  contentClassName?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  topBar?:
    | false
    | (Omit<TopBarProps, 'navItems' | 'currentPath' | 'user' | 'brandName' | 'onNavigate'> & {
        title?: string;
        notificationCount?: number;
      });
}

export function Shell({
  children,
  ambient = true,
  contentClassName,
  topBar,
  collapsed = true,
  onCollapsedChange,
  ...sidebarProps
}: ShellProps) {
  const showTopBar = topBar !== false;
  const topBarProps = topBar === false ? null : topBar ?? null;
  const sidebarW = collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${sidebarW}px 1fr`,
        height: '100vh',
        overflow: 'hidden',
        background: T.bgGrad,
        position: 'relative',
        fontFamily: "'IBM Plex Sans', sans-serif",
        color: T.textPrimary,
        transition: 'grid-template-columns 0.2s ease',
      }}
    >
      {ambient && (
        <>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: -120,
              top: -80,
              width: 400,
              height: 400,
              borderRadius: '50%',
              background: T.bgOrb1,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: -80,
              bottom: -80,
              width: 340,
              height: 340,
              borderRadius: '50%',
              background: T.bgOrb2,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        </>
      )}

      <Sidebar
        {...sidebarProps}
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {showTopBar && (
          <TopBar
            brandName={sidebarProps.brandName}
            navItems={sidebarProps.navItems}
            currentPath={sidebarProps.currentPath}
            user={sidebarProps.user}
            onSearchClick={sidebarProps.onSearchClick}
            onUserClick={sidebarProps.onUserClick}
            onNavigate={sidebarProps.onNavigate}
            {...(topBarProps ?? {})}
          />
        )}

        <main
          id="main-content"
          className={contentClassName}
          tabIndex={-1}
          style={{
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            flex: 1,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
