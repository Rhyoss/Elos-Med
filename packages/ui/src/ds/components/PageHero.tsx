import * as React from 'react';
import { T } from '../../tokens';
import { Mono } from './Mono';
import { Ico, type IcoName } from './Ico';

export interface PageHeroProps {
  /** Eyebrow label rendered above the title (e.g. data Mono uppercase). */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** Optional module accent — colors the eyebrow + icon tile. */
  module?: 'clinical' | 'aiMod' | 'supply' | 'financial' | 'accentMod';
  /**
   * Override accent color directly (e.g. `T.ai`, `T.success`). Wins over
   * `module` when both are provided. Useful for non-module accents like
   * AI-tone Analytics page header.
   */
  accent?: string;
  /** Optional icon tile rendered to the left of the title block. */
  icon?: IcoName;
  /** Right-side slot — usually action buttons. */
  actions?: React.ReactNode;
  /** Description rendered below the title. */
  description?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Page header pattern from the DS reference — eyebrow Mono in uppercase,
 * primary title, optional icon tile (module-tinted), and a right-side
 * actions slot. Use it as the first child of every Phase-4 page.
 */
export function PageHero({
  eyebrow,
  title,
  module,
  accent: accentOverride,
  icon,
  actions,
  description,
  className,
  style,
}: PageHeroProps) {
  const m = module ? T[module] : null;
  const accent = accentOverride ?? (m ? m.color : T.primary);
  /* For non-module accents we synthesize a 6%-alpha tint matching the DS pattern.
     Uses the `${color}10` shorthand (hex alpha 0x10 ≈ 6%). */
  const accentBg = accentOverride
    ? `${accentOverride}10`
    : m
      ? m.bg
      : T.primaryBg;
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 20,
        marginBottom: 28,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: 1 }}>
        {icon && (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: T.r.lg,
              background: accentBg,
              border: `1px solid ${accent}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Ico name={icon} size={24} color={accent} />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          {eyebrow != null && (
            <Mono size={11} spacing="1.3px" color={accent}>
              {eyebrow}
            </Mono>
          )}
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: T.textPrimary,
              marginTop: eyebrow != null ? 4 : 0,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            {title}
          </h1>
          {description != null && (
            <p
              style={{
                fontSize: 15,
                color: T.textSecondary,
                marginTop: 6,
                lineHeight: 1.55,
              }}
            >
              {description}
            </p>
          )}
        </div>
      </div>
      {actions != null && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

/** Format a Date as "21 JANEIRO 2026 · QUARTA-FEIRA" for use as <PageHero eyebrow>. */
export function formatHeroDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  const day = date.toLocaleDateString('pt-BR', { day: '2-digit' });
  const month = date.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
  const year = date.toLocaleDateString('pt-BR', { year: 'numeric' });
  const weekday = date
    .toLocaleDateString('pt-BR', { weekday: 'long' })
    .replace('-feira', '-FEIRA')
    .toUpperCase();
  return `${day} ${month} ${year} · ${weekday}`;
}
