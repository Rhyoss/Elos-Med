import * as React from 'react';
import { T } from '../../tokens';

export interface BarProps {
  /** 0–100 */
  pct: number;
  color?: string;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Bar({ pct, color, height = 5, className, style }: BarProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className={className}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        height,
        borderRadius: 999,
        background: T.divider,
        overflow: 'hidden',
        flex: 1,
        ...style,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${clamped}%`,
          borderRadius: 999,
          background: color ?? T.primary,
          transition: 'width 0.6s ease',
        }}
      />
    </div>
  );
}
