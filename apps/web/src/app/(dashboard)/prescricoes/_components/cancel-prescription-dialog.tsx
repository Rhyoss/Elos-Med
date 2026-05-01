'use client';

import * as React from 'react';
import {
  Button,
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@dermaos/ui';
import { Field, Textarea } from '@dermaos/ui/ds';

interface CancelPrescriptionDialogProps {
  open:        boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm:   (reason: string) => void | Promise<void>;
  isLoading?:  boolean;
}

export function CancelPrescriptionDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: CancelPrescriptionDialogProps) {
  const [reason, setReason] = React.useState('');

  React.useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  const trimmed = reason.trim();
  const valid = trimmed.length >= 3 && trimmed.length <= 500;

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-danger-500">Cancelar prescrição</DialogTitle>
          <DialogDescription>
            Cancelar é irreversível. O motivo será registrado no histórico clínico.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          <Field label="Motivo do cancelamento" required>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: substituição por nova prescrição, erro de dose…"
              rows={4}
              maxLength={500}
              aria-label="Motivo do cancelamento"
            />
          </Field>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Mínimo 3 caracteres · {trimmed.length}/500
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            disabled={!valid || isLoading}
            isLoading={isLoading}
            onClick={() => void onConfirm(trimmed)}
          >
            Confirmar cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
