'use client';

import * as React from 'react';
import { Pen, ShieldCheck } from 'lucide-react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@dermaos/ui';

interface SignModalProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string;
  providerCrm?: string | null;
  onConfirm:    () => Promise<void> | void;
  isSubmitting?: boolean;
}

export function SignModal({
  open,
  onOpenChange,
  providerName,
  providerCrm,
  onConfirm,
  isSubmitting,
}: SignModalProps) {
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-gold-600" aria-hidden="true" />
            Assinar prontuário
          </DialogTitle>
          <DialogDescription>
            Você está prestes a assinar este prontuário. Após a assinatura,
            alterações exigem nova versão com justificativa obrigatória.
            <strong className="mt-2 block text-foreground">Esta ação é irreversível.</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-gold-500/30 bg-gold-100/40 p-3 text-sm">
          <div className="flex items-start gap-2">
            <Pen className="mt-0.5 h-4 w-4 text-gold-700" aria-hidden="true" />
            <div>
              <div className="font-medium text-foreground">
                Dr. {providerName}
              </div>
              {providerCrm && (
                <div className="font-mono text-xs text-muted-foreground">
                  CRM {providerCrm}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Hash SHA-256 do conteúdo SOAP + identificação do profissional + timestamp
                será registrado como assinatura digital.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="gold"
            onClick={() => void onConfirm()}
            isLoading={isSubmitting}
          >
            <Pen className="h-4 w-4" aria-hidden="true" />
            Assinar
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
