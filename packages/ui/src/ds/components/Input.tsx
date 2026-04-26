'use client';
import * as React from 'react';
import { T } from '../../tokens.js';
import { Ico, type IcoName } from './Ico.js';

// ── Shared style ─────────────────────────────────────────────────────
function fieldStyle(focused: boolean, error: boolean | string | undefined): React.CSSProperties {
  return {
    width: '100%',
    padding: '9px 13px',
    borderRadius: T.r.md,
    background: T.inputBg,
    border: `1px solid ${error ? T.danger : focused ? T.inputFocus : T.inputBorder}`,
    color: T.textPrimary,
    fontSize: 13,
    fontFamily: "'IBM Plex Sans', sans-serif",
    outline: 'none',
    transition: 'all 0.2s',
    boxShadow: error
      ? `0 0 0 3px ${T.dangerBg}`
      : focused
        ? `0 0 0 3px ${T.inputFocusRing}`
        : 'none',
  };
}

// ── Input ────────────────────────────────────────────────────────────
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  leadingIcon?: IcoName;
  /** Truthy = error state; if string, used as aria-errormessage. */
  error?: boolean | string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { leadingIcon, error, disabled, onFocus, onBlur, style, type = 'text', ...rest },
  ref,
) {
  const [focused, setFocused] = React.useState(false);
  const inputEl = (
    <input
      ref={ref}
      type={type}
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={{
        ...fieldStyle(focused, error),
        paddingLeft: leadingIcon ? 32 : 13,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'text',
        ...style,
      }}
      {...rest}
    />
  );
  if (!leadingIcon) return inputEl;
  return (
    <div style={{ position: 'relative' }}>
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Ico name={leadingIcon} size={14} color={T.textMuted} />
      </span>
      {inputEl}
    </div>
  );
});

// ── Textarea ─────────────────────────────────────────────────────────
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean | string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { error, disabled, onFocus, onBlur, style, rows = 3, ...rest },
    ref,
  ) {
    const [focused, setFocused] = React.useState(false);
    return (
      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={{
          ...fieldStyle(focused, error),
          resize: 'vertical',
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
          ...style,
        }}
        {...rest}
      />
    );
  },
);

// ── Select (native) ──────────────────────────────────────────────────
export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  error?: boolean | string;
}

const CHEVRON_BG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' " +
  "width='14' height='14' viewBox='0 0 24 24' fill='none' " +
  "stroke='%238E8E8E' stroke-width='1.7' stroke-linecap='round' " +
  "stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")";

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { error, disabled, onFocus, onBlur, style, children, ...rest },
  ref,
) {
  const [focused, setFocused] = React.useState(false);
  return (
    <select
      ref={ref}
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={{
        ...fieldStyle(focused, error),
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        appearance: 'none',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        backgroundImage: CHEVRON_BG,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        paddingRight: 32,
        ...style,
      }}
      {...rest}
    >
      {children}
    </select>
  );
});

// ── Field — label + control wrapper ──────────────────────────────────
export interface FieldProps {
  label?: React.ReactNode;
  icon?: IcoName;
  /** Render error tone on the label and an error message below. */
  error?: string | boolean;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Field({ label, icon, error, required, children, className, style }: FieldProps) {
  const hasErr = !!error;
  return (
    <div className={className} style={style}>
      {label != null && (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginBottom: 5,
            color: hasErr ? T.danger : T.textSecondary,
            fontSize: 11,
            fontWeight: 500,
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}
        >
          {icon && <Ico name={icon} size={13} color={hasErr ? T.danger : T.textSecondary} />}
          <span>
            {label}
            {required && <span style={{ color: T.danger, marginLeft: 3 }}>*</span>}
          </span>
        </label>
      )}
      {children}
      {typeof error === 'string' && error.length > 0 && (
        <p
          style={{
            marginTop: 4,
            fontSize: 11,
            color: T.danger,
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
