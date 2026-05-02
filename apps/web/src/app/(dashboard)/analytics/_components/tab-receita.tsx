'use client';

import * as React from 'react';
import { T, Glass, Mono, Bar, EmptyState, ErrorState } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import {
  KpiCard, KpiLoadingGrid, SectionHeader, HBar, MiniBarChart,
  fmtCurrency, fmtNum, fmtPctRaw,
} from './analytics-helpers';

interface Props {
  start: string;
  end: string;
}

export function TabReceita({ start, end }: Props) {
  const { data, isLoading, isError, error } = trpc.analytics.financial.useQuery(
    { start, end },
    { staleTime: 60_000, retry: false },
  );

  if (isError) {
    return (
      <ErrorState
        title="Erro ao carregar receita"
        description={error?.message ?? 'Tente novamente em alguns instantes.'}
      />
    );
  }

  if (isLoading || !data) return <KpiLoadingGrid count={5} />;

  const { kpis, byMethod, agingBuckets, topServices, byProvider } = data;
  const maxServiceRevenue = Math.max(...topServices.map((s) => s.revenue), 1);
  const maxProviderRevenue = Math.max(...byProvider.map((p) => p.revenue), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
        <KpiCard label="Receita bruta" value={fmtCurrency(kpis.revenue.value)} icon="creditCard" trend={kpis.revenue.trendPct} mod="financial" />
        <KpiCard label="Receita líquida" value={fmtCurrency(kpis.netRevenue.value)} icon="activity" trend={kpis.netRevenue.trendPct} mod="financial" />
        <KpiCard label="Ticket médio" value={fmtCurrency(kpis.avgTicket.value)} icon="hash" trend={kpis.avgTicket.trendPct} mod="financial" />
        <KpiCard label="Faturas pagas" value={fmtNum(kpis.paidInvoices.value)} icon="check" trend={kpis.paidInvoices.trendPct} mod="financial" />
        <KpiCard label="Vencidas" value={fmtCurrency(kpis.overdueAmount.value)} icon="alert" trend={null} trendInvert mod="accentMod" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Recebimentos por método */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHeader icon="percent" color={T.financial.color} title="Recebimento por método" />
          <div style={{ padding: '16px 18px' }}>
            {byMethod.length === 0 ? (
              <EmptyState icon="creditCard" title="Sem pagamentos" description="Nenhum pagamento no período selecionado." />
            ) : (
              byMethod.map((m) => (
                <div key={m.method} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: T.textSecondary, width: 130, flexShrink: 0, textTransform: 'capitalize' }}>
                    {m.method.replace(/_/g, ' ')}
                  </span>
                  <Bar pct={m.share * 100} color={T.financial.color} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, width: 90, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>
                    {fmtCurrency(m.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Glass>

        {/* Aging buckets */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHeader icon="clock" color={T.warning} title="Inadimplência por faixa" />
          <div style={{ padding: '16px 18px' }}>
            {(() => {
              const buckets = [
                { label: 'A vencer', value: agingBuckets.current, color: T.success },
                { label: '0–30 dias', value: agingBuckets.d0_30, color: T.warning },
                { label: '31–60 dias', value: agingBuckets.d31_60, color: '#e67e22' },
                { label: '61–90 dias', value: agingBuckets.d61_90, color: T.danger },
                { label: '90+ dias', value: agingBuckets.d90Plus, color: '#8B0000' },
              ];
              const max = Math.max(...buckets.map((b) => b.value), 1);
              return buckets.map((b) => (
                <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: T.textSecondary, width: 100, flexShrink: 0 }}>{b.label}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: T.divider, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(b.value / max) * 100}%`, borderRadius: 999, background: b.color, transition: 'width 0.6s ease' }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, width: 90, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>
                    {fmtCurrency(b.value)}
                  </span>
                </div>
              ));
            })()}
          </div>
        </Glass>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Top serviços */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHeader icon="star" color={T.financial.color} title="Receita por procedimento" />
          <div style={{ padding: '16px 18px' }}>
            {topServices.length === 0 ? (
              <EmptyState icon="star" title="Sem dados" description="Nenhum procedimento faturado no período." />
            ) : (
              topServices.slice(0, 8).map((s) => (
                <HBar key={s.id} label={s.name} value={s.revenue} max={maxServiceRevenue} color={T.financial.color} suffix={fmtCurrency(s.revenue)} />
              ))
            )}
          </div>
        </Glass>

        {/* Receita por profissional */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHeader icon="user" color={T.clinical.color} title="Receita por profissional" />
          <div style={{ padding: '16px 18px' }}>
            {byProvider.length === 0 ? (
              <EmptyState icon="user" title="Sem dados" description="Nenhum profissional com receita no período." />
            ) : (
              byProvider.slice(0, 8).map((p) => (
                <HBar key={p.providerId} label={p.providerName} value={p.revenue} max={maxProviderRevenue} color={T.clinical.color} suffix={fmtCurrency(p.revenue)} />
              ))
            )}
          </div>
        </Glass>
      </div>
    </div>
  );
}
