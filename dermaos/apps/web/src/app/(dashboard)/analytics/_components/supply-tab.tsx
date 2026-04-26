'use client';

import { Package, AlertTriangle, Calendar } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, cn } from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { CardError, ListCardSkeleton } from '../../_components/card-states';
import { formatInt, formatPercent } from '../../_components/formatters';

export function SupplyTab({ start, end }: { start: string; end: string }) {
  const q = trpc.analytics.supply.useQuery(
    { start, end, topN: 10 },
    { staleTime: 60_000 },
  );

  if (q.isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ListCardSkeleton rows={6} />
        <ListCardSkeleton rows={6} />
        <ListCardSkeleton rows={6} />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return <CardError title="Inteligência de Insumos" message={q.error?.message} onRetry={() => q.refetch()} />;
  }
  const d = q.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Top consumidos</CardTitle>
          </CardHeader>
          <CardContent>
            {d.topConsumed.length === 0 ? (
              <EmptyState title="Sem consumo no período" description="Não há movimentações registradas neste intervalo." />
            ) : (
              <ol className="flex flex-col divide-y" aria-label="Top produtos consumidos">
                {d.topConsumed.map((p) => (
                  <li key={p.productId} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="truncate font-medium">{p.productName}</span>
                    <div className="flex gap-4 items-center text-xs text-muted-foreground tabular-nums">
                      <span className="font-semibold text-foreground">{formatInt(p.quantity)}</span>
                      <span>{formatInt(p.movements)} mov.</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Forecast — reposição</CardTitle>
          </CardHeader>
          <CardContent>
            {d.forecasts.length === 0 ? (
              <EmptyState title="Sem forecast" description="O worker ainda não calculou previsões para esta clínica." />
            ) : (
              <ol className="flex flex-col divide-y" aria-label="Previsões de reposição">
                {d.forecasts.slice(0, 10).map((p) => (
                  <li key={p.productId} className="flex items-center justify-between py-2.5 text-sm gap-3">
                    <span className="truncate font-medium flex-1">{p.productName}</span>
                    <div className="flex gap-3 items-center text-xs tabular-nums">
                      {p.daysOfStock !== null && (
                        <span className={cn(
                          'tabular-nums',
                          p.daysOfStock < 7 ? 'text-danger-700 font-semibold' :
                          p.daysOfStock < 30 ? 'text-warning-700' : 'text-muted-foreground',
                        )}>
                          {p.daysOfStock}d estoque
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        {p.predictedReorderDate ?? '—'}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Análise ABC</CardTitle>
          <div className="flex gap-2 text-xs">
            <Badge variant="outline" className="bg-success-100 text-success-800 border-success-200">A: {d.abcAnalysis.a}</Badge>
            <Badge variant="outline" className="bg-warning-100 text-warning-800 border-warning-200">B: {d.abcAnalysis.b}</Badge>
            <Badge variant="outline" className="bg-muted text-muted-foreground">C: {d.abcAnalysis.c}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {d.abcAnalysis.items.length === 0 ? (
            <EmptyState title="Sem dados" description="Não há consumo no período para classificar produtos." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Classificação ABC dos produtos">
                <thead className="text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="text-left py-2 px-3">Produto</th>
                    <th className="text-center py-2 px-3">Classe</th>
                    <th className="text-right py-2 px-3">Participação</th>
                  </tr>
                </thead>
                <tbody>
                  {d.abcAnalysis.items.slice(0, 30).map((p) => (
                    <tr key={p.productId} className="border-t">
                      <td className="py-2 px-3 truncate max-w-xs">{p.productName}</td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant="outline" className={cn(
                          p.classification === 'A' && 'bg-success-100 text-success-800 border-success-200',
                          p.classification === 'B' && 'bg-warning-100 text-warning-800 border-warning-200',
                          p.classification === 'C' && 'bg-muted text-muted-foreground',
                        )}>{p.classification}</Badge>
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatPercent(p.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {d.abcAnalysis.items.length > 30 && (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  Mostrando 30 de {d.abcAnalysis.items.length} produtos. Exporte CSV para ver todos.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
