import * as React from 'react';
import { T } from '../../tokens';
import { Mono } from './Mono';

export interface PillProps {
  children?: React.ReactNode;
  /** Use the burgundy accent palette instead of primary. */
  accent?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Pill({ children, accent = false, className, style }: PillProps) {
  const bg     = accent ? T.accentBg     : T.primaryBg;
  const border = accent ? T.accentBorder : T.primaryBorder;
  const color  = accent ? T.accent       : T.primary;
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 12px',
        borderRadius: T.r.pill,
        background: bg,
        border: `1px solid ${border}`,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        ...style,
      }}
    >
      <Mono size={9} color={color} spacing="1.1px">
        {children}
      </Mono>
    </div>
  );
}
