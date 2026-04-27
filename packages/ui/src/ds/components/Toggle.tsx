'use client';
import * as React from 'react';
import { T } from '../../tokens';

export interface ToggleProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Used for `aria-label`. */
  label?: string;
  id?: string;
  name?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { checked, onChange, disabled = false, label, id, name, className, style },
  ref,
) {
  const W = 40;
  const H = 22;
  const KNOB = 18;
  const GAP = 2;
  const x = checked ? W - KNOB - GAP : GAP;
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      id={id}
      name={name}
      disabled={disabled}
      aria-checked={checked}
      aria-label={label}
      onClick={() => !disabled && onChange?.(!checked)}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onChange?.(!checked);
        }
      }}
      className={className}
      style={{
        width: W,
        height: H,
        borderRadius: 999,
        background: checked ? T.primaryGrad : 'rgba(200,200,200,0.55)',
        border: `1px solid ${checked ? 'transparent' : T.glassBorder}`,
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: checked
          ? '0 2px 8px rgba(23,77,56,0.20)'
          : 'inset 0 1px 2px rgba(0,0,0,0.06)',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.22s cubic-bezier(0.4,0,0.2,1)',
        padding: 0,
        flexShrink: 0,
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: x,
          top: GAP,
          width: KNOB,
          height: KNOB,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
          transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1)',
        }}
      />
    </button>
  );
});
