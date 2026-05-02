'use client';

import * as React from 'react';
import { T, Glass, EmptyState, ErrorState } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import {
  KpiCard, KpiLoadingGrid, SectionHeader, HBar, UnavailableCard,
  fmtNum, fmtCurrency,
} from './analytics-helpers';

interface Props {
  start: string;
  end: string;
}

export function TabProcedimentos({ start, end }: Props) {
  const overviewQ = trpc.analytics.overview.useQuery(
    { start, end },
    { staleTime: 60_000, retry: false },
  );
  const financialQ = trpc.analytics.financial.useQuery(
    { start, end },
    { staleTime: 60_000, retry: false },
  );

  const isLoading = overviewQ.isLoading || financialQ.isLoading;
  const isError = overviewQ.isError || financialQ.isError;

  if (isError) {
    return (
      <ErrorState
        title="Erro ao carregar procedimentos"
        description={overviewQ.error?.message ?? financialQ.error?.message ?? 'Tente novamente.'}
      />
    );
  }

  if (isLoading || !overviewQ.data || !financialQ.data) return <KpiLoadingGrid count={4} />;

  const overview = overviewQ.data;
  const financial = financialQ.data;

  const totalAppts = overview.kpis.appointments.value ?? 0;
  const totalCompleted = overview.series.appointmentsDaily.reduce((a, d) => a + d.completed, 0);
  const topServices = financial.topServices;
  const maxRevenue = Math.max(...topServices.map((s) => s.revenue), 1);
  const maxCount = Math.max(...topServices.map((s) => s.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <KpiCard label="Total agendados" value={fmtNum(totalAppts)} icon="calendar" trend={overview.kpis.appointments.trendPct} mod="clinical" />
        <KpiCard label="Concluídos" value={fmtNum(totalCompleted)} icon="check" mod="clinical" />
        <KpiCard label="Ticket médio" value={fmtCurrency(overview.kpis.avgTicket.value)} icon="hash" trend={overview.kpis.avgTicket.trendPct} mod="financial" />
        <KpiCard label="Receita total" value={fmtCurrency(financial.kpis.revenue.value)} icon="creditCard" trend={financial.kpis.revenue.trendPct} mod="financial" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Mais realizados — por receita */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHeader icon="star" color={T.clinical.color} title="Mais realizados — por receita" />
          <div style={{ padding: '16px 18px' }}>
            {topServices.length === 0 ? (
              <EmptyState icon="star" title="Sem dados" description="Nenhum procedimento concluído no período." />
            ) : (
              topServices.slice(0, 10).map((s) => (
                <HBar key={s.id} label={s.name} value={s.revenue} max={maxRevenue} color={T.financial.color} suffix={fmtCurrency(s.revenue)} />
              ))
            )}
          </div>
        </Glass>

        {/* Mais realizados — por quantidade */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHeader icon="layers" color={T.clinical.color} title="Mais realizados — por volume" />
          <div style={{ padding: '16px 18px' }}>
            {topServices.length === 0 ? (
              <EmptyState icon="layers" title="Sem dados" description="Nenhum procedimento concluído no período." />
            ) : (
              [...topServices].sort((a, b) => b.count - a.count).slice(0, 10).map((s) => (
                <HBar key={s.id} label={s.name} value={s.count} max={maxCount} color={T.clinical.color} suffix={`${s.count}x`} />
              ))
            )}
          </div>
        </Glass>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <UnavailableCard
          title="Protocolos em andamento"
          reason="Endpoint de protocolos em andamento não disponível. Necessário tracker de sessões concluídas vs. total de sessões previstas por protocolo."
        />
        <UnavailableCard
          title="Retorno recomendado vs agendado"
          reason="Comparação de retorno requer campo recommended_return_date no registro de consulta completada."
        />
      </div>
    </div>
  );
}
