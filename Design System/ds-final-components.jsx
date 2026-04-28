// ds-final-components.jsx — ElosMed Quite Clear Design System
// Full token set + icon library + shared components

// ─── TOKENS ──────────────────────────────────────────────────────
const T = {
  // Background & Surface
  bg: "#F2F2F2",
  bgGrad: "linear-gradient(155deg, #F6F6F6 0%, #EDEDED 100%)",
  bgOrb1: "radial-gradient(circle, rgba(23,77,56,0.10) 0%, transparent 70%)",
  bgOrb2: "radial-gradient(circle, rgba(77,23,23,0.06) 0%, transparent 70%)",

  // Glass (neutral cool)
  glass: "rgba(255,255,255,0.42)",
  glassHover: "rgba(255,255,255,0.58)",
  glassBorder: "rgba(220,220,220,0.68)",
  glassBlur: 24,
  glassShadow: "0 1px 0 rgba(255,255,255,0.92) inset, 0 18px 48px rgba(0,0,0,0.06), 0 3px 10px rgba(0,0,0,0.03)",
  glassHoverShadow: "0 1px 0 rgba(255,255,255,0.94) inset, 0 24px 56px rgba(0,0,0,0.09), 0 6px 14px rgba(0,0,0,0.04)",

  // Metal (matte brushed nickel)
  metalGrad: `linear-gradient(180deg,
    rgba(255,255,255,0.58) 0%, rgba(215,215,215,0.30) 14%,
    rgba(200,200,200,0.14) 30%, rgba(225,225,225,0.20) 46%,
    rgba(200,200,200,0.12) 60%, rgba(235,235,235,0.24) 74%,
    rgba(255,255,255,0.42) 88%, rgba(215,215,215,0.26) 100%)`,
  metalBorder: "rgba(190,190,190,0.52)",
  metalHighlight: "linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.06) 42%, transparent 100%)",
  metalSheen: "repeating-linear-gradient(90deg, transparent 0px, rgba(255,255,255,0.022) 1px, transparent 2px, transparent 8px)",

  // Primary (Forest Green)
  primary: "#174D38",
  primaryLight: "#246652",
  primaryDark: "#0E3325",
  primaryGrad: "linear-gradient(135deg, #0E3325, #174D38, #1D5A42)",
  primaryBg: "rgba(23,77,56,0.06)",
  primaryBorder: "rgba(23,77,56,0.18)",
  primaryRing: "rgba(23,77,56,0.10)",

  // Accent (Burgundy)
  accent: "#4D1717",
  accentLight: "#6B2222",
  accentDark: "#3A1010",
  accentGrad: "linear-gradient(135deg, #3A1010, #4D1717, #5E1E1E)",
  accentBg: "rgba(77,23,23,0.06)",
  accentBorder: "rgba(77,23,23,0.18)",

  // Text (neutral cool)
  textPrimary: "#1A1A1A",
  textSecondary: "#4A4A4A",
  textTertiary: "#6E6E6E",
  textMuted: "#8E8E8E",
  textInverse: "#FAFAFA",
  textLink: "#174D38",

  // Input
  inputBg: "rgba(255,255,255,0.62)",
  inputBorder: "rgba(200,200,200,0.80)",
  inputFocus: "#174D38",
  inputFocusRing: "rgba(23,77,56,0.10)",

  // Semantic — carefully chosen to not clash with primary/accent
  success: "#1B7A4A",
  successBg: "rgba(27,122,74,0.06)",
  successBorder: "rgba(27,122,74,0.18)",
  warning: "#7A5E12",
  warningBg: "rgba(122,94,18,0.06)",
  warningBorder: "rgba(122,94,18,0.18)",
  danger: "#9A2020",
  dangerBg: "rgba(154,32,32,0.06)",
  dangerBorder: "rgba(154,32,32,0.18)",
  info: "#2A4A7A",
  infoBg: "rgba(42,74,122,0.06)",
  infoBorder: "rgba(42,74,122,0.18)",
  ai: "#3A3A7A",
  aiBg: "rgba(58,58,122,0.06)",
  aiBorder: "rgba(58,58,122,0.18)",

  // Module colors
  clinical: { color:"#174D38", bg:"rgba(23,77,56,0.06)", label:"Clinical" },
  aiMod:    { color:"#3A3A7A", bg:"rgba(58,58,122,0.06)", label:"IA / Aurora" },
  supply:   { color:"#6A4A1A", bg:"rgba(106,74,26,0.06)", label:"Suprimentos" },
  financial:{ color:"#1A4A5A", bg:"rgba(26,74,90,0.06)",  label:"Financeiro" },
  accentMod:{ color:"#4D1717", bg:"rgba(77,23,23,0.06)",  label:"Marca" },

  // Radius
  r: { xs: 4, sm: 6, md: 10, lg: 16, xl: 22, xxl: 28, pill: 999 },

  // Shadows (elevation system)
  shadow: {
    sm: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
    md: "0 4px 12px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.03)",
    lg: "0 12px 36px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)",
    xl: "0 24px 64px rgba(0,0,0,0.10), 0 8px 20px rgba(0,0,0,0.05)",
  },

  // Spacing scale (4px base)
  sp: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 },

  // Divider / Skeleton
  divider: "rgba(200,200,200,0.45)",
  skel: "rgba(200,200,200,0.18)",
};

// ─── SVG ICON LIBRARY ────────────────────────────────────────────
function Ico({ name, size = 18, color = "currentColor", sw = 1.7 }) {
  const s = { width: size, height: size, display: "inline-block", verticalAlign: "middle", flexShrink: 0 };
  const p = { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round" };
  const I = {
    grid: <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
    calendar: <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    user: <svg {...p}><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>,
    users: <svg {...p}><circle cx="9" cy="8" r="4"/><path d="M17 21a8 8 0 0 0-16 0"/><circle cx="17" cy="8" r="3"/><path d="M21 21a6 6 0 0 0-6-6"/></svg>,
    message: <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    box: <svg {...p}><path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><line x1="12" y1="13" x2="12" y2="22"/></svg>,
    creditCard: <svg {...p}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
    barChart: <svg {...p}><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>,
    settings: <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    plus: <svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    edit: <svg {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    more: <svg {...p}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>,
    search: <svg {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    alert: <svg {...p}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    check: <svg {...p}><polyline points="20 6 9 17 4 12"/></svg>,
    x: <svg {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    chevDown: <svg {...p}><polyline points="6 9 12 15 18 9"/></svg>,
    arrowRight: <svg {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
    arrowLeft: <svg {...p}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
    shield: <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    zap: <svg {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    activity: <svg {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    layers: <svg {...p}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
    clock: <svg {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    eye: <svg {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    copy: <svg {...p}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
    download: <svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    filter: <svg {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
    home: <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    bell: <svg {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    mail: <svg {...p}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>,
    phone: <svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
    star: <svg {...p} fill={color} stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    image: <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
    file: <svg {...p}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>,
    printer: <svg {...p}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
    link: <svg {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    globe: <svg {...p}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    lock: <svg {...p}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    hash: <svg {...p}><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>,
    percent: <svg {...p}><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>,
  };
  return <span style={s}>{I[name] || I.grid}</span>;
}

// ─── GLASS SURFACE ───────────────────────────────────────────────
function Glass({ children, metal = false, hover = false, active = false, style = {} }) {
  const [hov, setHov] = React.useState(false);
  return (
    <div onMouseEnter={() => hover && setHov(true)} onMouseLeave={() => hover && setHov(false)}
      style={{
        background: metal ? T.metalGrad : (hov ? T.glassHover : T.glass),
        border: `1px solid ${metal ? T.metalBorder : (active ? T.primaryBorder : T.glassBorder)}`,
        backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
        WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
        borderRadius: T.r.lg,
        boxShadow: hov ? T.glassHoverShadow : T.glassShadow,
        transition: "all 0.22s cubic-bezier(0.4,0,0.2,1)",
        position: "relative", overflow: "hidden",
        ...style,
      }}
    >
      {metal && <div style={{ position: "absolute", inset: 0, background: T.metalSheen, opacity: 0.55, pointerEvents: "none" }} />}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "44%", background: T.metalHighlight, borderRadius: `${T.r.lg}px ${T.r.lg}px 0 0`, pointerEvents: "none", opacity: metal ? 0.55 : 0.18 }} />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

// ─── MONO LABEL ──────────────────────────────────────────────────
function Mono({ children, size = 10, color, spacing = "1.1px", weight = 500 }) {
  return <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: weight, fontSize: size, letterSpacing: spacing, color: color || T.textMuted, lineHeight: 1.2 }}>{children}</span>;
}

// ─── SECTION DIVIDER ─────────────────────────────────────────────
function Divider({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "8px 0 22px" }}>
      <Mono size={10} spacing="1.6px" color={T.textMuted}>{children}</Mono>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${T.divider}, transparent)` }} />
    </div>
  );
}

// ─── PILL ────────────────────────────────────────────────────────
function Pill({ children, accent = false }) {
  const bg = accent ? T.accentBg : T.primaryBg;
  const brd = accent ? T.accentBorder : T.primaryBorder;
  const clr = accent ? T.accent : T.primary;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: T.r.pill, background: bg, border: `1px solid ${brd}`, backdropFilter: "blur(10px)" }}>
      <Mono size={9} color={clr} spacing="1.1px">{children}</Mono>
    </div>
  );
}

// ─── BADGE ───────────────────────────────────────────────────────
function Badge({ children, variant = "default", dot = true }) {
  const map = {
    default: [T.primaryBg, T.primary, T.primaryBorder],
    success: [T.successBg, T.success, T.successBorder],
    warning: [T.warningBg, T.warning, T.warningBorder],
    danger:  [T.dangerBg, T.danger, T.dangerBorder],
    info:    [T.infoBg, T.info, T.infoBorder],
    ai:      [T.aiBg, T.ai, T.aiBorder],
    accent:  [T.accentBg, T.accent, T.accentBorder],
  };
  const [bg, color, brd] = map[variant] || map.default;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: T.r.pill, background: bg, border: `1px solid ${brd}`, color, fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 500 }}>
      {dot && <span style={{ width: 4, height: 4, borderRadius: "50%", background: color, flexShrink: 0 }} />}
      {children}
    </span>
  );
}

// ─── BUTTON ──────────────────────────────────────────────────────
function Btn({ children, variant = "primary", small = false, icon, disabled = false, onClick }) {
  const [pressed, setPressed] = React.useState(false);
  const V = {
    primary: { bg: T.primaryGrad, color: T.textInverse, border: "none", shadow: "0 1px 0 rgba(255,255,255,0.14) inset, 0 4px 14px rgba(23,77,56,0.22), 0 2px 4px rgba(23,77,56,0.10)" },
    accent:  { bg: T.accentGrad, color: T.textInverse, border: "none", shadow: "0 1px 0 rgba(255,255,255,0.10) inset, 0 4px 14px rgba(77,23,23,0.20), 0 2px 4px rgba(77,23,23,0.08)" },
    glass:   { bg: T.glass, color: T.primary, border: `1px solid ${T.primaryBorder}`, shadow: T.glassShadow },
    ghost:   { bg: "transparent", color: T.textSecondary, border: `1px solid ${T.divider}`, shadow: "none" },
    danger:  { bg: T.dangerBg, color: T.danger, border: `1px solid ${T.dangerBorder}`, shadow: "0 2px 6px rgba(154,32,32,0.08)" },
  };
  const v = V[variant] || V.primary;
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: small ? "5px 12px" : "9px 18px",
        borderRadius: small ? T.r.md : T.r.md + 1,
        background: v.bg, color: v.color, border: v.border || "none",
        boxShadow: v.shadow, fontSize: small ? 11 : 13,
        fontFamily: "'IBM Plex Sans',sans-serif", fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transform: pressed ? "scale(0.97)" : "scale(1)",
        transition: "all 0.15s cubic-bezier(0.4,0,0.2,1)",
        opacity: disabled ? 0.4 : 1, letterSpacing: "0.01em",
      }}>
      {icon && <Ico name={icon} size={small ? 13 : 15} color={v.color} />}
      {children}
    </button>
  );
}

// ─── STAT CARD ───────────────────────────────────────────────────
function Stat({ label, value, sub, icon, mod, pct }) {
  const m = mod ? T[mod] : null;
  return (
    <Glass hover style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <Mono size={8} spacing="1.1px" color={m ? m.color : T.primary}>{label.toUpperCase()}</Mono>
        {icon && <div style={{ width: 28, height: 28, borderRadius: T.r.md, background: m ? m.bg : T.primaryBg, display: "flex", alignItems: "center", justifyContent: "center" }}><Ico name={icon} size={14} color={m ? m.color : T.primary} /></div>}
      </div>
      <p style={{ fontSize: 26, fontWeight: 700, color: T.textPrimary, letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 3 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: T.textMuted, marginBottom: pct != null ? 12 : 0 }}>{sub}</p>}
      {pct != null && (
        <div style={{ height: 3, borderRadius: 999, background: T.divider, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: m ? m.color : T.primary, transition: "width 0.6s ease" }} />
        </div>
      )}
    </Glass>
  );
}

// ─── BAR ─────────────────────────────────────────────────────────
function Bar({ pct, color, height = 5 }) {
  return (
    <div style={{ height, borderRadius: 999, background: T.divider, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: color || T.primary, transition: "width 0.6s ease" }} />
    </div>
  );
}

// ─── COMPLIANCE TAG (metal) ──────────────────────────────────────
function MetalTag({ children }) {
  return (
    <span style={{ padding: "3px 9px", borderRadius: T.r.sm, background: T.metalGrad, border: `1px solid ${T.metalBorder}`, fontSize: 9, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 500, letterSpacing: "1.1px", color: T.textSecondary, boxShadow: "0 1px 0 rgba(255,255,255,0.65) inset", position: "relative", overflow: "hidden" }}>
      {children}
    </span>
  );
}

Object.assign(window, {
  T, Ico, Glass, Mono, Divider, Pill, Badge, Btn, Stat, Bar, MetalTag,
});
