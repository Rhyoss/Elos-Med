'use client';

import * as React from 'react';
import { T, Ico, Mono } from '@dermaos/ui/ds';
import { sanitizeErrorMessage } from '@/lib/privacy';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showTechnical, setShowTechnical] = React.useState(false);
  const safeMessage = sanitizeErrorMessage(error);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 16,
        textAlign: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'rgba(154,32,32,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ico name="alert" size={26} color={T.danger} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: T.textPrimary,
            margin: 0,
          }}
        >
          Algo deu errado
        </h2>
        <p
          style={{
            fontSize: 14,
            color: T.textSecondary,
            maxWidth: 380,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {safeMessage}
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        style={{
          marginTop: 4,
          padding: '8px 20px',
          borderRadius: T.r.md,
          background: T.glass,
          border: `1px solid ${T.glassBorder}`,
          fontSize: 13,
          fontWeight: 600,
          color: T.textPrimary,
          cursor: 'pointer',
          fontFamily: "'IBM Plex Sans', sans-serif",
          transition: 'background 0.15s',
        }}
      >
        Tentar novamente
      </button>
      {error.digest && (
        <button
          type="button"
          onClick={() => setShowTechnical((v) => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, color: T.textMuted, padding: '2px 4px',
          }}
        >
          {showTechnical ? 'Ocultar detalhes' : 'Detalhes técnicos'}
        </button>
      )}
      {showTechnical && error.digest && (
        <Mono size={10} color={T.textMuted}>
          Código: {error.digest}
        </Mono>
      )}
    </div>
  );
}
