'use client';

import * as React from 'react';
import { T, Glass, Mono, Bar, EmptyState, ErrorState } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import {
  KpiCard, KpiLoadingGrid, SectionHeader, FunnelBar, UnavailableCard,
  fmtNum, fmtDuration,
} from './analytics-helpers';

interface Props {
  start: string;
  end: string;
}

export function TabComunicacao({ start, end }: Props) {
  const { data, isLoading, isError, error } = trpc.analytics.omni.useQuery(
    { start, end },
    { staleTime: 60_000, retry: false },
  );

  if (isError) {
    return (
      <ErrorState
        title="Erro ao carregar comunicação"
        description={error?.message ?? 'Tente novamente em alguns instantes.'}
      />
    );
  }

  if (isLoading || !data) return <KpiLoadingGrid count={4} />;

  const { byChannel, funnel, totalConversations, totalAutomations, avgResponseSec } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <KpiCard label="Conversas" value={fmtNum(totalConversations)} icon="message" mod="aiMod" />
        <KpiCard label="Automações" value={fmtNum(totalAutomations)} icon="zap" mod="aiMod" />
        <KpiCard label="Tempo médio resposta" value={fmtDuration(avgResponseSec)} icon="clock" mod="aiMod" />
        <KpiCard
          label="Taxa de resposta"
          value={funnel.contacted > 0 ? `${Math.round((funnel.responded / funnel.contacted) * 100)}%` : '—'}
          icon="activity"
          mod="aiMod"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Por canal */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHeader icon="message" color={T.ai} title="Mensagens por canal" />
          <div style={{ padding: 0 }}>
            {byChannel.length === 0 ? (
              <div style={{ padding: 16 }}>
                <EmptyState icon="message" title="Sem dados" description="Nenhuma mensagem registrada no período." />
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.divider}` }}>
                    {['Canal', 'Entrada', 'Saída', 'IA', 'Tempo resp.'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: T.textMuted, fontWeight: 600, letterSpacing: '0.5px' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byChannel.map((c) => (
                    <tr key={c.channel} style={{ borderBottom: `1px solid ${T.divider}` }}>
                      <td style={{ padding: '10px 12px', color: T.textPrimary, textTransform: 'capitalize', fontWeight: 500 }}>
                        {c.channel}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: "'IBM Plex Mono', monospace", color: T.textPrimary }}>
                        {fmtNum(c.inbound)}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: "'IBM Plex Mono', monospace", color: T.textPrimary }}>
                        {fmtNum(c.outbound)}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: "'IBM Plex Mono', monospace", color: T.ai }}>
                        {fmtNum(c.automated)}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: "'IBM Plex Mono', monospace", color: T.textSecondary }}>
                        {fmtDuration(c.avgResponseSec)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Glass>

        {/* Funil omnichannel */}
        <Glass style={{ padding: '18px 22px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, display: 'block', marginBottom: 14 }}>
            Funil omnichannel
          </span>
          {funnel.contacted === 0 ? (
            <EmptyState icon="message" title="Sem conversas" description="Nenhuma conversa no período." />
          ) : (
            <FunnelBar
              steps={[
                { label: 'Contatados', value: funnel.contacted, color: T.ai },
                { label: 'Responderam', value: funnel.responded, color: '#2E8B57' },
                { label: 'Agendaram', value: funnel.scheduled, color: T.clinical.color },
                { label: 'Concluíram', value: funnel.completed, color: T.success },
              ]}
            />
          )}
        </Glass>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <UnavailableCard
          title="Campanhas"
          reason="Módulo de campanhas de comunicação não implementado. Quando disponível, exibirá envios, aberturas e conversões por campanha."
        />
        <UnavailableCard
          title="Falhas de envio"
          reason="Rastreamento de falhas de envio (bounce, timeout) requer integração com provedor de mensageria (webhook de status)."
        />
      </div>
    </div>
  );
}
