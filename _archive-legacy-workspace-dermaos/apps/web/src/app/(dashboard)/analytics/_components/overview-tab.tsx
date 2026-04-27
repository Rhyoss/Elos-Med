'use client';

import {
  Activity, Calendar, DollarSign, Percent, Star, TrendingUp, UserPlus, Users,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { CardError, ChartCardSkeleton, KpiCardSkeleton } from '../../_components/card-states';
import { formatCurrencyCents, formatInt } from '../../_components/formatters';
import { KpiCard } from './kpi-card';

export function OverviewTab({ start, end }: { start: string; end: string }) {
  const q = trpc.analytics.overview.useQuery(
    { start, end },
    { staleTime: 60_000 },
  );

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return <CardError title="Visão Geral" message={q.error?.message} onRetry={() => q.refetch()} />;
  }

  const d = q.data;

  return (
    <div className="flex flex-col gap-6">
      {!d.snapshotCoverage.complete && (
        <Card className="border-warning-200 bg-warning-50/50">
          <CardContent className="p-3 text-sm text-warning-900">
            Snapshots diários ainda incompletos para o período ({d.snapshotCoverage.snapshotsFound}/{d.snapshotCoverage.snapshotsExpected}).
            Os números mostrados estão calculados em tempo real a partir das materialized views.
          </CardContent>
        </Card>
      )}

      <section aria-label="Indicadores principais">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard label="Receita"          value={d.kpis.revenue.value}          trendPct={d.kpis.revenue.trendPct}        unit="currency" icon={<DollarSign className="h-4 w-4" />} />
          <KpiCard label="Atendimentos"     value={d.kpis.appointments.value}     trendPct={d.kpis.appointments.trendPct}   unit="count"    icon={<Calendar  className="h-4 w-4" />} />
          <KpiCard label="Novos pacientes"  value={d.kpis.newPatients.value}      trendPct={d.kpis.newPatients.trendPct}    unit="count"    icon={<UserPlus  className="h-4 w-4" />} />
          <KpiCard label="Pacientes ativos" value={d.kpis.activePatients.value}   trendPct={d.kpis.activePatients.trendPct} unit="count"    icon={<Users     className="h-4 w-4" />} />
          <KpiCard label="Ticket médio"     value={d.kpis.avgTicket.value}        trendPct={d.kpis.avgTicket.trendPct}      unit="currency" icon={<TrendingUp className="h-4 w-4" />} />
          <KpiCard label="Cancelamento"     value={d.kpis.cancellationRate.value} trendPct={d.kpis.cancellationRate.trendPct} unit="percent" invertTrend icon={<Percent className="h-4 w-4" />} />
        </div>
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Receita diária</CardTitle>
        </CardHeader>
        <CardContent>
          {d.series.revenueDaily.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem dados no período.</p>
          ) : (
            <>
              <div role="img" aria-label="Receita diária ao longo do período">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={d.series.revenueDaily.map((r) => ({ date: r.date.slice(5), value: r.value }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v: number) => formatCurrencyCents(v).replace('R$', '').trim()} />
                    <Tooltip
                      formatter={(v: number) => [formatCurrencyCents(v), 'Receita']}
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary-500))" strokeWidth={2} dot={{ r: 2 }} name="Receita" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <table className="sr-only">
                <caption>Receita diária</caption>
                <thead><tr><th>Data</th><th>Receita</th></tr></thead>
                <tbody>{d.series.revenueDaily.map((r) => (<tr key={r.date}><td>{r.date}</td><td>{formatCurrencyCents(r.value)}</td></tr>))}</tbody>
              </table>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Atendimentos por dia</CardTitle>
          </CardHeader>
          <CardContent>
            {d.series.appointmentsDaily.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">Sem dados no período.</p>
            ) : (
              <>
                <div role="img" aria-label="Atendimentos por dia, divididos por status">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={d.series.appointmentsDaily.map((r) => ({ date: r.date.slice(5), Concluídos: r.completed, NoShow: r.noShow, Cancelados: r.cancelled }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Concluídos" stackId="a" fill="hsl(var(--success-500))" />
                      <Bar dataKey="NoShow"     stackId="a" fill="hsl(var(--warning-500))" />
                      <Bar dataKey="Cancelados" stackId="a" fill="hsl(var(--danger-500))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <table className="sr-only">
                  <caption>Atendimentos por dia</caption>
                  <thead><tr><th>Data</th><th>Total</th><th>Concluídos</th><th>No-show</th><th>Cancelados</th></tr></thead>
                  <tbody>{d.series.appointmentsDaily.map((r) => (<tr key={r.date}><td>{r.date}</td><td>{r.total}</td><td>{r.completed}</td><td>{r.noShow}</td><td>{r.cancelled}</td></tr>))}</tbody>
                </table>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" /> Novos pacientes</CardTitle>
          </CardHeader>
          <CardContent>
            {d.series.newPatientsDaily.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">Sem dados no período.</p>
            ) : (
              <>
                <div role="img" aria-label="Novos pacientes ao longo do período">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={d.series.newPatientsDaily.map((r) => ({ date: r.date.slice(5), value: r.value }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }} />
                      <Bar dataKey="value" fill="hsl(var(--primary-500))" name="Novos" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <table className="sr-only">
                  <caption>Novos pacientes por dia</caption>
                  <thead><tr><th>Data</th><th>Novos</th></tr></thead>
                  <tbody>{d.series.newPatientsDaily.map((r) => (<tr key={r.date}><td>{r.date}</td><td>{r.value}</td></tr>))}</tbody>
                </table>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
