'use client';

import * as React from 'react';
import { T, Glass, Mono, Ico, Skeleton, type IcoName } from '@dermaos/ui/ds';

/* ── Date helpers ──────────────────────────────────────────────────────────── */

export function isoNDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ── Number formatting ─────────────────────────────────────────────────────── */

export function fmtCurrency(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
export function fmtCurrencyFull(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
export function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(1)}%`;
}
export function fmtPctRaw(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v.toFixed(1)}%`;
}
export function fmtNum(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR');
}
export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h${m > 0 ? ` ${m}min` : ''}`;
}

/* ── Trend badge ───────────────────────────────────────────────────────────── */

export function TrendBadge({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value == null) return null;
  const positive = invert ? value <= 0 : value >= 0;
  const color = value === 0 ? T.textMuted : positive ? T.success : T.danger;
  return (
    <span
      style={{
        fontSize: 11,
        fontFamily: "'IBM Plex Mono', monospace",
        fontWeight: 600,
        color,
        padding: '1px 6px',
        borderRadius: 4,
        background: `${color}12`,
      }}
    >
      {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

/* ── KPI Card (uses real backend KpiValue shape) ───────────────────────────── */

interface KpiCardProps {
  label: string;
  value: string;
  icon: IcoName;
  trend?: number | null;
  trendInvert?: boolean;
  mod?: 'clinical' | 'financial' | 'supply' | 'aiMod' | 'accentMod';
  loading?: boolean;
}

export function KpiCard({ label, value, icon, trend, trendInvert, mod, loading }: KpiCardProps) {
  const accent = mod ? T[mod].color : T.primary;
  const accentBg = mod ? T[mod].bg : T.primaryBg;
  if (loading) {
    return (
      <Glass hover style={{ padding: '20px 22px' }}>
        <Skeleton width={100} height={10} />
        <Skeleton width={80} height={28} style={{ marginTop: 14 }} />
        <Skeleton width={60} height={10} style={{ marginTop: 8 }} />
      </Glass>
    );
  }
  return (
    <Glass hover style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <Mono size={11} spacing="1px" color={accent}>{label.toUpperCase()}</Mono>
        <div
          style={{
            width: 34, height: 34, borderRadius: T.r.md,
            background: accentBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <Ico name={icon} size={17} color={accent} />
        </div>
      </div>
      <p style={{ fontSize: 28, fontWeight: 700, color: T.textPrimary, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 6 }}>
        {value}
      </p>
      {trend != null && <TrendBadge value={trend} invert={trendInvert} />}
    </Glass>
  );
}

/* ── Unavailable Card ──────────────────────────────────────────────────────── */

export function UnavailableCard({ title, reason }: { title: string; reason: string }) {
  return (
    <Glass style={{ padding: '20px 22px', opacity: 0.65 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Ico name="alert" size={16} color={T.textMuted} />
        <Mono size={11} spacing="1px" color={T.textMuted}>{title.toUpperCase()}</Mono>
      </div>
      <p style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5 }}>
        {reason}
      </p>
      {/* TODO: Implementar endpoint backend para esta métrica */}
    </Glass>
  );
}

/* ── Section Header ────────────────────────────────────────────────────────── */

export function SectionHeader({
  icon, color, title, action,
}: { icon: IcoName; color?: string; title: string; action?: React.ReactNode }) {
  const c = color ?? T.primary;
  return (
    <div
      style={{
        padding: '14px 18px',
        borderBottom: `1px solid ${T.divider}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 28, height: 28, borderRadius: T.r.sm,
            background: `${c}10`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <Ico name={icon} size={14} color={c} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{title}</span>
      </div>
      {action}
    </div>
  );
}

/* ── Mini bar chart (SVG) ──────────────────────────────────────────────────── */

interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  color?: string;
  height?: number;
}

export function MiniBarChart({ data, color = T.clinical.color, height = 100 }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
          <Mono size={7} color={T.textMuted}>{fmtNum(d.value)}</Mono>
          <div
            style={{
              width: '100%',
              borderRadius: `${T.r.sm}px ${T.r.sm}px 0 0`,
              background: `linear-gradient(180deg, ${color}, ${color}88)`,
              height: `${Math.max(2, (d.value / max) * (height - 20))}px`,
              transition: 'height 0.6s',
              minWidth: 12,
            }}
          />
          <Mono size={7}>{d.label}</Mono>
        </div>
      ))}
    </div>
  );
}

/* ── Horizontal bar (for ranked lists) ─────────────────────────────────────── */

export function HBar({ label, value, max, color, suffix }: {
  label: string; value: number; max: number; color?: string; suffix?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const c = color ?? T.primary;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span style={{ fontSize: 12, color: T.textSecondary, width: 140, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: T.divider, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: c, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, width: 80, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>
        {suffix ?? fmtNum(value)}
      </span>
    </div>
  );
}

/* ── Funnel visualization ──────────────────────────────────────────────────── */

export function FunnelBar({ steps }: { steps: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {steps.map((s, i) => {
        const pct = (s.value / max) * 100;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: T.textSecondary, width: 120, flexShrink: 0 }}>{s.label}</span>
            <div style={{ flex: 1, height: 20, borderRadius: T.r.sm, background: T.divider, overflow: 'hidden', position: 'relative' }}>
              <div
                style={{
                  height: '100%', width: `${pct}%`, borderRadius: T.r.sm,
                  background: `linear-gradient(90deg, ${s.color}, ${s.color}cc)`,
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, width: 60, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>
              {fmtNum(s.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Loading grid for KPIs ─────────────────────────────────────────────────── */

export function KpiLoadingGrid({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(count, 5)}, minmax(0, 1fr))`, gap: 10, marginBottom: 20 }}>
      {Array.from({ length: count }).map((_, i) => (
        <KpiCard key={i} label="" value="" icon="activity" loading />
      ))}
    </div>
  );
}
