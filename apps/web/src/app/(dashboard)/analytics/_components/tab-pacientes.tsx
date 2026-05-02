'use client';

import * as React from 'react';
import { T, Glass, Mono, EmptyState, ErrorState } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import {
  KpiCard, KpiLoadingGrid, SectionHeader, FunnelBar, UnavailableCard,
  fmtNum, fmtPct, fmtCurrency,
} from './analytics-helpers';

interface Props {
  start: string;
  end: string;
}

export function TabPacientes({ start, end }: Props) {
  const { data, isLoading, isError, error } = trpc.analytics.journey.useQuery(
    { start, end, cohortMonths: 12 },
    { staleTime: 60_000, retry: false },
  );

  if (isError) {
    return (
      <ErrorState
        title="Erro ao carregar jornada"
        description={error?.message ?? 'Tente novamente em alguns instantes.'}
      />
    );
  }

  if (isLoading || !data) return <KpiLoadingGrid count={4} />;

  const { funnel, conversionRates, cohorts, topChurnRisk, topUpsell } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <KpiCard label="Novos pacientes" value={fmtNum(funnel.leads)} icon="users" mod="clinical" />
        <KpiCard label="Retornaram" value={fmtNum(funnel.returned)} icon="activity" mod="clinical" />
        <KpiCard label="Conversão lead→consulta" value={fmtPct(conversionRates.leadToFirst)} icon="zap" mod="clinical" />
        <KpiCard label="Retenção (consulta→retorno)" value={fmtPct(conversionRates.completedToReturn)} icon="activity" mod="clinical" />
      </div>

      {/* Funil */}
      <Glass style={{ padding: '18px 22px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, display: 'block', marginBottom: 14 }}>
          Funil de captação
        </span>
        <FunnelBar
          steps={[
            { label: 'Leads', value: funnel.leads, color: T.clinical.color },
            { label: '1ª Consulta', value: funnel.firstAppointment, color: '#2E8B57' },
            { label: 'Concluída', value: funnel.completed, color: T.success },
            { label: 'Retorno', value: funnel.returned, color: T.primary },
          ]}
        />
      </Glass>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Cohort retention */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHeader icon="layers" color={T.clinical.color} title="Retenção por coorte" />
          <div style={{ padding: 0, overflowX: 'auto' }}>
            {cohorts.length === 0 ? (
              <div style={{ padding: 16 }}>
                <EmptyState icon="users" title="Sem coortes" description="Coortes de retenção serão populadas pelo worker noturno." />
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.divider}` }}>
                    {['Coorte', 'Tamanho', 'M1', 'M3', 'M6', 'M12'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: T.textMuted, fontWeight: 600, letterSpacing: '0.5px' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohorts.slice(0, 8).map((c) => (
                    <tr key={c.cohortMonth} style={{ borderBottom: `1px solid ${T.divider}` }}>
                      <td style={{ padding: '10px 12px', fontFamily: "'IBM Plex Mono', monospace", color: T.textPrimary }}>
                        {c.cohortMonth.slice(0, 7)}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: T.textPrimary }}>{c.cohortSize}</td>
                      {[c.retentionM1, c.retentionM3, c.retentionM6, c.retentionM12].map((r, i) => (
                        <td key={i} style={{ padding: '10px 12px', fontFamily: "'IBM Plex Mono', monospace", color: r == null ? T.textMuted : r >= 0.5 ? T.success : r >= 0.2 ? T.warning : T.danger }}>
                          {r != null ? fmtPct(r) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Glass>

        {/* Risco de churn */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHeader icon="alert" color={T.danger} title="Risco de churn" />
          <div style={{ padding: 0 }}>
            {topChurnRisk.length === 0 ? (
              <div style={{ padding: 16 }}>
                <EmptyState icon="users" title="Sem alertas" description="Nenhum paciente com risco elevado de churn." />
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.divider}` }}>
                    {['Paciente', 'Risco', 'Dias s/ visita', 'LTV prev.'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: T.textMuted, fontWeight: 600, letterSpacing: '0.5px' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topChurnRisk.slice(0, 8).map((p) => (
                    <tr key={p.patientId} style={{ borderBottom: `1px solid ${T.divider}` }}>
                      <td style={{ padding: '10px 12px', color: T.textPrimary, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.patientName}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 11,
                          color: p.churnRisk >= 0.7 ? T.danger : p.churnRisk >= 0.4 ? T.warning : T.success,
                        }}>
                          {(p.churnRisk * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: "'IBM Plex Mono', monospace", color: T.textSecondary }}>
                        {p.daysSinceVisit != null ? `${p.daysSinceVisit}d` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: "'IBM Plex Mono', monospace", color: T.textPrimary }}>
                        {fmtCurrency(p.ltvPredicted)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Glass>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <UnavailableCard
          title="Origem / campanha"
          reason="Rastreamento de origem de pacientes (UTM/campanha) não está configurado. Necessário campo source/campaign no cadastro de paciente."
        />
        <UnavailableCard
          title="Pacientes inativos"
          reason="Definição de inatividade requer parâmetro de dias sem visita configurável nas preferências da clínica."
        />
      </div>
    </div>
  );
}
