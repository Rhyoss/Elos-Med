'use client';

import * as React from 'react';
import { T, Glass, Mono, Bar, EmptyState, ErrorState } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import {
  KpiCard, KpiLoadingGrid, SectionHeader, HBar, UnavailableCard,
  fmtNum, fmtCurrency,
} from './analytics-helpers';

interface Props {
  start: string;
  end: string;
}

export function TabEstoque({ start, end }: Props) {
  const { data, isLoading, isError, error } = trpc.analytics.supply.useQuery(
    { start, end, topN: 15 },
    { staleTime: 60_000, retry: false },
  );

  if (isError) {
    return (
      <ErrorState
        title="Erro ao carregar estoque"
        description={error?.message ?? 'Tente novamente em alguns instantes.'}
      />
    );
  }

  if (isLoading || !data) return <KpiLoadingGrid count={4} />;

  const { topConsumed, forecasts, abcAnalysis } = data;
  const maxConsumed = Math.max(...topConsumed.map((p) => p.quantity), 1);

  const criticalStock = forecasts.filter((f) => f.daysOfStock != null && f.daysOfStock <= 7);
  const lowStock = forecasts.filter((f) => f.daysOfStock != null && f.daysOfStock > 7 && f.daysOfStock <= 30);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <KpiCard label="Produtos consumidos" value={fmtNum(topConsumed.length)} icon="box" mod="supply" />
        <KpiCard label="Ruptura iminente" value={fmtNum(criticalStock.length)} icon="alert" mod="accentMod" />
        <KpiCard label="Estoque baixo" value={fmtNum(lowStock.length)} icon="activity" mod="supply" />
        <KpiCard
          label="Classificação ABC"
          value={`${abcAnalysis.a}A / ${abcAnalysis.b}B / ${abcAnalysis.c}C`}
          icon="layers"
          mod="supply"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Top consumidos */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHeader icon="box" color={T.supply.color} title="Consumo por produto" />
          <div style={{ padding: '16px 18px' }}>
            {topConsumed.length === 0 ? (
              <EmptyState icon="box" title="Sem consumo" description="Nenhum produto consumido no período." />
            ) : (
              topConsumed.slice(0, 10).map((p) => (
                <HBar key={p.productId} label={p.productName} value={p.quantity} max={maxConsumed} color={T.supply.color} suffix={`${fmtNum(p.quantity)} un`} />
              ))
            )}
          </div>
        </Glass>

        {/* Ruptura / estoque crítico */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHeader icon="alert" color={T.danger} title="Lotes com ruptura iminente" />
          <div style={{ padding: 0 }}>
            {criticalStock.length === 0 && lowStock.length === 0 ? (
              <div style={{ padding: 16 }}>
                <EmptyState icon="check" title="Estoque saudável" description="Nenhum produto em nível crítico." />
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.divider}` }}>
                    {['Produto', 'Dias estoque', 'Reposição prev.', 'Confiança'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: T.textMuted, fontWeight: 600, letterSpacing: '0.5px' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...criticalStock, ...lowStock].slice(0, 10).map((f) => (
                    <tr key={f.productId} style={{ borderBottom: `1px solid ${T.divider}` }}>
                      <td style={{ padding: '10px 12px', color: T.textPrimary, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.productName}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 11,
                          color: (f.daysOfStock ?? 0) <= 7 ? T.danger : T.warning,
                        }}>
                          {f.daysOfStock != null ? `${f.daysOfStock}d` : '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: "'IBM Plex Mono', monospace", color: T.textSecondary }}>
                        {f.predictedReorderDate ?? '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: "'IBM Plex Mono', monospace", color: T.textSecondary }}>
                        {f.confidenceScore != null ? `${(f.confidenceScore * 100).toFixed(0)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Glass>
      </div>

      {/* ABC Analysis */}
      <Glass style={{ padding: 0, overflow: 'hidden' }}>
        <SectionHeader icon="layers" color={T.supply.color} title="Classificação ABC (Pareto)" />
        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            {[
              { cls: 'A', count: abcAnalysis.a, desc: '80% do consumo', color: T.danger },
              { cls: 'B', count: abcAnalysis.b, desc: '15% do consumo', color: T.warning },
              { cls: 'C', count: abcAnalysis.c, desc: '5% do consumo', color: T.success },
            ].map((c) => (
              <div key={c.cls} style={{ flex: 1, padding: '12px 14px', borderRadius: T.r.md, background: `${c.color}08`, border: `1px solid ${c.color}15` }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.count}</span>
                  <Mono size={10} color={c.color}>CLASSE {c.cls}</Mono>
                </div>
                <span style={{ fontSize: 11, color: T.textMuted }}>{c.desc}</span>
              </div>
            ))}
          </div>
          {abcAnalysis.items.length > 0 && (
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {abcAnalysis.items.slice(0, 15).map((item) => (
                <div key={item.productId} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{
                    width: 24, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
                    background: item.classification === 'A' ? `${T.danger}15` : item.classification === 'B' ? `${T.warning}15` : `${T.success}15`,
                    color: item.classification === 'A' ? T.danger : item.classification === 'B' ? T.warning : T.success,
                  }}>
                    {item.classification}
                  </span>
                  <span style={{ fontSize: 12, color: T.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.productName}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: T.textMuted }}>
                    {(item.share * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Glass>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <UnavailableCard
          title="Desperdício por vencimento"
          reason="Rastreamento de descarte por vencimento requer movimentação de tipo 'descarte' associada a lotes expirados."
        />
        <UnavailableCard
          title="Valor em estoque"
          reason="Valoração de estoque requer campo custo_unitario preenchido nos lotes. Quando disponível, exibirá valor total por classificação ABC."
        />
      </div>
    </div>
  );
}
