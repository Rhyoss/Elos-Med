import * as React from 'react';
import { T } from '../../tokens.js';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  /** Border radius in px. */
  radius?: number;
  /** Stagger the shimmer animation when rendering many at once (ms). */
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({
  width = '100%',
  height = 14,
  radius = T.r.sm,
  delay = 0,
  className,
  style,
}: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        width,
        height,
        borderRadius: radius,
        background: `linear-gradient(90deg, ${T.skel}, rgba(200,200,200,0.25), ${T.skel})`,
        backgroundSize: '200% 100%',
        animation: `ds-shimmer 1.8s ease-in-out ${delay}ms infinite`,
        ...style,
      }}
    />
  );
}
