import * as React from 'react';
import { T } from '../../tokens.js';
import { Mono } from './Mono.js';

export interface DividerProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Divider({ children, className, style }: DividerProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        margin: '8px 0 22px',
        ...style,
      }}
    >
      {children != null && (
        <Mono size={10} spacing="1.6px" color={T.textMuted}>
          {children}
        </Mono>
      )}
      <div
        style={{
          flex: 1,
          height: 1,
          background: `linear-gradient(90deg, ${T.divider}, transparent)`,
        }}
      />
    </div>
  );
}
