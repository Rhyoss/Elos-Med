'use client';
import * as React from 'react';
import { T } from '../../tokens';
import { Ico, type IcoName } from './Ico';

export type BtnVariant = 'primary' | 'accent' | 'glass' | 'ghost' | 'danger';

export interface BtnProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: BtnVariant;
  small?: boolean;
  icon?: IcoName;
  /**
   * Render as a square icon-only button (34×34, or 28×28 with `small`).
   * Mirrors the icon-only pattern from the reference S05 panel.
   */
  iconOnly?: boolean;
  loading?: boolean;
  style?: React.CSSProperties;
}

const VARIANTS: Record<
  BtnVariant,
  { bg: string; color: string; border: string; shadow: string }
> = {
  primary: {
    bg: T.primaryGrad,
    color: T.textInverse,
    border: 'none',
    shadow:
      '0 1px 0 rgba(255,255,255,0.14) inset, 0 4px 14px rgba(23,77,56,0.22), 0 2px 4px rgba(23,77,56,0.10)',
  },
  accent: {
    bg: T.accentGrad,
    color: T.textInverse,
    border: 'none',
    shadow:
      '0 1px 0 rgba(255,255,255,0.10) inset, 0 4px 14px rgba(77,23,23,0.20), 0 2px 4px rgba(77,23,23,0.08)',
  },
  glass: {
    bg: T.glass,
    color: T.primary,
    border: `1px solid ${T.primaryBorder}`,
    shadow: T.glassShadow,
  },
  ghost: {
    bg: 'transparent',
    color: T.textSecondary,
    border: `1px solid ${T.divider}`,
    shadow: 'none',
  },
  danger: {
    bg: T.dangerBg,
    color: T.danger,
    border: `1px solid ${T.dangerBorder}`,
    shadow: '0 2px 6px rgba(154,32,32,0.08)',
  },
};

export const Btn = React.forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  {
    children,
    variant = 'primary',
    small = false,
    icon,
    iconOnly = false,
    loading = false,
    disabled,
    type = 'button',
    style,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    ...rest
  },
  ref,
) {
  const [pressed, setPressed] = React.useState(false);
  const v = VARIANTS[variant];
  const isDisabled = disabled || loading;
  const iconSize = small ? 15 : 17;
  const squareSize = small ? 32 : 40;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      onMouseDown={(e) => {
        setPressed(true);
        onMouseDown?.(e);
      }}
      onMouseUp={(e) => {
        setPressed(false);
        onMouseUp?.(e);
      }}
      onMouseLeave={(e) => {
        setPressed(false);
        onMouseLeave?.(e);
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: iconOnly ? 0 : 7,
        ...(iconOnly
          ? { width: squareSize, height: squareSize, padding: 0 }
          : { padding: small ? '7px 14px' : '10px 22px' }),
        borderRadius: small ? T.r.md : T.r.md + 2,
        background: v.bg,
        color: v.color,
        border: v.border,
        boxShadow: v.shadow,
        fontSize: small ? 13 : 15,
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontWeight: 600,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transform: pressed && !isDisabled ? 'scale(0.97)' : 'scale(1)',
        transition: 'all 0.15s cubic-bezier(0.4,0,0.2,1)',
        opacity: isDisabled ? 0.4 : 1,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        ...style,
      }}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          style={{
            width: iconSize,
            height: iconSize,
            borderRadius: '50%',
            border: `2px solid ${v.color}`,
            borderTopColor: 'transparent',
            animation: 'ds-spin 0.7s linear infinite',
            display: 'inline-block',
          }}
        />
      ) : icon ? (
        <Ico name={icon} size={iconSize} color={v.color} />
      ) : null}
      {!iconOnly && children}
    </button>
  );
});
