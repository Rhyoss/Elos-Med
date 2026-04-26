'use client';
import * as React from 'react';
import { T } from '../../tokens.js';

export interface GlassProps {
  children?: React.ReactNode;
  /** Render with the matte brushed-nickel material instead of glass. */
  metal?: boolean;
  /** Enable hover-state lift (background, shadow). */
  hover?: boolean;
  /** Mark as actively-selected — uses primary border. */
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Glass({
  children,
  metal = false,
  hover = false,
  active = false,
  className,
  style,
}: GlassProps) {
  const [hov, setHov] = React.useState(false);
  return (
    <div
      onMouseEnter={() => hover && setHov(true)}
      onMouseLeave={() => hover && setHov(false)}
      className={className}
      style={{
        background: metal ? T.metalGrad : hov ? T.glassHover : T.glass,
        border: `1px solid ${
          metal ? T.metalBorder : active ? T.primaryBorder : T.glassBorder
        }`,
        backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
        WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
        borderRadius: T.r.lg,
        boxShadow: hov ? T.glassHoverShadow : T.glassShadow,
        transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {metal && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: T.metalSheen,
            opacity: 0.55,
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '44%',
          background: T.metalHighlight,
          borderRadius: `${T.r.lg}px ${T.r.lg}px 0 0`,
          pointerEvents: 'none',
          opacity: metal ? 0.55 : 0.18,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}
