import * as React from 'react';
import { T } from '../../tokens.js';
import { Glass } from './Glass.js';
import { Mono } from './Mono.js';
import { Ico, type IcoName } from './Ico.js';

export type StatModule = 'clinical' | 'aiMod' | 'supply' | 'financial' | 'accentMod';

export interface StatProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: IcoName;
  /** Module accent — colors label, icon and progress bar. */
  mod?: StatModule;
  /** 0–100 — renders an inline progress bar at the bottom. */
  pct?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Stat({ label, value, sub, icon, mod, pct, className, style }: StatProps) {
  const m = mod ? T[mod] : null;
  const accent = m ? m.color : T.primary;
  const accentBg = m ? m.bg : T.primaryBg;
  return (
    <Glass hover className={className} style={{ padding: '16px 18px', ...style }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
        }}
      >
        <Mono size={8} spacing="1.1px" color={accent}>
          {label.toUpperCase()}
        </Mono>
        {icon && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: T.r.md,
              background: accentBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Ico name={icon} size={14} color={accent} />
          </div>
        )}
      </div>
      <p
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: T.textPrimary,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          marginBottom: 3,
        }}
      >
        {value}
      </p>
      {sub != null && (
        <p
          style={{
            fontSize: 11,
            color: T.textMuted,
            marginBottom: pct != null ? 12 : 0,
          }}
        >
          {sub}
        </p>
      )}
      {pct != null && (
        <div
          style={{
            height: 3,
            borderRadius: 999,
            background: T.divider,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.max(0, Math.min(100, pct))}%`,
              borderRadius: 999,
              background: accent,
              transition: 'width 0.6s ease',
            }}
          />
        </div>
      )}
    </Glass>
  );
}
