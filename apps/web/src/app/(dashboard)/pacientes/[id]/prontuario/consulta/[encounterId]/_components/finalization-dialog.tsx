'use client';

import * as React from 'react';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@dermaos/ui';
import { Mono, T } from '@dermaos/ui/ds';

/* ── Validation ────────────────────────────────────────────────────── */

interface ValidationRule {
  id: string;
  label: string;
  check: () => boolean;
  required: boolean;
}

interface FinalizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmSign: () => void;
  isSubmitting: boolean;
  chiefComplaint: string;
  objective: string;
  assessment: string;
  plan: string;
  diagnoses: { code: string }[];
}

function stripHtml(html: string): string {
  if (typeof document === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent ?? '';
}

export function FinalizationDialog({
  open,
  onOpenChange,
  onConfirmSign,
  isSubmitting,
  chiefComplaint,
  objective,
  assessment,
  plan,
  diagnoses,
}: FinalizationDialogProps) {
  const rules: ValidationRule[] = [
    {
      id: 'chief-complaint',
      label: 'Queixa principal preenchida',
      check: () => chiefComplaint.trim().length >= 3,
      required: true,
    },
    {
      id: 'objective',
      label: 'Exame físico / objetivo preenchido',
      check: () => stripHtml(objective).trim().length >= 5,
      required: true,
    },
    {
      id: 'assessment',
      label: 'Avaliação / hipótese diagnóstica',
      check: () => stripHtml(assessment).trim().length >= 3 || diagnoses.length > 0,
      required: true,
    },
    {
      id: 'plan',
      label: 'Conduta / plano registrado',
      check: () => stripHtml(plan).trim().length >= 3,
      required: true,
    },
    {
      id: 'diagnosis-cid',
      label: 'Pelo menos um diagnóstico CID-10',
      check: () => diagnoses.length > 0,
      required: false,
    },
  ];

  const results = rules.map((rule) => ({
    ...rule,
    passed: rule.check(),
  }));

  const requiredFailed = results.filter((r) => r.required && !r.passed);
  const canFinalize = requiredFailed.length === 0;
  const optionalMissing = results.filter((r) => !r.required && !r.passed);

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {canFinalize ? (
              <CheckCircle2 style={{ width: 20, height: 20, color: T.success }} />
            ) : (
              <AlertCircle style={{ width: 20, height: 20, color: T.danger }} />
            )}
            Finalizar atendimento
          </DialogTitle>
          <DialogDescription>
            {canFinalize
              ? 'Todos os campos obrigatórios foram preenchidos. Deseja assinar o prontuário?'
              : 'Alguns campos obrigatórios não foram preenchidos. Preencha-os antes de finalizar.'}
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0' }}>
          <Mono size={9} spacing="0.6px" color={T.textMuted}>CHECKLIST DE FINALIZAÇÃO</Mono>
          {results.map((r) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: T.r.md,
                background: r.passed ? 'rgba(34,139,34,0.05)' : r.required ? 'rgba(200,30,30,0.05)' : 'rgba(200,170,0,0.05)',
                border: `1px solid ${r.passed ? 'rgba(34,139,34,0.15)' : r.required ? 'rgba(200,30,30,0.15)' : 'rgba(200,170,0,0.15)'}`,
              }}
            >
              {r.passed ? (
                <CheckCircle2 style={{ width: 16, height: 16, color: T.success, flexShrink: 0 }} />
              ) : r.required ? (
                <XCircle style={{ width: 16, height: 16, color: T.danger, flexShrink: 0 }} />
              ) : (
                <AlertCircle style={{ width: 16, height: 16, color: '#B8860B', flexShrink: 0 }} />
              )}
              <span
                style={{
                  fontSize: 13,
                  color: r.passed ? T.textPrimary : r.required ? T.danger : '#856404',
                  fontWeight: r.passed ? 400 : 500,
                }}
              >
                {r.label}
              </span>
              {!r.required && !r.passed && (
                <span style={{ fontSize: 10, color: '#856404', marginLeft: 'auto' }}>opcional</span>
              )}
            </div>
          ))}
        </div>

        {!canFinalize && (
          <p style={{ fontSize: 12, color: T.danger, marginTop: 4 }}>
            {requiredFailed.length} campo{requiredFailed.length > 1 ? 's' : ''} obrigatório{requiredFailed.length > 1 ? 's' : ''} pendente{requiredFailed.length > 1 ? 's' : ''}.
          </p>
        )}

        {canFinalize && optionalMissing.length > 0 && (
          <p style={{ fontSize: 12, color: '#856404', marginTop: 4 }}>
            {optionalMissing.length} campo{optionalMissing.length > 1 ? 's' : ''} opcional{optionalMissing.length > 1 ? 'is' : ''} não preenchido{optionalMissing.length > 1 ? 's' : ''}.
            Você pode finalizar mesmo assim.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {canFinalize ? 'Voltar ao editor' : 'Voltar e completar'}
          </Button>
          {canFinalize && (
            <Button
              variant="gold"
              onClick={onConfirmSign}
              isLoading={isSubmitting}
            >
              Assinar e finalizar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
