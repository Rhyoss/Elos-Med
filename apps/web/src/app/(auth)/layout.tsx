'use client';

import type { ReactNode } from 'react';
import { Mono, T } from '@dermaos/ui/ds';

/**
 * AuthLayout — DS Quite Clear chrome para login/forgot/reset.
 * Reproduz o background gradient + ambient orbs do DS Shell para que a
 * tela de autenticação seja visualmente coerente com o app.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: T.bgGrad,
        position: 'relative',
        fontFamily: "'IBM Plex Sans', sans-serif",
        color: T.textPrimary,
      }}
    >
      {/* Ambient orbs */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: -120,
          top: -80,
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: T.bgOrb1,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: -80,
          bottom: -80,
          width: 340,
          height: 340,
          borderRadius: '50%',
          background: T.bgOrb2,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Brand mark */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          marginBottom: 28,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 56,
            height: 56,
            borderRadius: T.r.lg,
            background: T.primaryGrad,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(23,77,56,0.32)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: '-0.02em',
          }}
        >
          E
        </div>
        <span
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: T.textPrimary,
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          ElosMed
        </span>
        <Mono size={9} spacing="1.4px" color={T.textMuted}>
          QUITE CLEAR · CLINICAL ELEGANCE
        </Mono>
      </div>

      {/* Glass card slot */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 420,
          padding: '32px 32px 28px',
          borderRadius: T.r.lg,
          background: T.glass,
          backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
          WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
          border: `1px solid ${T.glassBorder}`,
          boxShadow: T.glassShadow,
        }}
      >
        {children}
      </div>

      <p
        style={{
          position: 'relative',
          zIndex: 1,
          marginTop: 24,
          fontSize: 11,
          color: T.textMuted,
          textAlign: 'center',
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        © {new Date().getFullYear()} ElosMed · Plataforma para Clínicas Dermatológicas
      </p>
    </div>
  );
}
