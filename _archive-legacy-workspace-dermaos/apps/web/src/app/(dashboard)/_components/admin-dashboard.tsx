'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, Calendar, DollarSign, Microscope, Package2, Percent,
  TrendingDown, UserPlus, Users,
} from 'lucide-react';
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState,
  Input, PageHeader, cn,
} from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { useRealtime } from '@/hooks/use-realtime';
import { CardError, ChartCardSkeleton, KpiCardSkeleton, ListCardSkeleton } from './card-states';
import { formatCurrencyCents, formatInt, formatPercent } from './formatters';
import { KpiCard } from './kpi-card';
import { RevenueChart } from './charts/revenue-chart';
import { DistributionChart } from './charts/distribution-chart';
import { OccupancyChart } from './charts/occupancy-chart';

const FINANCIAL_ROLES = new Set(['admin', 'owner', 'financial']);

function formatYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function AdminDashboard({ role }: { role: string }) {
  const today = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => {
    const d = new Date(today); d.setDate(d.getDate() - 29); return formatYMD(d);
  }, [today]);
  const defaultEnd = useMemo(() => formatYMD(today), [today]);

  const [start, setStart] = useState(defaultStart);
  const [end,   setEnd]   = useState(defaultEnd);

  const canViewFinancials = FINANCIAL_ROLES.has(role);

  const dashQuery = trpc.dashboard.admin.useQuery(
    { start, end },
    { staleTime: 60_000, refetchOnWindowFocus: true },
  );

  useRealtime(
    [
      'appointment.completed', 'appointment.cancelled',
      'payment.approved', 'invoice.paid', 'patient.created',
      'stock.critical_alert',
    ],
    () => { void dashQuery.refetch(); },
  );

  const data = dashQuery.data;
  // Extrai mensagens de validação Zod (pt-BR) ou cai para a mensagem genérica do erro.
  const validationError = (() => {
    if (!dashQuery.error) return null;
    const zod = (dashQuery.error.data as { zodError?: { formErrors?: string[]; fieldErrors?: Record<string, string[]> } } | undefined)?.zodError;
    if (zod) {
      const all: string[] = [];
      if (zod.formErrors)  all.push(...zod.formErrors);
      if (zod.fieldErrors) {
        for (const messages of Object.values(zod.fieldErrors)) all.push(...(messages ?? []));
      }
      if (all.length > 0) return all.join(' • ');
    }
    return dashQuery.error.message;
  })();

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        eyebrow="Painel executivo"
        title="Visão geral da clínica"
        description="KPIs, tendências e alertas consolidados de todos os módulos."
        actions={
          <DateRangePicker
            start={start}
            end={end}
            onStart={setStart}
            onEnd={setEnd}
            onPreset={(s, e) => { setStart(s); setEnd(e); }}
          />
        }
      />

      {validationError && (
        <div className="px-6">
          <Card variant="critical">
            <CardContent className="p-4 text-sm text-danger-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {validationError}
            </CardContent>
          </Card>
        </div>
      )}

      {/* KPIs */}
      <section aria-label="Indicadores principais" className="px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {dashQuery.isLoading ? (
            <>
              <KpiCardSkeleton /><KpiCardSkeleton /><KpiCardSkeleton />
              <KpiCardSkeleton /><KpiCardSkeleton />
            </>
          ) : dashQuery.isError ? (
            <CardError title="Indicadores" message={validationError} onRetry={() => dashQuery.refetch()} />
          ) : data ? (
            <>
              <KpiCard
                label="Receita"
                value={data.kpis.revenue.value}
                trendPct={data.kpis.revenue.trendPct}
                unit="currency"
                icon={<DollarSign />}
                hidden={!canViewFinancials}
              />
              <KpiCard
                label="Ticket médio"
                value={data.kpis.avgTicket.value}
                trendPct={data.kpis.avgTicket.trendPct}
                unit="currency"
                hidden={!canViewFinancials}
              />
              <KpiCard
                label="Taxa de ocupação"
                value={data.kpis.occupancyRate.value}
                trendPct={data.kpis.occupancyRate.trendPct}
                unit="percent"
                icon={<Percent />}
                emptyHint="Sem agenda no período"
              />
              <KpiCard
                label="No-show"
                value={data.kpis.noShowRate.value}
                trendPct={data.kpis.noShowRate.trendPct}
                unit="percent"
                icon={<TrendingDown />}
                invertTrend
                emptyHint="Sem atendimentos no período"
              />
              <KpiCard
                label="Pacientes novos"
                value={data.kpis.newPatients.value}
                trendPct={data.kpis.newPatients.trendPct}
                unit="count"
                icon={<UserPlus />}
              />
            </>
          ) : null}
        </div>
      </section>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" aria-hidden="true" />
              Receita diária
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashQuery.isLoading ? (
              <ChartCardSkeleton />
            ) : dashQuery.isError ? (
              <CardError title="Receita diária" onRetry={() => dashQuery.refetch()} />
            ) : !canViewFinancials ? (
              <p className="text-sm text-muted-foreground italic py-12 text-center">
                Sem permissão para visualizar dados financeiros.
              </p>
            ) : (
              <RevenueChart data={data!.charts.revenue30d} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" aria-hidden="true" />
              Tipos de atendimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashQuery.isLoading ? (
              <ChartCardSkeleton />
            ) : dashQuery.isError ? (
              <CardError title="Tipos de atendimento" onRetry={() => dashQuery.refetch()} />
            ) : (
              <DistributionChart data={data!.charts.typeDistribution} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" aria-hidden="true" />
              Ocupação por profissional
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashQuery.isLoading ? (
              <ChartCardSkeleton />
            ) : dashQuery.isError ? (
              <CardError title="Ocupação por profissional" onRetry={() => dashQuery.refetch()} />
            ) : (
              <OccupancyChart data={data!.charts.occupancyByDoctor} />
            )}
          </CardContent>
        </Card>

        <TopServicesCard
          isLoading={dashQuery.isLoading}
          isError={dashQuery.isError}
          onRetry={() => dashQuery.refetch()}
          data={data?.topServices ?? []}
          canViewFinancials={canViewFinancials}
        />
      </div>

      <div className="px-6">
        <AlertsRow
          isLoading={dashQuery.isLoading}
          isError={dashQuery.isError}
          onRetry={() => dashQuery.refetch()}
          data={data?.alerts}
          canViewFinancials={canViewFinancials}
        />
      </div>
    </div>
  );
}

/* ── Subcomponentes ──────────────────────────────────────────────────────── */

function DateRangePicker({
  start, end, onStart, onEnd, onPreset,
}: {
  start: string; end: string;
  onStart: (s: string) => void;
  onEnd:   (s: string) => void;
  onPreset: (s: string, e: string) => void;
}) {
  const today = formatYMD(new Date());

  function preset(daysBack: number) {
    const e = new Date();
    const s = new Date();
    s.setDate(s.getDate() - daysBack + 1);
    onPreset(formatYMD(s), formatYMD(e));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <label className="sr-only" htmlFor="dash-start">Data inicial</label>
        <Input
          id="dash-start"
          type="date"
          value={start}
          max={end}
          onChange={(e) => onStart(e.target.value)}
          className="w-[140px]"
        />
        <span className="text-xs text-muted-foreground">até</span>
        <label className="sr-only" htmlFor="dash-end">Data final</label>
        <Input
          id="dash-end"
          type="date"
          value={end}
          min={start}
          max={today}
          onChange={(e) => onEnd(e.target.value)}
          className="w-[140px]"
        />
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => preset(7)}>7d</Button>
        <Button size="sm" variant="ghost" onClick={() => preset(30)}>30d</Button>
        <Button size="sm" variant="ghost" onClick={() => preset(90)}>90d</Button>
      </div>
    </div>
  );
}

function TopServicesCard({
  isLoading, isError, onRetry, data, canViewFinancials,
}: {
  isLoading: boolean; isError: boolean; onRetry: () => void;
  data: NonNullable<ReturnType<typeof trpc.dashboard.admin.useQuery>['data']>['topServices'];
  canViewFinancials: boolean;
}) {
  if (isLoading) return <ListCardSkeleton rows={5} />;
  if (isError) return <CardError title="Top serviços" onRetry={onRetry} />;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Top 5 serviços</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-8 w-8" />}
            title="Sem dados"
            description="Nenhum serviço executado no período."
          />
        ) : (
          <ol className="flex flex-col divide-y">
            {data.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <span className="text-xs text-muted-foreground w-5 tabular-nums shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatInt(s.count)} executados
                  </p>
                </div>
                {canViewFinancials && s.revenue !== null && (
                  <span className="text-sm tabular-nums font-medium">
                    {formatCurrencyCents(s.revenue)}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function AlertsRow({
  isLoading, isError, onRetry, data, canViewFinancials,
}: {
  isLoading: boolean; isError: boolean; onRetry: () => void;
  data: NonNullable<ReturnType<typeof trpc.dashboard.admin.useQuery>['data']>['alerts'] | undefined;
  canViewFinancials: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCardSkeleton /><KpiCardSkeleton /><KpiCardSkeleton />
      </div>
    );
  }
  if (isError) return <CardError title="Alertas consolidados" onRetry={onRetry} />;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <AlertCard
        icon={<Package2 className="h-5 w-5" />}
        title="Estoque crítico"
        value={data.stockCritical}
        href="/suprimentos"
        tone={data.stockCritical > 0 ? 'warning' : 'neutral'}
      />
      <AlertCard
        icon={<DollarSign className="h-5 w-5" />}
        title="Faturas em atraso"
        value={data.invoicesOverdue.count}
        meta={canViewFinancials && data.invoicesOverdue.total !== null
          ? `Total: ${formatCurrencyCents(data.invoicesOverdue.total)}`
          : undefined}
        href="/financeiro/dre"
        tone={data.invoicesOverdue.count > 0 ? 'danger' : 'neutral'}
      />
      <AlertCard
        icon={<Microscope className="h-5 w-5" />}
        title="Biópsias pendentes"
        value={data.biopsiesPending}
        href="/pacientes"
        tone={data.biopsiesPending > 0 ? 'warning' : 'neutral'}
      />
    </div>
  );
}

function AlertCard({
  icon, title, value, meta, href, tone,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
  meta?: string;
  href?: string;
  tone: 'neutral' | 'warning' | 'danger';
}) {
  const toneClass = {
    neutral: 'border-border',
    warning: 'border-warning-300 bg-warning-50/40',
    danger:  'border-danger-300 bg-danger-50/40',
  }[tone];

  const inner = (
    <Card className={cn(toneClass, 'h-full')}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="size-10 rounded-md bg-muted/40 grid place-items-center" aria-hidden="true">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold tabular-nums">{formatInt(value)}</p>
          {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
        </div>
        <Badge variant={tone === 'neutral' ? 'outline' : 'default'} className="self-start text-xs">
          {value === 0 ? 'OK' : 'Atenção'}
        </Badge>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg" aria-label={`${title}: ${value} — ver detalhes`}>
      {inner}
    </Link>
  ) : inner;
}
