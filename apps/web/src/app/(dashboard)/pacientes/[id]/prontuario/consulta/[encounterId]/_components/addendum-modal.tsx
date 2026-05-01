'use client';

import * as React from 'react';
import { FileEdit } from 'lucide-react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  useToast,
} from '@dermaos/ui';
import { Mono, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { SoapEditor } from './soap-editor';

interface AddendumModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  encounterId: string;
  patientId: string;
}

export function AddendumModal({
  open,
  onOpenChange,
  encounterId,
  patientId,
}: AddendumModalProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [justification, setJustification] = React.useState('');
  const [correction, setCorrection] = React.useState('');

  const correctMut = trpc.clinical.encounters.correct.useMutation({
    onSuccess: () => {
      void utils.clinical.encounters.getById.invalidate({ id: encounterId });
      void utils.clinical.encounters.getByPatient.invalidate({ patientId });
      toast.success('Adendo registrado com sucesso');
      setJustification('');
      setCorrection('');
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error('Erro ao registrar adendo', {
        description: err.message,
      });
    },
  });

  function handleSubmit() {
    if (justification.trim().length < 10) {
      toast.warning('A justificativa deve ter pelo menos 10 caracteres');
      return;
    }
    if (!correction.trim()) {
      toast.warning('Informe o conteúdo do adendo');
      return;
    }

    correctMut.mutate({
      id: encounterId,
      correction: {
        internalNotes: correction,
      },
      justification: justification.trim(),
    });
  }

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileEdit style={{ width: 20, height: 20, color: T.primary }} />
            Adicionar adendo
          </DialogTitle>
          <DialogDescription>
            Este prontuário já foi assinado. Alterações serão registradas como adendo
            com justificativa obrigatória e auditoria completa.
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
          <div>
            <Mono size={9} spacing="0.6px" color={T.textMuted} style={{ marginBottom: 6, display: 'block' }}>
              JUSTIFICATIVA *
            </Mono>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explique o motivo do adendo (mínimo 10 caracteres)…"
              rows={2}
              minLength={10}
              maxLength={2000}
              aria-label="Justificativa do adendo"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: T.r.md,
                border: `1px solid ${T.glassBorder}`,
                background: T.glass,
                fontSize: 13,
                fontFamily: "'IBM Plex Sans', sans-serif",
                color: T.textPrimary,
                outline: 'none',
                resize: 'vertical',
              }}
            />
            {justification.trim().length > 0 && justification.trim().length < 10 && (
              <p style={{ fontSize: 11, color: T.danger, marginTop: 4 }}>
                Mínimo 10 caracteres ({justification.trim().length}/10)
              </p>
            )}
          </div>

          <div>
            <Mono size={9} spacing="0.6px" color={T.textMuted} style={{ marginBottom: 6, display: 'block' }}>
              CONTEÚDO DO ADENDO *
            </Mono>
            <SoapEditor
              label="Conteúdo do adendo"
              value={correction}
              onChange={setCorrection}
              placeholder="Descreva as informações adicionais ou correções…"
              minHeight="8rem"
            />
          </div>

          <div
            style={{
              padding: '8px 12px',
              borderRadius: T.r.md,
              background: T.primaryBg,
              border: `1px solid ${T.primaryBorder}`,
            }}
          >
            <p style={{ fontSize: 11, color: T.textSecondary, margin: 0 }}>
              O adendo será registrado com hash SHA-256, identificação do profissional,
              timestamp e justificativa. O prontuário original permanece inalterado.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={correctMut.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={correctMut.isPending}
            disabled={justification.trim().length < 10 || !correction.trim()}
          >
            Registrar adendo
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
