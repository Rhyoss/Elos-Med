import * as React from 'react';
import { T } from '../../tokens';
import { Glass } from './Glass';
import { Mono } from './Mono';
import { Ico, type IcoName } from './Ico';

export interface EmptyStateProps {
  /** Eyebrow label rendered above the figure (defaults to "ESTADO VAZIO"). */
  label?: string;
  icon?: IcoName;
  title: string;
  description?: React.ReactNode;
  /** Slot for the call-to-action — typically a `<Btn small ...>`. */
  action?: React.ReactNode;
  /** Tone of the surface. `danger` is used by `ErrorState`. */
  tone?: 'primary' | 'danger';
  className?: string;
  style?: React.CSSProperties;
}

export function EmptyState({
  label = 'ESTADO VAZIO',
  icon = 'users',
  title,
  description,
  action,
  tone = 'primary',
  className,
  style,
}: EmptyStateProps) {
  const isDanger = tone === 'danger';
  const tintBg     = isDanger ? T.dangerBg     : T.primaryBg;
  const tintBorder = isDanger ? T.dangerBorder : T.primaryBorder;
  const iconColor  = isDanger ? T.danger       : T.primary;
  const labelColor = isDanger ? T.danger       : T.textMuted;

  return (
    <Glass
      className={className}
      style={{
        padding: 32,
        ...(isDanger ? { border: `1px solid ${T.dangerBorder}` } : null),
        ...style,
      }}
    >
      <Mono size={10} spacing="1.1px" color={labelColor}>
        {label}
      </Mono>
      <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: T.r.lg,
            background: tintBg,
            border: `1px solid ${tintBorder}`,
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ico name={icon} size={26} color={iconColor} />
        </div>
        <p style={{ fontSize: 18, fontWeight: 600, color: T.textPrimary, marginBottom: 6 }}>
          {title}
        </p>
        {description && (
          <p
            style={{
              fontSize: 14,
              color: T.textSecondary,
              marginBottom: action ? 18 : 0,
              lineHeight: 1.55,
              maxWidth: 420,
              margin: action ? '0 auto 18px' : '0 auto',
            }}
          >
            {description}
          </p>
        )}
        {action}
      </div>
    </Glass>
  );
}
