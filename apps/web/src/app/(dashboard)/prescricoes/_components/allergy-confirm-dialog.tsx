'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Button,
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@dermaos/ui';
import type { AllergyMatch } from './check-allergies';

interface AllergyConfirmDialogProps {
  open:        boolean;
  onOpenChange: (open: boolean) => void;
  matches:     AllergyMatch[];
  onConfirm:   () => void | Promise<void>;
  isLoading?:  boolean;
  /**
   * Mensagem que será registrada/auditada no submit. Quando o backend
   * suportar gravação dessa confirmação, passar adiante.
   */
  confirmLabel?: string;
}

export function AllergyConfirmDialog({
  open,
  onOpenChange,
  matches,
  onConfirm,
  isLoading,
  confirmLabel = 'Sim, emitir mesmo assim',
}: AllergyConfirmDialogProps) {
  const [acknowledged, setAcknowledged] = React.useState(false);

  React.useEffect(() => {
    if (!open) setAcknowledged(false);
  }, [open]);

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-danger-700">
            <AlertTriangle className="h-5 w-5 text-danger-500" aria-hidden="true" />
            Possível conflito com alergia
          </DialogTitle>
          <DialogDescription>
            Identificamos termos compatíveis entre os itens prescritos e as alergias registradas
            do paciente. Revise antes de prosseguir.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3">
          <ul
            className="rounded-md border border-danger-200 bg-danger-50/60 p-3 text-sm text-danger-900 space-y-1.5"
            role="list"
          >
            {matches.map((m, i) => (
              <li key={i} className="leading-snug">
                <strong>{m.itemLabel || '—'}</strong>
                <span className="text-danger-700"> · alerta: alergia a </span>
                <strong>{m.allergy}</strong>
              </li>
            ))}
          </ul>

          <label className="flex items-start gap-2 text-sm text-foreground select-none">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 accent-danger-500"
              aria-label="Confirmar ciência do alerta de alergia"
            />
            <span>
              Estou ciente do alerta e confirmo que esta prescrição é apropriada para o paciente.
              Esta confirmação ficará registrada no histórico clínico.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!acknowledged || isLoading}
            isLoading={isLoading}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
