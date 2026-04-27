'use client';

import { Button } from '@dermaos/ui';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <span className="text-5xl" aria-hidden="true">⚠️</span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold text-foreground">Algo deu errado</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          {error.message || 'Ocorreu um erro inesperado. Tente novamente.'}
        </p>
      </div>
      <Button onClick={reset} variant="outline">
        Tentar novamente
      </Button>
    </div>
  );
}
