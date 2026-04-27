'use client';

import {
  AlertTriangle, CreditCard, DollarSign, FileCheck, Stethoscope, TrendingDown, TrendingUp, Users,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { CardError, ChartCardSkeleton, KpiCardSkeleton, ListCardSkeleton } from '../../_components/card-states';
import { formatCurrencyCents, formatInt, formatPercent } from '../../_components/formatters';
import { KpiCard } from './kpi-card';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  dinheiro:        'Dinheiro',
  pix:             'PIX',
  cartao_credito:  'Crédito',
  cartao_debito:   'Débito',
  transferencia:   'Transferência',
  boleto:          'Boleto',
  cheque:          'Cheque',
  outros:          'Outros',
};

function methodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

const AGING_COLORS = [
  'hsl(var(--success-500))',
  'hsl(var(--primary-500))',
  'hsl(var(--warning-500))',
  'hsl(var(--warning-700))',
  'hsl(var(--danger-500))',
];

export function FinancialTab({ start, end }: { start: string; end: string }) {
  const q = trpc.analytics.financial.useQuery({ start, end }, { staleTime: 60_000 });

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCardSkeleton />
          <ChartCardSkeleton />
        </div>
        <ListCardSkeleton rows={5} />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return <CardError title="Financeiro Avançado" message={q.error?.message} onRetry={() => q.refetch()} />;
  }
  const d = q.data;

  const totalAging =
    d.agingBuckets.current + d.agingBuckets.d0_30 + d.agingBuckets.d31_60
    + d.agingBuckets.d61_90 + d.agingBuckets.d90Plus;

  const agingData = [
    { bucket: 'A vencer',   value: d.agingBuckets.current },
    { bucket: '0–30d',      value: d.agingBuckets.d0_30 },
    { bucket: '31–60d',     value: d.agingBuckets.d31_60 },
    { bucket: '61–90d',     value: d.agingBuckets.d61_90 },
    { bucket: '90d+',       value: d.agingBuckets.d90Plus },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Indicadores financeiros">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard label="Receita bruta"   value={d.kpis.revenue.value}      trendPct={d.kpis.revenue.trendPct}      unit="currency" icon={<DollarSign className="h-4 w-4" />} />
          <KpiCard label="Receita líquida" value={d.kpis.netRevenue.value}   trendPct={d.kpis.netRevenue.trendPct}   unit="currency" icon={<TrendingUp className="h-4 w-4" />} />
          <KpiCard label="Estornos"        value={d.kpis.refunds.value}      trendPct={d.kpis.refunds.trendPct}      unit="currency" invertTrend icon={<TrendingDown className="h-4 w-4" />} />
          <KpiCard label="Ticket médio"    value={d.kpis.avgTicket.value}    trendPct={d.kpis.avgTicket.trendPct}    unit="currency" icon={<DollarSign className="h-4 w-4" />} />
          <KpiCard label="Faturas pagas"   value={d.kpis.paidInvoices.value} trendPct={d.kpis.paidInvoices.trendPct} unit="count"    icon={<FileCheck  className="h-4 w-4" />} />
          <KpiCard label="A receber vencido" value={d.kpis.overdueAmount.value} trendPct={null} unit="currency" hint="Faturas com saldo em aberto" icon={<AlertTriangle className="h-4 w-4" />} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Receita por método</CardTitle>
          </CardHeader>
          <CardContent>
            {d.byMethod.length === 0 ? (
              <EmptyState title="Sem pagamentos no período" description="Não há registros de pagamentos para este intervalo." />
            ) : (
              <>
                <div role="img" aria-label="Receita por método de pagamento">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={d.byMethod.map((m) => ({ method: methodLabel(m.method), value: m.amount }))}
                      layout="vertical"
                      margin={{ left: 10, right: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" fontSize={11} tickFormatter={(v: number) => formatCurrencyCents(v).replace('R$', '').trim()} />
                      <YAxis type="category" dataKey="method" fontSize={11} width={90} />
                      <Tooltip
                        formatter={(v: number) => [formatCurrencyCents(v), 'Receita']}
                        contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }}
                      />
                      <Bar dataKey="value" fill="hsl(var(--primary-500))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <table className="sr-only">
                  <caption>Receita por método de pagamento</caption>
                  <thead><tr><th>Método</th><th>Receita</th><th>Transações</th><th>Participação</th></tr></thead>
                  <tbody>
                    {d.byMethod.map((m) => (
                      <tr key={m.method}>
                        <td>{methodLabel(m.method)}</td>
                        <td>{formatCurrencyCents(m.amount)}</td>
                        <td>{formatInt(m.count)}</td>
                        <td>{formatPercent(m.share)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Aging — contas a receber</CardTitle>
          </CardHeader>
          <CardContent>
            {totalAging === 0 ? (
              <EmptyState title="Sem contas a receber" description="Não há faturas em aberto." />
            ) : (
              <>
                <div role="img" aria-label="Faturas em aberto por faixa de vencimento">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={agingData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="bucket" fontSize={11} />
                      <YAxis fontSize={11} tickFormatter={(v: number) => formatCurrencyCents(v).replace('R$', '').trim()} />
                      <Tooltip
                        formatter={(v: number) => [formatCurrencyCents(v), 'Saldo em aberto']}
                        contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }}
                      />
                      <Bar dataKey="value">
                        {agingData.map((_, i) => <Cell key={i} fill={AGING_COLORS[i]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <table className="sr-only">
                  <caption>Faturas em aberto por faixa de vencimento</caption>
                  <thead><tr><th>Faixa</th><th>Saldo</th></tr></thead>
                  <tbody>
                    {agingData.map((b) => (
                      <tr key={b.bucket}><td>{b.bucket}</td><td>{formatCurrencyCents(b.value)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Stethoscope className="h-4 w-4" /> Top serviços por receita</CardTitle>
        </CardHeader>
        <CardContent>
          {d.topServices.length === 0 ? (
            <EmptyState title="Sem serviços faturados" description="Não há itens de fatura no período." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Top serviços por receita">
                <thead className="text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="text-left py-2 px-3">Serviço</th>
                    <th className="text-right py-2 px-3">Atendimentos</th>
                    <th className="text-right py-2 px-3">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {d.topServices.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="py-2 px-3 truncate max-w-md">{s.name}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatInt(s.count)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-medium">{formatCurrencyCents(s.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Receita por profissional</CardTitle>
        </CardHeader>
        <CardContent>
          {d.byProvider.length === 0 ? (
            <EmptyState title="Sem dados por profissional" description="Não há atribuição de profissional nas faturas do período." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Receita por profissional">
                <thead className="text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="text-left py-2 px-3">Profissional</th>
                    <th className="text-right py-2 px-3">Receita</th>
                    <th className="text-right py-2 px-3">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {d.byProvider.map((p) => (
                    <tr key={p.providerId} className="border-t">
                      <td className="py-2 px-3 truncate max-w-md">{p.providerName}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-medium">{formatCurrencyCents(p.revenue)}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                        {p.commission !== null ? formatCurrencyCents(p.commission) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
