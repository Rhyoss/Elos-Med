'use client';

import { Bot, Clock, MessageSquare } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { CardError, ChartCardSkeleton } from '../../_components/card-states';
import { formatInt } from '../../_components/formatters';
import { KpiCard } from './kpi-card';

export function OmniTab({ start, end }: { start: string; end: string }) {
  const q = trpc.analytics.omni.useQuery({ start, end }, { staleTime: 60_000 });

  if (q.isLoading) return <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><ChartCardSkeleton /><ChartCardSkeleton /></div>;
  if (q.isError || !q.data) return <CardError title="Desempenho Omni" message={q.error?.message} onRetry={() => q.refetch()} />;
  const d = q.data;

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Resumo Omni">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard label="Conversas"        value={d.totalConversations} trendPct={null} unit="count" icon={<MessageSquare className="h-4 w-4" />} />
          <KpiCard label="Automatizadas (Aurora)" value={d.totalAutomations} trendPct={null} unit="count" icon={<Bot className="h-4 w-4" />} />
          <KpiCard label="Tempo médio resposta" value={d.avgResponseSec} trendPct={null} unit="count" hint="segundos" icon={<Clock className="h-4 w-4" />} />
        </div>
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Volume por canal</CardTitle>
        </CardHeader>
        <CardContent>
          {d.byChannel.length === 0 ? (
            <EmptyState title="Sem mensagens no período" description="Não há registros omni para este intervalo." />
          ) : (
            <>
              <div role="img" aria-label="Mensagens por canal divididas por direção">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={d.byChannel.map((c) => ({ channel: c.channel, Inbound: c.inbound, Outbound: c.outbound, Aurora: c.automated }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="channel" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Inbound"  fill="hsl(var(--primary-500))" />
                    <Bar dataKey="Outbound" fill="hsl(var(--success-500))" />
                    <Bar dataKey="Aurora"   fill="hsl(var(--accent-500))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="sr-only">
                <caption>Mensagens por canal</caption>
                <thead><tr><th>Canal</th><th>Inbound</th><th>Outbound</th><th>Automatizadas</th><th>Tempo médio (s)</th></tr></thead>
                <tbody>
                  {d.byChannel.map((c) => (
                    <tr key={c.channel}>
                      <td>{c.channel}</td><td>{c.inbound}</td><td>{c.outbound}</td><td>{c.automated}</td><td>{c.avgResponseSec ?? '—'}</td>
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
          <CardTitle className="text-base">Funil omnicanal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <FunnelStage label="Conversas iniciadas" value={d.funnel.contacted} />
            <FunnelStage label="Respondidas"        value={d.funnel.responded} />
            <FunnelStage label="Agendamentos"       value={d.funnel.scheduled} />
            <FunnelStage label="Atendimentos"       value={d.funnel.completed} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FunnelStage({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{formatInt(value)}</div>
    </div>
  );
}
