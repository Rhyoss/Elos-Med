'use client';
import * as React from 'react';
import { T } from '../../tokens';
import { Ico, type IcoName } from './Ico';

export interface TabItem {
  id: string;
  label: string;
  icon?: IcoName;
  badge?: number | string;
  disabled?: boolean;
}

export interface TabBarProps {
  tabs: ReadonlyArray<TabItem>;
  activeId: string;
  onChange: (id: string) => void;
  /** Optional right-side actions slot. */
  trailing?: React.ReactNode;
  /** Module color for the active underline (defaults to primary). */
  module?: 'clinical' | 'aiMod' | 'supply' | 'financial' | 'accentMod';
}

/**
 * Inline tab bar matching the Prontuário/Comunicações reference: bottom border
 * underline, mono-friendly labels, optional trailing slot for buttons.
 *
 * Renders as a `role="tablist"` for accessibility; each tab is a real button
 * with `aria-selected`.
 */
export function TabBar({ tabs, activeId, onChange, trailing, module }: TabBarProps) {
  const accent = module ? T[module].color : T.primary;
  return (
    <div
      role="tablist"
      style={{
        padding: '0 20px',
        borderBottom: `1px solid ${T.divider}`,
        display: 'flex',
        gap: 0,
        flexShrink: 0,
        alignItems: 'stretch',
      }}
    >
      {tabs.map((t) => {
        const isActive = t.id === activeId;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-disabled={t.disabled}
            disabled={t.disabled}
            onClick={() => !t.disabled && onChange(t.id)}
            style={{
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              borderTop: 'none',
              borderRight: 'none',
              borderLeft: 'none',
              borderBottom: isActive
                ? `2px solid ${accent}`
                : '2px solid transparent',
              background: 'transparent',
              color: isActive ? accent : T.textMuted,
              fontSize: 14,
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontWeight: isActive ? 600 : 400,
              cursor: t.disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              opacity: t.disabled ? 0.4 : 1,
              position: 'relative',
            }}
          >
            {t.icon && (
              <Ico name={t.icon} size={16} color={isActive ? accent : T.textMuted} />
            )}
            {t.label}
            {t.badge !== undefined && (
              <span
                style={{
                  marginLeft: 4,
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: isActive ? accent : T.divider,
                  color: isActive ? '#fff' : T.textMuted,
                  fontSize: 11,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: 600,
                }}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
      {trailing && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 0' }}>
          {trailing}
        </div>
      )}
    </div>
  );
}
