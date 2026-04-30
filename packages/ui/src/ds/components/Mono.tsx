import * as React from 'react';
import { T } from '../../tokens';

export interface MonoProps {
  children?: React.ReactNode;
  size?: number;
  color?: string;
  spacing?: string;
  weight?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Mono({
  children,
  size = 12,
  color,
  spacing = '0.8px',
  weight = 500,
  className,
  style,
}: MonoProps) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontWeight: weight,
        fontSize: size,
        letterSpacing: spacing,
        color: color ?? T.textMuted,
        lineHeight: 1.2,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
