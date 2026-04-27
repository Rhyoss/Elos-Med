'use client';
import * as React from 'react';
import { T } from '../../tokens';
import { Sidebar, type SidebarProps } from './Sidebar';

export interface ShellProps extends Omit<SidebarProps, 'className'> {
  children: React.ReactNode;
  /** Render ambient background orbs (radial gradients) behind the content. */
  ambient?: boolean;
  /** Class applied to the main content area. */
  contentClassName?: string;
}

/**
 * App Shell — 120px DS Sidebar + content area.
 *
 * The shell owns the page background (`bgGrad`) and the ambient orbs;
 * each page should render its own header section per the DS reference
 * (date, title, action buttons) inside the content area.
 */
export function Shell({
  children,
  ambient = true,
  contentClassName,
  ...sidebarProps
}: ShellProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr',
        height: '100vh',
        overflow: 'hidden',
        background: T.bgGrad,
        position: 'relative',
        fontFamily: "'IBM Plex Sans', sans-serif",
        color: T.textPrimary,
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

      <Sidebar {...sidebarProps} />

      <main
        id="main-content"
        className={contentClassName}
        tabIndex={-1}
        style={{
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1,
          minWidth: 0,
        }}
      >
        {children}
      </main>
    </div>
  );
}
