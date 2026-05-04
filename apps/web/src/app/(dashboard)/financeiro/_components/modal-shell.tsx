'use client';

import * as React from 'react';
import { Btn, Ico, T, type IcoName } from '@dermaos/ui/ds';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: IcoName;
  iconTone?: 'primary' | 'financial' | 'danger' | 'warning' | 'success';
  width?: number;
  /** When true, renders the modal as a right-side drawer instead of centered. */
  drawer?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const TONE = {
  primary:   { bg: T.primaryBg,   border: T.primaryBorder,   color: T.primary   },
  financial: { bg: T.financial.bg, border: T.financial.border, color: T.financial.color },
  danger:    { bg: T.dangerBg,    border: T.dangerBorder,    color: T.danger    },
  warning:   { bg: T.warningBg,   border: T.warningBorder,   color: T.warning   },
  success:   { bg: T.successBg,   border: T.successBorder,   color: T.success   },
} as const;

export function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  icon,
  iconTone = 'financial',
  width = 540,
  drawer = false,
  children,
  footer,
}: ModalShellProps) {
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const tone = TONE[iconTone];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        display: 'flex',
        alignItems: drawer ? 'stretch' : 'center',
        justifyContent: drawer ? 'flex-end' : 'center',
        padding: drawer ? 0 : 20,
      }}
    >
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: drawer ? Math.min(width, 720) : '100%',
          maxWidth: width,
          maxHeight: drawer ? '100%' : 'calc(100vh - 40px)',
          background: 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(24px) saturate(170%)',
          WebkitBackdropFilter: 'blur(24px) saturate(170%)',
          border: `1px solid ${T.glassBorder}`,
          borderRadius: drawer ? 0 : T.r.xl,
          boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 8px 20px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '24%',
            background: T.metalHighlight,
            pointerEvents: 'none',
            opacity: 0.1,
          }}
        />

        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 22px',
            borderBottom: `1px solid ${T.divider}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {icon && (
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: T.r.md,
                  background: tone.bg,
                  border: `1px solid ${tone.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Ico name={icon} size={18} color={tone.color} />
              </div>
            )}
            <div>
              <h2 id="modal-title" style={{ fontSize: 17, fontWeight: 700, color: T.textPrimary }}>
                {title}
              </h2>
              {subtitle && (
                <p style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              borderRadius: T.r.sm,
              display: 'flex',
            }}
          >
            <Ico name="x" size={16} color={T.textMuted} />
          </button>
        </div>

        <div
          style={{
            position: 'relative',
            flex: 1,
            overflowY: 'auto',
            padding: '20px 22px',
          }}
        >
          {children}
        </div>

        {footer && (
          <div
            style={{
              padding: '14px 22px',
              borderTop: `1px solid ${T.divider}`,
              background: 'rgba(255,255,255,0.6)',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface ModalActionsProps {
  onCancel: () => void;
  cancelLabel?: string;
  busy?: boolean;
  children: React.ReactNode;
}

export function ModalActions({ onCancel, cancelLabel = 'Cancelar', busy, children }: ModalActionsProps) {
  return (
    <>
      {children}
      <div style={{ flex: 1 }} />
      <Btn variant="ghost" small disabled={busy} onClick={onCancel}>
        {cancelLabel}
      </Btn>
    </>
  );
}
