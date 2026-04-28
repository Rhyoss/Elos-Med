'use client';
import * as React from 'react';
import { T } from '../../tokens';
import { Ico, type IcoName } from './Ico';

export type ModuleKey = 'clinical' | 'aiMod' | 'supply' | 'financial' | 'accentMod' | null;

export interface ToolbarTool {
  label: string;
  icon: IcoName;
  /** Stable identifier returned to the host on click. */
  action: string;
  primary?: boolean;
  /** Numeric badge rendered top-right of the tool. */
  badge?: number | string;
  disabled?: boolean;
}

export interface TopToolbarProps {
  /** Module title shown left of the divider. */
  title: string;
  /** Module icon (left of the title). */
  icon?: IcoName;
  /** Module color theme (drives primary button + theme accents). */
  module?: ModuleKey;
  tools: ToolbarTool[];
  onAction?: (action: string) => void;
  /** Custom right-side slot (e.g. user menu, notifications). Replaces defaults if provided. */
  trailing?: React.ReactNode;
}

/**
 * Standard module header. Mirrors the reference TopToolbar pattern:
 * title + icon | tool buttons | primary actions | trailing slot.
 *
 * Only the title/icon/tools/trailing are visual concerns — clicks are routed
 * back to the host via `onAction(action)` so each page wires its own behavior.
 */
export function TopToolbar({
  title,
  icon,
  module = null,
  tools,
  onAction,
  trailing,
}: TopToolbarProps) {
  const m = module ? T[module] : null;
  const themeColor = m ? m.color : T.primary;
  const primaryTools = tools.filter((t) => t.primary);
  const secondaryTools = tools.filter((t) => !t.primary);

  return (
    <div
      style={{
        height: 52,
        background: T.glass,
        backdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
        WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
        borderBottom: `1px solid ${T.glassBorder}`,
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.5) inset, 0 4px 12px rgba(0,0,0,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        gap: 12,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && <Ico name={icon} size={18} color={themeColor} sw={2} />}
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: T.textPrimary,
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>
        </div>
        {secondaryTools.length > 0 && (
          <>
            <div style={{ width: 1, height: 24, background: T.divider }} />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {secondaryTools.map((tool) => (
                <ToolButton
                  key={tool.action}
                  tool={tool}
                  onClick={() => onAction?.(tool.action)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {primaryTools.map((tool) => (
          <button
            key={tool.action}
            type="button"
            disabled={tool.disabled}
            onClick={() => onAction?.(tool.action)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: T.r.md,
              background: themeColor,
              border: 'none',
              color: '#fff',
              fontSize: 11,
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontWeight: 600,
              cursor: tool.disabled ? 'not-allowed' : 'pointer',
              boxShadow: `0 2px 8px ${themeColor}30`,
              transition: 'all 0.15s',
              opacity: tool.disabled ? 0.4 : 1,
            }}
          >
            <Ico name={tool.icon} size={13} color="#fff" sw={2} />
            <span>{tool.label}</span>
          </button>
        ))}
        {trailing}
      </div>
    </div>
  );
}

function ToolButton({
  tool,
  onClick,
}: {
  tool: ToolbarTool;
  onClick: () => void;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      disabled={tool.disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: T.r.md,
        background: hover ? T.glass : 'transparent',
        border: `1px solid ${hover ? T.glassBorder : 'transparent'}`,
        color: hover ? T.textPrimary : T.textSecondary,
        fontSize: 11,
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontWeight: 500,
        cursor: tool.disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
        opacity: tool.disabled ? 0.4 : 1,
      }}
    >
      <Ico name={tool.icon} size={13} color="currentColor" sw={1.6} />
      <span>{tool.label}</span>
      {tool.badge !== undefined && (
        <div
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 16,
            height: 16,
            borderRadius: 999,
            background: T.danger,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            boxShadow: '0 2px 4px rgba(154,32,32,0.3)',
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>
            {tool.badge}
          </span>
        </div>
      )}
    </button>
  );
}
