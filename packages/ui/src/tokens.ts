/**
 * ElosMed "Quite Clear" Design System — canonical tokens.
 *
 * Single source of truth for the visual layer of the platform. Mirrors the
 * `T` object from the reference (`ds-final-components.jsx`) exactly so that
 * inline-style components written against the DS reference compile without
 * modification:
 *
 *   import { T } from '@dermaos/ui';
 *   <div style={{ background: T.metalGrad, borderRadius: T.r.lg }} />
 *
 * Or, for new code, prefer the semantic groupings:
 *
 *   import { colors, surfaces, radius, shadow } from '@dermaos/ui';
 *
 * The CSS-variable mirror lives in `./tokens.css` (`--ds-*` namespace).
 */

// ── Colors ──────────────────────────────────────────────────────────
export const colors = {
  // Core palette (the four Quite Clear anchors)
  primary:      '#174D38', // Forest Green
  primaryLight: '#246652',
  primaryDark:  '#0E3325',
  accent:       '#4D1717', // Burgundy
  accentLight:  '#6B2222',
  accentDark:   '#3A1010',
  surface:      '#F2F2F2', // Cool neutral surface
  borderGray:   '#CBCBCB',

  // Tints (alpha layers used for badge/pill/button backgrounds)
  primaryBg:     'rgba(23,77,56,0.06)',
  primaryBorder: 'rgba(23,77,56,0.18)',
  primaryRing:   'rgba(23,77,56,0.10)',
  accentBg:      'rgba(77,23,23,0.06)',
  accentBorder:  'rgba(77,23,23,0.18)',

  // Text scale
  text: {
    primary:   '#1A1A1A',
    secondary: '#4A4A4A',
    tertiary:  '#6E6E6E',
    muted:     '#8E8E8E',
    inverse:   '#FAFAFA',
    link:      '#174D38',
  },

  // Semantic (non-clashing with primary/accent)
  success: { fg: '#1B7A4A', bg: 'rgba(27,122,74,0.06)',  border: 'rgba(27,122,74,0.18)' },
  warning: { fg: '#7A5E12', bg: 'rgba(122,94,18,0.06)',  border: 'rgba(122,94,18,0.18)' },
  danger:  { fg: '#9A2020', bg: 'rgba(154,32,32,0.06)',  border: 'rgba(154,32,32,0.18)' },
  info:    { fg: '#2A4A7A', bg: 'rgba(42,74,122,0.06)',  border: 'rgba(42,74,122,0.18)' },
  ai:      { fg: '#3A3A7A', bg: 'rgba(58,58,122,0.06)',  border: 'rgba(58,58,122,0.18)' },

  // Module palette (each domain gets a distinct, harmonized hue)
  modules: {
    clinical:  { color: '#174D38', bg: 'rgba(23,77,56,0.06)',  border: 'rgba(23,77,56,0.18)',  label: 'Clinical' },
    aiMod:     { color: '#3A3A7A', bg: 'rgba(58,58,122,0.06)', border: 'rgba(58,58,122,0.18)', label: 'IA / Aurora' },
    supply:    { color: '#6A4A1A', bg: 'rgba(106,74,26,0.06)', border: 'rgba(106,74,26,0.18)', label: 'Suprimentos' },
    financial: { color: '#1A4A5A', bg: 'rgba(26,74,90,0.06)',  border: 'rgba(26,74,90,0.18)',  label: 'Financeiro' },
    accentMod: { color: '#4D1717', bg: 'rgba(77,23,23,0.06)',  border: 'rgba(77,23,23,0.18)',  label: 'Marca' },
  },

  // Misc
  divider:  'rgba(200,200,200,0.45)',
  skeleton: 'rgba(200,200,200,0.18)',
} as const;

// ── Typography ──────────────────────────────────────────────────────
export const typography = {
  fontFamily: {
    sans: "'IBM Plex Sans', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
  },
  // Sans scale — interface, body, headings
  sans: {
    display: { size: 40, weight: 700, lineHeight: 1.05, letterSpacing: '-0.02em' },
    h1:      { size: 30, weight: 700, lineHeight: 1.15, letterSpacing: '-0.01em' },
    h2:      { size: 24, weight: 600, lineHeight: 1.20 },
    h3:      { size: 18, weight: 600, lineHeight: 1.30 },
    bodyLg:  { size: 17, weight: 400, lineHeight: 1.65 },
    body:    { size: 15, weight: 400, lineHeight: 1.55 },
    caption: { size: 13, weight: 400, lineHeight: 1.45 },
  },
  // Mono scale — data, labels, IDs, codes
  mono: {
    xl: { size: 28, weight: 500, letterSpacing: '-0.02em' },
    l:  { size: 18, weight: 500, letterSpacing: '0.04em'  },
    m:  { size: 13, weight: 500, letterSpacing: '0.04em'  },
    s:  { size: 11, weight: 500, letterSpacing: '1px'     },
    xs: { size: 10, weight: 500, letterSpacing: '1px'     },
  },
  weight:     { regular: 400, medium: 500, semibold: 600, bold: 700 },
  lineHeight: { tight: 1.0, snug: 1.25, normal: 1.5, relaxed: 1.65 },
} as const;

// ── Spacing (4px base) ──────────────────────────────────────────────
export const spacing = {
  1:  4,
  2:  8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// ── Border radius ───────────────────────────────────────────────────
export const radius = {
  xs:    4,
  sm:    6,
  md:   10,
  lg:   16,
  xl:   22,
  xxl:  28,
  pill: 999,
} as const;

// ── Elevation / shadow ──────────────────────────────────────────────
export const shadow = {
  sm: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
  md: '0 4px 12px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.03)',
  lg: '0 12px 36px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
  xl: '0 24px 64px rgba(0,0,0,0.10), 0 8px 20px rgba(0,0,0,0.05)',
} as const;

// ── Surfaces & materials ────────────────────────────────────────────
export const surfaces = {
  glass: {
    bg:          'rgba(255,255,255,0.42)',
    bgHover:     'rgba(255,255,255,0.58)',
    border:      'rgba(220,220,220,0.68)',
    blur:        24,   // px — used in `backdrop-filter: blur(N px)`
    saturate:    170,  // % — paired with blur for saturate(N%)
    shadow:      '0 1px 0 rgba(255,255,255,0.92) inset, 0 18px 48px rgba(0,0,0,0.06), 0 3px 10px rgba(0,0,0,0.03)',
    shadowHover: '0 1px 0 rgba(255,255,255,0.94) inset, 0 24px 56px rgba(0,0,0,0.09), 0 6px 14px rgba(0,0,0,0.04)',
  },
  metal: {
    // 8-stop anisotropic gradient — gives the brushed-nickel banding
    gradient:
      'linear-gradient(180deg, ' +
      'rgba(255,255,255,0.58) 0%, rgba(215,215,215,0.30) 14%, ' +
      'rgba(200,200,200,0.14) 30%, rgba(225,225,225,0.20) 46%, ' +
      'rgba(200,200,200,0.12) 60%, rgba(235,235,235,0.24) 74%, ' +
      'rgba(255,255,255,0.42) 88%, rgba(215,215,215,0.26) 100%)',
    border:    'rgba(190,190,190,0.52)',
    highlight: 'linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.06) 42%, transparent 100%)',
    sheen:     'repeating-linear-gradient(90deg, transparent 0px, rgba(255,255,255,0.022) 1px, transparent 2px, transparent 8px)',
  },
  // Frosted Primary — glass with primary tint + side-bar accent
  frostedPrimary: {
    background: 'linear-gradient(145deg, rgba(23,77,56,0.06), rgba(23,77,56,0.03))',
    borderLeft: '3px solid #174D38',
  },
  // Accent Tint — burgundy-tinged glass with top-bar accent
  accentTint: {
    background: 'linear-gradient(145deg, #F2F2F2, rgba(77,23,23,0.06))',
    borderTop:  '2px solid rgba(77,23,23,0.13)',
  },
  input: {
    bg:        'rgba(255,255,255,0.62)',
    border:    'rgba(200,200,200,0.80)',
    focus:     '#174D38',
    focusRing: 'rgba(23,77,56,0.10)',
  },
} as const;

// ── Gradients & background orbs ─────────────────────────────────────
export const gradients = {
  primary:        'linear-gradient(135deg, #0E3325, #174D38, #1D5A42)',
  accent:         'linear-gradient(135deg, #3A1010, #4D1717, #5E1E1E)',
  bg:             'linear-gradient(155deg, #F6F6F6 0%, #EDEDED 100%)',
  metal:          surfaces.metal.gradient,
  metalHighlight: surfaces.metal.highlight,
  metalSheen:     surfaces.metal.sheen,
  // Ambient orbs for app background
  bgOrb1: 'radial-gradient(circle, rgba(23,77,56,0.10) 0%, transparent 70%)',
  bgOrb2: 'radial-gradient(circle, rgba(77,23,23,0.06) 0%, transparent 70%)',
} as const;

// ── Z-index scale ───────────────────────────────────────────────────
export const zIndex = {
  base:           0,
  raised:         10,
  dropdown:      100,
  sticky:        200,
  overlay:       300,
  modal:         400,
  toast:         500,
  tooltip:       600,
  criticalAlert: 700,
} as const;

// ── Motion ──────────────────────────────────────────────────────────
export const motion = {
  duration: { fast: '100ms', normal: '200ms', slow: '350ms' },
  ease: {
    standard:   'cubic-bezier(0.4, 0, 0.2, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

// ── Focus ring (canonical) ──────────────────────────────────────────
export const focusRing = {
  width:  2,
  offset: 2,
  color:  '#174D38',
  soft:   'rgba(23,77,56,0.32)',
} as const;

// ── Density (clinical density vs executive comfort) ─────────────────
export const density = {
  compact: {
    rowHeight: 36, paddingX: 12, paddingY: 6,
  },
  default: {
    rowHeight: 44, paddingX: 16, paddingY: 10,
  },
  comfortable: {
    rowHeight: 52, paddingX: 20, paddingY: 14,
  },
} as const;
export type Density = keyof typeof density;

// ── Reference-style alias (mirrors `T` 1:1) ─────────────────────────
//
// Shape preserved verbatim from `ds-final-components.jsx` so any inline-style
// component written against the DS reference works without modification.
export const T = {
  bg:     colors.surface,
  bgGrad: gradients.bg,
  bgOrb1: gradients.bgOrb1,
  bgOrb2: gradients.bgOrb2,

  glass:            surfaces.glass.bg,
  glassHover:       surfaces.glass.bgHover,
  glassBorder:      surfaces.glass.border,
  glassBlur:        surfaces.glass.blur,
  glassShadow:      surfaces.glass.shadow,
  glassHoverShadow: surfaces.glass.shadowHover,

  metalGrad:      surfaces.metal.gradient,
  metalBorder:    surfaces.metal.border,
  metalHighlight: surfaces.metal.highlight,
  metalSheen:     surfaces.metal.sheen,

  primary:       colors.primary,
  primaryLight:  colors.primaryLight,
  primaryDark:   colors.primaryDark,
  primaryGrad:   gradients.primary,
  primaryBg:     colors.primaryBg,
  primaryBorder: colors.primaryBorder,
  primaryRing:   colors.primaryRing,

  accent:       colors.accent,
  accentLight:  colors.accentLight,
  accentDark:   colors.accentDark,
  accentGrad:   gradients.accent,
  accentBg:     colors.accentBg,
  accentBorder: colors.accentBorder,

  textPrimary:   colors.text.primary,
  textSecondary: colors.text.secondary,
  textTertiary:  colors.text.tertiary,
  textMuted:     colors.text.muted,
  textInverse:   colors.text.inverse,
  textLink:      colors.text.link,

  inputBg:        surfaces.input.bg,
  inputBorder:    surfaces.input.border,
  inputFocus:     surfaces.input.focus,
  inputFocusRing: surfaces.input.focusRing,

  success:       colors.success.fg,
  successBg:     colors.success.bg,
  successBorder: colors.success.border,
  warning:       colors.warning.fg,
  warningBg:     colors.warning.bg,
  warningBorder: colors.warning.border,
  danger:        colors.danger.fg,
  dangerBg:      colors.danger.bg,
  dangerBorder:  colors.danger.border,
  info:          colors.info.fg,
  infoBg:        colors.info.bg,
  infoBorder:    colors.info.border,
  ai:            colors.ai.fg,
  aiBg:          colors.ai.bg,
  aiBorder:      colors.ai.border,

  clinical:  colors.modules.clinical,
  aiMod:     colors.modules.aiMod,
  supply:    colors.modules.supply,
  financial: colors.modules.financial,
  accentMod: colors.modules.accentMod,

  r:      radius,
  shadow,
  sp:     spacing,

  divider: colors.divider,
  skel:    colors.skeleton,
} as const;

// ── Aggregate export ────────────────────────────────────────────────
export const tokens = {
  colors,
  typography,
  spacing,
  radius,
  shadow,
  surfaces,
  gradients,
  zIndex,
  motion,
  focusRing,
  density,
} as const;

export type Tokens = typeof tokens;
export type Theme  = typeof T;
