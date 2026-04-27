import * as React from 'react';
import { T } from '../../tokens';

export interface MetalTagProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function MetalTag({ children, className, style }: MetalTagProps) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        padding: '3px 9px',
        borderRadius: T.r.sm,
        background: T.metalGrad,
        border: `1px solid ${T.metalBorder}`,
        fontSize: 9,
        fontFamily: "'IBM Plex Mono', monospace",
        fontWeight: 500,
        letterSpacing: '1.1px',
        color: T.textSecondary,
        boxShadow: '0 1px 0 rgba(255,255,255,0.65) inset',
        position: 'relative',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
