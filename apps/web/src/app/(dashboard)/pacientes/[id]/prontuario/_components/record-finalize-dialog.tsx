'use client';

import * as React from 'react';
import { Btn, Glass, Ico, MetalTag, Mono, T } from '@dermaos/ui/ds';

export interface RecordFinalizeDialogProps {
  open:        boolean;
  onClose:     () => void;
  onConfirm:   () => void;
  isSubmitting?: boolean;
  /** Pendências detectadas — se houver, exibimos como warning antes da confirmação. */
  warnings?:   string[];
  providerName?: string;
  providerCrm?:  string | null;
}

/**
 * Confirmation dialog for finalizing/signing an encounter. CFM 1821/2007 +
 * SBIS NGS-2 require explicit confirmation before sealing the record.
 */
export function RecordFinalizeDialog({
  open,
  onClose,
  onConfirm,
  isSubmitting,
  warnings,
  providerName,
  providerCrm,
}: RecordFinalizeDialogProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="finalize-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.42)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Glass metal style={{ maxWidth: 520, width: '100%', padding: '22px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: T.r.lg,
              background: T.warningBg,
              border: `1px solid ${T.warningBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Ico name="alert" size={20} color={T.warning} />
          </div>
          <div style={{ flex: 1 }}>
            <Mono size={9} spacing="1.2px" color={T.warning}>
              CONFIRMAÇÃO DE FINALIZAÇÃO
            </Mono>
            <h2
              id="finalize-title"
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: T.textPrimary,
                margin: '4px 0 8px',
                letterSpacing: '-0.01em',
              }}
            >
              Assinar e finalizar prontuário?
            </h2>
            <p
              style={{
                fontSize: 13,
                color: T.textSecondary,
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              Esta ação é <strong>irreversível</strong>. Após a finalização o documento
              ficará somente em modo leitura. Correções futuras deverão ser feitas
              por <strong>adendo</strong>, mantendo o histórico íntegro.
            </p>
          </div>
        </div>

        {warnings && warnings.length > 0 && (
          <div
            style={{
              marginTop: 18,
              padding: '10px 12px',
              borderRadius: T.r.md,
              background: T.warningBg,
              border: `1px solid ${T.warningBorder}`,
            }}
          >
            <Mono size={8} color={T.warning}>PENDÊNCIAS DETECTADAS</Mono>
            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
              {warnings.map((w, i) => (
                <li
                  key={i}
                  style={{ fontSize: 12, color: T.textPrimary, lineHeight: 1.5 }}
                >
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          style={{
            marginTop: 18,
            padding: '10px 12px',
            borderRadius: T.r.md,
            background: T.primaryBg,
            border: `1px solid ${T.primaryBorder}`,
          }}
        >
          <Mono size={8} color={T.primary}>ASSINATURA CLÍNICA</Mono>
          <p style={{ fontSize: 12, color: T.textPrimary, margin: '4px 0 0' }}>
            <strong>{providerName ?? 'Profissional'}</strong>
            {providerCrm ? ` · ${providerCrm}` : ''}
          </p>
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <MetalTag>CFM 1821/2007</MetalTag>
            <MetalTag>NGS-2</MetalTag>
            <MetalTag>CARIMBO TEMPO</MetalTag>
          </div>
        </div>

        <div
          style={{
            marginTop: 22,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <Btn variant="ghost" small onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Btn>
          <Btn
            small
            icon="check"
            onClick={onConfirm}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Assinar e finalizar
          </Btn>
        </div>
      </Glass>
    </div>
  );
}
