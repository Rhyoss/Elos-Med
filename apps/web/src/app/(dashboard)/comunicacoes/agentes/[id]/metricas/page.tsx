'use client';

import * as React from 'react';
import {
  AlertTriangle,
  Bot,
  MessageSquare,
  PhoneForwarded,
  ShieldAlert,
  Timer,
  TrendingUp,
  ZapOff,
} from 'lucide-react';
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  LoadingSkeleton,
  MetricCard,
  TabsRoot,
  TabsList,
  TabsTrigger,
} from '@dermaos/ui';
import type { AuroraIntent, MetricsPeriod } from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';

/* ── Rótulos ──────────────────────────────────────────────────────────── */

const PERIOD_OPTIONS: Array<{ value: MetricsPeriod; label: string }> = [
  { value: '7d',  label: '7 dias'  },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
];

const INTENT_LABELS: Record<AuroraIntent, string> = {
  saudacao:            'Saudação',
  agendar_consulta:    'Agendar',
  remarcar_consulta:   'Remarcar',
  cancelar_consulta:   'Cancelar',
  confirmar_consulta:  'Confirmar',
  consultar_horarios:  'Consultar horários',
  informacoes_clinica: 'Informações',
  duvida_procedimento: 'Dúvida procedimento',
  pos_atendimento:     'Pós-atendimento',
  emergencia:          'Emergência',
  fora_de_escopo:      'Fora de escopo',
};

/* ── Helpers ──────────────────────────────────────────────────────────── */

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatSeconds(value: number | null): string {
  if (value === null) return '—';
  if (value < 60) return `${value.toFixed(0)}s`;
  const min = Math.floor(value / 60);
  const sec = Math.round(value % 60);
  return `${min}m ${sec}s`;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return new Intl.DateTimeFormat('pt-BR', {
    day:   '2-digit',
    month: 'short',
  }).format(d);
}

/* ── Charts SVG puros ─────────────────────────────────────────────────── */

interface TimelinePoint {
  date:      string;
  aurora:    number;
  escalated: number;
}

function TimelineChart({ points }: { points: TimelinePoint[] }) {
  const W = 680;
  const H = 220;
  const pad = { top: 10, right: 12, bottom: 28, left: 36 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const maxY = Math.max(1, ...points.flatMap((p) => [p.aurora, p.escalated]));
  const niceMax = Math.ceil(maxY * 1.15);
  const stepY = Math.max(1, Math.ceil(niceMax / 4));
  const ticks = [0, stepY, stepY * 2, stepY * 3, stepY * 4];

  function xAt(i: number): number {
    if (points.length <= 1) return pad.left + innerW / 2;
    return pad.left + (i / (points.length - 1)) * innerW;
  }
  function yAt(v: number): number {
    return pad.top + innerH - (v / (ticks[ticks.length - 1] ?? 1)) * innerH;
  }

  const auroraPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(p.aurora)}`).join(' ');
  const escPath    = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(p.escalated)}`).join(' ');

  const tickStride = Math.max(1, Math.ceil(points.length / 7));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-64" role="img" aria-label="Conversas por dia">
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={pad.left} x2={W - pad.right} y1={yAt(t)} y2={yAt(t)}
            stroke="hsl(var(--border))" strokeDasharray="3 3" strokeWidth={1}
          />
          <text
            x={pad.left - 6} y={yAt(t) + 3}
            textAnchor="end" fontSize="10"
            fill="hsl(var(--muted-foreground))"
          >
            {t}
          </text>
        </g>
      ))}

      {points.map((p, i) =>
        i % tickStride === 0 ? (
          <text
            key={i}
            x={xAt(i)} y={H - pad.bottom + 14}
            textAnchor="middle" fontSize="10"
            fill="hsl(var(--muted-foreground))"
          >
            {p.date}
          </text>
        ) : null,
      )}

      <path d={auroraPath} fill="none" stroke="hsl(var(--primary-600))" strokeWidth={2} />
      <path d={escPath}    fill="none" stroke="hsl(var(--warning-500))" strokeWidth={2} />

      {points.map((p, i) => (
        <g key={`pts-${i}`}>
          <circle cx={xAt(i)} cy={yAt(p.aurora)}    r={2.5} fill="hsl(var(--primary-600))" />
          <circle cx={xAt(i)} cy={yAt(p.escalated)} r={2.5} fill="hsl(var(--warning-500))" />
        </g>
      ))}
    </svg>
  );
}

function IntentBars({ rows }: { rows: Array<{ intent: string; count: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const pct = Math.round((r.count / max) * 100);
        return (
          <div key={r.intent} className="flex items-center gap-3 text-sm">
            <span className="w-40 shrink-0 truncate text-muted-foreground">{r.intent}</span>
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary-500"
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />
            </div>
            <span className="w-10 text-right tabular-nums text-foreground">{r.count}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Página ───────────────────────────────────────────────────────────── */

export default function MetricasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: agentId } = React.use(params);
  const [period, setPeriod] = React.useState<MetricsPeriod>('7d');

  const metricsQuery = trpc.aurora.admin.metrics.useQuery({ agentId, period });
  const timelineQuery = trpc.aurora.admin.metricsTimeline.useQuery({ agentId, period });

  const metrics = metricsQuery.data?.metrics;
  const timeline = timelineQuery.data?.timeline;

  const isLoading = metricsQuery.isLoading || timelineQuery.isLoading;

  const timelineData: TimelinePoint[] = React.useMemo(() => {
    if (!timeline) return [];
    return timeline.points.map((p) => ({
      date:      formatDateShort(p.date),
      aurora:    p.aurora,
      escalated: p.escalated,
    }));
  }, [timeline]);

  const intentData = React.useMemo(() => {
    if (!metrics) return [];
    return metrics.intents
      .slice()
      .sort((a, b) => b.count - a.count)
      .map((row) => ({
        intent: INTENT_LABELS[row.intent],
        count:  row.count,
      }));
  }, [metrics]);

  const totalIntents = intentData.reduce((sum, row) => sum + row.count, 0);
  const guardrailsTotal = metrics
    ? metrics.guardrailsTriggered.diagnostico
      + metrics.guardrailsTriggered.prescricao
      + metrics.guardrailsTriggered.promessa
    : 0;

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Period selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Métricas</h2>
          <p className="text-xs text-muted-foreground">
            Baseado em eventos de domínio (audit.domain_events) — não lê conteúdo das conversas.
          </p>
        </div>
        <TabsRoot value={period} onValueChange={(v) => setPeriod(v as MetricsPeriod)}>
          <TabsList>
            {PERIOD_OPTIONS.map((opt) => (
              <TabsTrigger key={opt.value} value={opt.value}>
                {opt.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </TabsRoot>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Conversas"
          value={metrics?.totalConversations ?? 0}
          icon={<MessageSquare />}
          loading={isLoading}
        />
        <MetricCard
          label="Taxa de resolução"
          value={metrics ? formatPercent(metrics.resolutionRate) : '—'}
          icon={<TrendingUp />}
          loading={isLoading}
        />
        <MetricCard
          label="Taxa de escalação"
          value={metrics ? formatPercent(metrics.escalationRate) : '—'}
          icon={<PhoneForwarded />}
          loading={isLoading}
        />
        <MetricCard
          label="Resposta média"
          value={metrics ? formatSeconds(metrics.avgResponseSeconds) : '—'}
          icon={<Timer />}
          loading={isLoading}
        />
      </div>

      {/* Timeline chart */}
      <Card>
        <CardContent className="p-6 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary-600" aria-hidden="true" />
            <h3 className="text-sm font-semibold">Conversas por dia</h3>
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-primary-500" aria-hidden="true" />
                Aurora
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-warning-500" aria-hidden="true" />
                Escaladas
              </span>
            </div>
          </div>
          {isLoading ? (
            <LoadingSkeleton className="h-64 w-full rounded" />
          ) : timelineData.length === 0 ? (
            <EmptyState
              title="Sem dados no período"
              description="Ative o agente e conecte um canal para começar a coletar métricas."
            />
          ) : (
            <TimelineChart points={timelineData} />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Intents */}
        <Card>
          <CardContent className="p-6 flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold">Intenções detectadas</h3>
              <p className="text-xs text-muted-foreground">
                Total: {totalIntents} classificações
              </p>
            </div>
            {isLoading ? (
              <LoadingSkeleton className="h-56 w-full rounded" />
            ) : intentData.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma intenção registrada.</p>
            ) : (
              <IntentBars rows={intentData} />
            )}
          </CardContent>
        </Card>

        {/* Safety & guardrails */}
        <Card>
          <CardContent className="p-6 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-warning-700" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Guardrails & segurança</h3>
            </div>

            {isLoading ? (
              <LoadingSkeleton className="h-40 w-full rounded" />
            ) : !metrics ? (
              <p className="text-xs text-muted-foreground">—</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <GuardrailStat label="Diagnóstico" count={metrics.guardrailsTriggered.diagnostico} />
                  <GuardrailStat label="Prescrição"  count={metrics.guardrailsTriggered.prescricao}  />
                  <GuardrailStat label="Promessa"    count={metrics.guardrailsTriggered.promessa}    />
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ZapOff className="h-4 w-4 text-danger-700" aria-hidden="true" />
                    <span className="text-sm text-foreground">Circuit breaker</span>
                  </div>
                  <Badge
                    variant={metrics.circuitBreakerOpens > 0 ? 'danger' : 'neutral'}
                    size="sm"
                  >
                    {metrics.circuitBreakerOpens} {metrics.circuitBreakerOpens === 1 ? 'abertura' : 'aberturas'}
                  </Badge>
                </div>

                {guardrailsTotal > 0 && (
                  <div className="flex items-start gap-2 rounded-md bg-warning-100 border border-warning-500/30 p-3">
                    <AlertTriangle className="h-4 w-4 text-warning-700 shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="text-xs text-warning-700">
                      A Aurora tentou responder em área sensível. Revise o prompt e os exemplos
                      para reforçar os limites da equipe médica.
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── Subcomponentes ──────────────────────────────────────────────────── */

function GuardrailStat({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3 flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums text-foreground">{count}</span>
    </div>
  );
}
