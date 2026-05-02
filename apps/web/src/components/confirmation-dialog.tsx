'use client';

import * as React from 'react';
import { Glass, Btn, Ico, Mono, T, type IcoName } from '@dermaos/ui/ds';

export interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  icon?: IcoName;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonMinLength?: number;
  isLoading?: boolean;
  auditNote?: string;
}

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  icon = 'alert',
  requireReason = false,
  reasonLabel = 'Motivo',
  reasonPlaceholder = 'Descreva o motivo…',
  reasonMinLength = 3,
  isLoading = false,
  auditNote,
}: ConfirmationDialogProps) {
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting && !isLoading) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, isLoading, onClose]);

  const trimmed = reason.trim();
  const reasonValid = !requireReason || trimmed.length >= reasonMinLength;

  async function handleConfirm() {
    if (!reasonValid) return;
    setSubmitting(true);
    try {
      await onConfirm(requireReason ? trimmed : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const colors = {
    danger:  { bg: T.dangerBg,  border: T.dangerBorder,  fg: T.danger  },
    warning: { bg: T.warningBg, border: T.warningBorder, fg: T.warning },
    default: { bg: T.primaryBg, border: T.primaryBorder, fg: T.primary },
  }[variant];

  const pending = submitting || isLoading;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(10,16,12,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <Glass
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        style={{
          width: 440, maxWidth: '100%', padding: 28,
          display: 'flex', flexDirection: 'column', gap: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: T.r.md,
            background: colors.bg, border: `1px solid ${colors.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Ico name={icon} size={17} color={colors.fg} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
              {title}
            </p>
            <p style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5, marginTop: 2 }}>
              {description}
            </p>
          </div>
        </div>

        {requireReason && (
          <div>
            <label style={{ fontSize: 12, color: T.textSecondary, display: 'block', marginBottom: 6 }}>
              {reasonLabel} *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              rows={3}
              autoFocus
              disabled={pending}
              maxLength={500}
              style={{
                width: '100%', padding: '9px 13px',
                borderRadius: T.r.md, background: T.inputBg,
                border: `1px solid ${T.inputBorder}`,
                color: T.textPrimary, fontSize: 13,
                fontFamily: "'IBM Plex Sans', sans-serif",
                outline: 'none', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            <Mono size={9} color={T.textMuted} style={{ marginTop: 4, display: 'block' }}>
              Mínimo {reasonMinLength} caracteres · {trimmed.length}/500
            </Mono>
          </div>
        )}

        {auditNote && (
          <div style={{
            padding: '8px 10px', borderRadius: T.r.sm,
            background: T.primaryBg, border: `1px solid ${T.primaryBorder}`,
          }}>
            <Mono size={9} color={T.primary}>
              <Ico name="shield" size={10} color={T.primary} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              {auditNote}
            </Mono>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" small onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Btn>
          <Btn
            variant={variant === 'default' ? 'primary' : 'danger'}
            small
            loading={pending}
            disabled={!reasonValid || pending}
            onClick={() => void handleConfirm()}
          >
            {confirmLabel}
          </Btn>
        </div>
      </Glass>
    </div>
  );
}
