'use client';

import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Button } from '@dermaos/ui';
import { cn } from '@/lib/utils';

export type SaveStatus =
  | { kind: 'idle';   lastSavedAt: Date | null }
  | { kind: 'saving'; lastSavedAt: Date | null }
  | { kind: 'saved';  lastSavedAt: Date }
  | { kind: 'error';  message: string; lastSavedAt: Date | null };

interface SaveStatusIndicatorProps {
  status:   SaveStatus;
  onRetry?: () => void;
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour:   '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function SaveStatusIndicator({ status, onRetry }: SaveStatusIndicatorProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 text-xs font-medium',
        status.kind === 'error'  ? 'text-danger-700'
        : status.kind === 'saving' ? 'text-muted-foreground'
        : 'text-muted-foreground',
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {status.kind === 'saving' && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Salvando…
        </>
      )}
      {status.kind === 'saved' && (
        <>
          <Check className="h-3.5 w-3.5 text-success-700" aria-hidden="true" />
          Salvo às {formatTime(status.lastSavedAt)}
        </>
      )}
      {status.kind === 'idle' && (
        status.lastSavedAt ? (
          <>
            <Check className="h-3.5 w-3.5 text-success-700" aria-hidden="true" />
            Salvo às {formatTime(status.lastSavedAt)}
          </>
        ) : (
          <>Rascunho local</>
        )
      )}
      {status.kind === 'error' && (
        <>
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          Erro ao salvar
          {onRetry && (
            <Button size="sm" variant="ghost" onClick={onRetry}>
              Tentar novamente
            </Button>
          )}
        </>
      )}
    </div>
  );
}
