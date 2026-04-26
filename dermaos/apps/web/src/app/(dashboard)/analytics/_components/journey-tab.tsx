'use client';

import { TrendingDown, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, cn } from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { CardError, ChartCardSkeleton, ListCardSkeleton } from '../../_components/card-states';
import { formatCurrencyCents, formatInt, formatPercent } from '../../_components/formatters';
import { KpiCard } from './kpi-card';

export function JourneyTab({ start, end }: { start: string; end: string }) {
  const q = trpc.analytics.journey.useQuery(
    { start, end, cohortMonths: 12 },
    { staleTime: 60_000 },
  );

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <ChartCardSkeleton key={i} />)}</div>
        <ListCardSkeleton rows={6} />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return <CardError title="Jornada do Paciente" message={q.error?.message} onRetry={() => q.refetch()} />;
  }
  const d = q.data;

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Funil de conversão">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Funil de conversão</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Leads"               value={d.funnel.leads}             trendPct={null} unit="count" hint="Pacientes criados no período" />
          <KpiCard label="Primeira consulta"   value={d.funnel.firstAppointment}  trendPct={null} unit="count" hint={d.conversionRates.leadToFirst !== null ? `${formatPercent(d.conversionRates.leadToFirst)} dos leads` : undefined} />
          <KpiCard label="Consulta concluída"  value={d.funnel.completed}         trendPct={null} unit="count" hint={d.conversionRates.firstToCompleted !== null ? `${formatPercent(d.conversionRates.firstToCompleted)} das primeiras` : undefined} />
          <KpiCard label="Retornaram"          value={d.funnel.returned}          trendPct={null} unit="count" hint={d.conversionRates.completedToReturn !== null ? `${formatPercent(d.conversionRates.completedToReturn)} dos atendidos` : undefined} />
        </div>
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Coortes mensais (12m)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {d.cohorts.length === 0 ? (
            <EmptyState title="Sem coortes calculadas" description="O worker ainda não calculou coortes para esta clínica. Aguarde a próxima execução semanal (terça-feira)." />
          ) : (
            <table className="w-full text-sm" aria-label="Tabela de coortes mensais">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="text-left py-2 px-3">Coorte</th>
                  <th className="text-right py-2 px-3">Tamanho</th>
                  <th className="text-right py-2 px-3">M1</th>
                  <th className="text-right py-2 px-3">M3</th>
                  <th className="text-right py-2 px-3">M6</th>
                  <th className="text-right py-2 px-3">M12</th>
                  <th className="text-right py-2 px-3">LTV médio</th>
                </tr>
              </thead>
              <tbody>
                {d.cohorts.map((c) => (
                  <tr key={c.cohortMonth} className="border-t">
                    <td className="py-2 px-3 tabular-nums">{c.cohortMonth.slice(0, 7)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatInt(c.cohortSize)}</td>
                    <RetentionCell pct={c.retentionM1} />
                    <RetentionCell pct={c.retentionM3} />
                    <RetentionCell pct={c.retentionM6} />
                    <RetentionCell pct={c.retentionM12} />
                    <td className="py-2 px-3 text-right tabular-nums">{formatCurrencyCents(c.avgLtv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-4 w-4 text-danger-700" /> Top 10 — Risco de churn</CardTitle>
          </CardHeader>
          <CardContent>
            {d.topChurnRisk.length === 0 ? (
              <EmptyState title="Sem dados" description="Lead scores ainda não foram calculados pelo worker." />
            ) : (
              <ol className="flex flex-col divide-y" aria-label="Top pacientes em risco de churn">
                {d.topChurnRisk.map((p) => (
                  <li key={p.patientId} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="truncate font-medium">{p.patientName}</span>
                    <div className="flex gap-3 items-center text-xs text-muted-foreground tabular-nums">
                      <span className="text-danger-700 font-medium">{formatPercent(p.churnRisk)}</span>
                      <span>{p.daysSinceVisit !== null ? `${p.daysSinceVisit}d` : '—'}</span>
                      <span>{formatCurrencyCents(p.ltvPredicted)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-success-700" /> Top 10 — Oportunidades de upsell</CardTitle>
          </CardHeader>
          <CardContent>
            {d.topUpsell.length === 0 ? (
              <EmptyState title="Sem dados" description="Lead scores ainda não foram calculados pelo worker." />
            ) : (
              <ol className="flex flex-col divide-y" aria-label="Top oportunidades de upsell">
                {d.topUpsell.map((p) => (
                  <li key={p.patientId} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="truncate font-medium">{p.patientName}</span>
                    <div className="flex gap-3 items-center text-xs text-muted-foreground tabular-nums">
                      <span className="text-success-700 font-medium">{formatPercent(p.upsellScore)}</span>
                      <span>{formatCurrencyCents(p.ltvPredicted)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RetentionCell({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <td className="py-2 px-3 text-right text-muted-foreground">—</td>;
  }
  const color = pct >= 0.5 ? 'text-success-700' : pct >= 0.25 ? 'text-warning-700' : 'text-muted-foreground';
  return <td className={cn('py-2 px-3 text-right tabular-nums', color)}>{formatPercent(pct)}</td>;
}
