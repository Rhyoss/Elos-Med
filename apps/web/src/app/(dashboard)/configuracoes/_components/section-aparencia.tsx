'use client';

import * as React from 'react';
import {
  Glass, Btn, Mono, Ico, MetalTag, T,
} from '@dermaos/ui/ds';
import { useAuth } from '@/lib/auth';
import { trpc } from '@/lib/trpc-provider';

const THEME_COLORS = [
  { label: 'Primário', value: '#174D38', token: 'primary' },
  { label: 'Acento', value: '#4D1717', token: 'accent' },
  { label: 'Fundo', value: '#F5F3EF', token: 'background' },
  { label: 'Card', value: 'rgba(255,255,255,0.72)', token: 'glass' },
  { label: 'Texto', value: '#1A1A1A', token: 'textPrimary' },
  { label: 'Sucesso', value: '#1D6B3A', token: 'success' },
  { label: 'Perigo', value: '#9A2020', token: 'danger' },
  { label: 'Warning', value: '#8B6914', token: 'warning' },
];

const TYPOGRAPHY = [
  { label: 'Interface', value: 'IBM Plex Sans', sample: 'Consulta Dermatológica' },
  { label: 'Mono / Técnico', value: 'IBM Plex Mono', sample: 'CRM 12345 · TUSS 10101012' },
];

export function SectionAparencia() {
  const { user, clinic } = useAuth();
  const isPrivileged = user?.role === 'owner' || user?.role === 'admin';
  const clinicQuery = trpc.settings.clinic.get.useQuery(undefined, { staleTime: 60_000 });
  const logoUrl = (clinicQuery.data as Record<string, unknown>)?.logo_url as string | null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Logo */}
      <Glass style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <Mono size={10} spacing="1.1px" color={T.primary}>LOGO DA CLÍNICA</Mono>
            <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 4 }}>
              Exibido no menu lateral, documentos e relatórios
            </p>
          </div>
          {isPrivileged && (
            <Btn small variant="glass" icon="image" disabled>
              Alterar logo
            </Btn>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 80, height: 80, borderRadius: T.r.lg,
            background: T.primaryBg, border: `1px solid ${T.primaryBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {logoUrl ? (
              <img src={`/api/assets/${logoUrl}`} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <Ico name="home" size={32} color={T.primary} />
            )}
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>{clinic?.name ?? 'Clínica'}</p>
            <Mono size={10} color={T.textMuted}>JPEG, PNG, SVG ou WebP · Máximo 2MB</Mono>
            {/* TODO: upload via POST /api/settings/clinic/logo (multipart) — requires file input wiring */}
            <p style={{ fontSize: 12, color: T.textMuted, marginTop: 4, fontStyle: 'italic' }}>
              Upload de logo disponível via API. Interface de upload em breve.
            </p>
          </div>
        </div>
      </Glass>

      {/* Theme */}
      <Glass style={{ padding: '24px 28px' }}>
        <Mono size={10} spacing="1.1px" color={T.primary}>PALETA DE CORES — QUITE CLEAR</Mono>
        <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 4, marginBottom: 20 }}>
          Cores do design system aplicadas em toda a interface
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {THEME_COLORS.map((c) => (
            <div
              key={c.token}
              style={{
                padding: '14px 16px', borderRadius: T.r.md,
                background: T.inputBg, border: `1px solid ${T.divider}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: T.r.sm,
                  background: c.value, border: '1px solid rgba(0,0,0,0.1)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary }}>{c.label}</span>
              </div>
              <Mono size={10} color={T.textMuted}>{c.value}</Mono>
            </div>
          ))}
        </div>
      </Glass>

      {/* Typography */}
      <Glass style={{ padding: '24px 28px' }}>
        <Mono size={10} spacing="1.1px" color={T.primary}>TIPOGRAFIA</Mono>
        <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 4, marginBottom: 20 }}>
          Famílias tipográficas utilizadas no sistema
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {TYPOGRAPHY.map((t) => (
            <div
              key={t.label}
              style={{
                padding: '18px 20px', borderRadius: T.r.md,
                background: T.inputBg, border: `1px solid ${T.divider}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{t.label}</span>
                <MetalTag>{t.value}</MetalTag>
              </div>
              <p style={{ fontSize: 22, fontFamily: `'${t.value}', ${t.value.includes('Mono') ? 'monospace' : 'sans-serif'}`, color: T.textPrimary }}>
                {t.sample}
              </p>
              <p style={{ fontSize: 14, fontFamily: `'${t.value}', ${t.value.includes('Mono') ? 'monospace' : 'sans-serif'}`, color: T.textSecondary, marginTop: 4 }}>
                ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
              </p>
            </div>
          ))}
        </div>
      </Glass>

      {/* Surface Preview */}
      <Glass style={{ padding: '24px 28px' }}>
        <Mono size={10} spacing="1.1px" color={T.primary}>SUPERFÍCIES</Mono>
        <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 4, marginBottom: 20 }}>
          Materiais utilizados nos cards e painéis
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <Glass style={{ padding: '20px', textAlign: 'center' }}>
            <Mono size={9} spacing="1px" color={T.textMuted}>GLASS</Mono>
            <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, marginTop: 8 }}>Padrão</p>
            <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>Blur + transparência</p>
          </Glass>
          <Glass metal style={{ padding: '20px', textAlign: 'center' }}>
            <Mono size={9} spacing="1px" color={T.textMuted}>METAL</Mono>
            <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, marginTop: 8 }}>Brushed</p>
            <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>Gradiente metálico</p>
          </Glass>
          <Glass active style={{ padding: '20px', textAlign: 'center' }}>
            <Mono size={9} spacing="1px" color={T.textMuted}>ACTIVE</Mono>
            <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, marginTop: 8 }}>Selecionado</p>
            <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>Borda primária</p>
          </Glass>
        </div>
      </Glass>
    </div>
  );
}
