'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, LoadingSkeleton } from '@dermaos/ui';

/**
 * Estado de erro por card — preserva contexto e oferece retry sem recarregar todo o dashboard.
 */
export function CardError({
  title,
  message,
  onRetry,
}: {
  title: string;
  message?: string;
  onRetry: () => void;
}) {
  return (
    <Card variant="critical">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-danger-700 text-base">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-danger-700/90 mb-3">
          {message ?? 'Não foi possível carregar este painel.'}
        </p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Tentar novamente
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton para cards de KPI — preserva layout enquanto carrega.
 */
export function KpiCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5 flex flex-col gap-2" aria-busy="true" aria-label="Carregando indicador">
        <LoadingSkeleton className="h-3 w-1/2" />
        <LoadingSkeleton className="h-8 w-2/3" />
        <LoadingSkeleton className="h-3 w-1/3" />
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton para cards de gráfico.
 */
export function ChartCardSkeleton({ height = 240 }: { height?: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <LoadingSkeleton className="h-4 w-1/3" />
      </CardHeader>
      <CardContent aria-busy="true" aria-label="Carregando gráfico">
        <LoadingSkeleton.Chart className="!h-[240px]" />
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton para listas (agenda, biópsias, fila).
 */
export function ListCardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <LoadingSkeleton className="h-4 w-1/3" />
      </CardHeader>
      <CardContent aria-busy="true" aria-label="Carregando lista" className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <LoadingSkeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 flex flex-col gap-1">
              <LoadingSkeleton className="h-3 w-1/2" />
              <LoadingSkeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
