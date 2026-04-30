import * as React from 'react';
import { T } from '../../tokens';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'ai'
  | 'accent';

export interface BadgeProps {
  children?: React.ReactNode;
  variant?: BadgeVariant;
  /** Show the leading status dot. */
  dot?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const PALETTE: Record<BadgeVariant, { bg: string; fg: string; border: string }> = {
  default: { bg: T.primaryBg, fg: T.primary, border: T.primaryBorder },
  success: { bg: T.successBg, fg: T.success, border: T.successBorder },
  warning: { bg: T.warningBg, fg: T.warning, border: T.warningBorder },
  danger:  { bg: T.dangerBg,  fg: T.danger,  border: T.dangerBorder  },
  info:    { bg: T.infoBg,    fg: T.info,    border: T.infoBorder    },
  ai:      { bg: T.aiBg,      fg: T.ai,      border: T.aiBorder      },
  accent:  { bg: T.accentBg,  fg: T.accent,  border: T.accentBorder  },
};

export function Badge({
  children,
  variant = 'default',
  dot = true,
  className,
  style,
}: BadgeProps) {
  const { bg, fg, border } = PALETTE[variant];
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 11px',
        borderRadius: T.r.pill,
        background: bg,
        border: `1px solid ${border}`,
        color: fg,
        fontSize: 12,
        fontFamily: "'IBM Plex Mono', monospace",
        fontWeight: 500,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {dot && (
        <span
          aria-hidden
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: fg,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
