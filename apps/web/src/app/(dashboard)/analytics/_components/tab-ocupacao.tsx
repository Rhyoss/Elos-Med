'use client';

import * as React from 'react';
import { T, Glass, Mono, Bar, EmptyState, ErrorState } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import {
  KpiCard, KpiLoadingGrid, SectionHeader, MiniBarChart, UnavailableCard,
  fmtNum, fmtPctRaw,
} from './analytics-helpers';

interface Props {
  start: string;
  end: string;
}

export function TabOcupacao({ start, end }: Props) {
  const { data, isLoading, isError, error } = trpc.analytics.overview.useQuery(
    { start, end },
    { staleTime: 60_000, retry: false },
  );

  if (isError) {
    return (
      <ErrorState
        title="Erro ao carregar ocupação"
        description={error?.message ?? 'Tente novamente em alguns instantes.'}
      />
    );
  }

  if (isLoading || !data) {
    return <KpiLoadingGrid count={5} />;
  }

  const { kpis, series } = data;

  const totalAppts = kpis.appointments.value ?? 0;
  const noShowSeries = series.appointmentsDaily;
  const totalNoShow = noShowSeries.reduce((a, d) => a + d.noShow, 0);
  const totalCancelled = noShowSeries.reduce((a, d) => a + d.cancelled, 0);
  const totalCompleted = noShowSeries.reduce((a, d) => a + d.completed, 0);
  const noShowRate = totalAppts > 0 ? (totalNoShow / totalAppts) * 100 : null;
  const completionRate = totalAppts > 0 ? (totalCompleted / totalAppts) * 100 : null;

  const dailyChart = series.appointmentsDaily.slice(-14).map((d) => ({
    label: d.date.slice(8, 10),
    value: d.total,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
        <KpiCard
          label="Consultas"
          value={fmtNum(kpis.appointments.value)}
          icon="calendar"
          trend={kpis.appointments.trendPct}
          mod="clinical"
        />
        <KpiCard
          label="Taxa de ocupação"
          value={completionRate != null ? fmtPctRaw(completionRate) : '—'}
          icon="activity"
          trend={null}
          mod="clinical"
        />
        <KpiCard
          label="No-show"
          value={fmtNum(totalNoShow)}
          icon="x"
          trend={noShowRate != null ? noShowRate : null}
          trendInvert
          mod="accentMod"
        />
        <KpiCard
          label="Cancelamentos"
          value={fmtNum(totalCancelled)}
          icon="x"
          trend={kpis.cancellationRate.trendPct}
          trendInvert
          mod="accentMod"
        />
        <KpiCard
          label="Novos pacientes"
          value={fmtNum(kpis.newPatients.value)}
          icon="users"
          trend={kpis.newPatients.trendPct}
          mod="clinical"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Glass style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Consultas/dia — últimos 14 dias</span>
            <Mono size={9} color={T.clinical.color}>{fmtNum(totalAppts)} TOTAL</Mono>
          </div>
          {dailyChart.length > 0 ? (
            <MiniBarChart data={dailyChart} color={T.clinical.color} height={100} />
          ) : (
            <EmptyState icon="calendar" title="Sem dados" description="Nenhuma consulta registrada no período." />
          )}
        </Glass>

        <Glass style={{ padding: '18px 22px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, display: 'block', marginBottom: 14 }}>
            Distribuição por status
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Concluídas', value: totalCompleted, color: T.success },
              { label: 'No-show', value: totalNoShow, color: T.danger },
              { label: 'Canceladas', value: totalCancelled, color: T.warning },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: T.textSecondary, width: 100, flexShrink: 0 }}>{item.label}</span>
                <Bar pct={totalAppts > 0 ? (item.value / totalAppts) * 100 : 0} color={item.color} />
                <span style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, width: 50, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {fmtNum(item.value)}
                </span>
              </div>
            ))}
          </div>
        </Glass>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <UnavailableCard
          title="Taxa de ocupação por profissional"
          reason="Endpoint de ocupação por profissional não disponível. Necessário agrupar agendamentos por provider_id com capacidade configurada."
        />
        <UnavailableCard
          title="Horários ociosos"
          reason="Análise de horários ociosos requer configuração de grade horária por profissional no módulo de agenda."
        />
      </div>

      <UnavailableCard
        title="Tempo médio de atendimento"
        reason="Medição de tempo de atendimento requer registro de check-in/check-out no fluxo de consulta."
      />
    </div>
  );
}
