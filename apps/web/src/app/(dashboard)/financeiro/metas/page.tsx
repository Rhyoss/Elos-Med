'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Glass,
  Btn,
  Stat,
  Mono,
  Ico,
  PageHero,
  Skeleton,
  Bar,
  Badge,
  Field,
  T,
} from '@dermaos/ui/ds';
import { useToast } from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { usePermission } from '@/lib/auth';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from '@dermaos/shared';
import { ModalShell } from '../_components/modal-shell';
import {
  fmtBRL,
  fmtBRLFull,
  fmtPct,
  isoMonthStart,
  isoMonthEnd,
  isoToday,
  monthLabel,
  parseCurrencyInput,
  maskCurrencyInput,
  methodLabel,
} from '../_lib/format';
import {
  useFinancialTargets,
  type FinancialTargets,
} from '../_lib/use-financial-targets';

const inputStyle: React.CSSProperties = {
  padding: '8px 11px',
  borderRadius: T.r.md,
  background: T.inputBg,
  border: `1px solid ${T.inputBorder}`,
  fontSize: 13,
  color: T.textPrimary,
  fontFamily: "'IBM Plex Sans', sans-serif",
  outline: 'none',
  width: '100%',
};

export default function MetasPage() {
  const router = useRouter();
  const canRead  = usePermission('financial', 'read');
  const canWrite = usePermission('financial', 'write');

  // Always operate on the current month
  const monthStartIso = React.useMemo(() => isoMonthStart(), []);
  const monthEndIso   = React.useMemo(() => isoMonthEnd(), []);
  const today         = React.useMemo(() => isoToday(), []);

  const { targets, setTargets, reset } = useFinancialTargets(monthStartIso);
  const [editorOpen, setEditorOpen] = React.useState(false);

  const finQ = trpc.analytics.financial.useQuery(
    { start: monthStartIso, end: today },
    { enabled: canRead, staleTime: 60_000 },
  );

  const providersQ = trpc.scheduling.listProviders.useQuery(undefined, {
    enabled: canRead,
    staleTime: 5 * 60_000,
  });

  if (!canRead) return <NoAccess />;

  const fin = finQ.data;
  const providers = providersQ.data?.providers ?? [];

  // Days math: how much of the month has elapsed?
  const monthDate = new Date();
  const daysInMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
  ).getDate();
  const dayOfMonth = monthDate.getDate();
  const daysRemaining = Math.max(0, daysInMonth - dayOfMonth);
  const monthProgressPct = daysInMonth > 0 ? dayOfMonth / daysInMonth : 0;

  const currentRevenue = fin?.kpis.revenue.value ?? 0;
  const targetRevenue = targets.totalRevenue;
  const overallPct =
    targetRevenue > 0 ? Math.min(1, currentRevenue / targetRevenue) : 0;

  // Forecast at current pace
  const dailyAvg = dayOfMonth > 0 ? currentRevenue / dayOfMonth : 0;
  const projected = Math.round(dailyAvg * daysInMonth);
  const projectedPct =
    targetRevenue > 0 ? projected / targetRevenue : 0;

  const onPace = projectedPct >= 0.95;

  // Method aggregations
  const byMethodMap = React.useMemo(() => {
    const m = new Map<string, { amount: number; count: number; share: number }>();
    fin?.byMethod.forEach((row) => m.set(row.method, row));
    return m;
  }, [fin]);

  // Provider aggregations
  const byProviderMap = React.useMemo(() => {
    const m = new Map<string, { revenue: number; commission: number | null }>();
    fin?.byProvider.forEach((p) =>
      m.set(p.providerId, { revenue: p.revenue, commission: p.commission }),
    );
    return m;
  }, [fin]);

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '22px 26px' }}>
      <PageHero
        eyebrow="METAS DO MÊS"
        title="Receita vs Metas"
        module="financial"
        icon="percent"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn
              variant="glass"
              small
              icon="arrowLeft"
              onClick={() => router.push('/financeiro')}
            >
              Resumo
            </Btn>
            {canWrite && (
              <Btn
                small
                icon={targets.updatedAt ? 'edit' : 'plus'}
                onClick={() => setEditorOpen(true)}
              >
                {targets.updatedAt ? 'Editar metas' : 'Definir metas'}
              </Btn>
            )}
          </div>
        }
      />

      {!targets.updatedAt && (
        <Glass
          style={{
            padding: '20px 22px',
            marginBottom: 14,
            borderColor: T.warningBorder,
            background: T.warningBg,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <Ico name="alert" size={22} color={T.warning} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: T.warning }}>
                Nenhuma meta definida ainda para {monthLabel().toLowerCase()}.
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: T.textSecondary,
                  marginTop: 4,
                  maxWidth: 600,
                  lineHeight: 1.5,
                }}
              >
                Defina meta de receita total, por profissional e por método de
                pagamento (PIX, cartão, boleto, etc.). As metas ficam armazenadas
                neste navegador, por clínica e por mês.
              </p>
              {canWrite && (
                <Btn
                  small
                  icon="plus"
                  style={{ marginTop: 12 }}
                  onClick={() => setEditorOpen(true)}
                >
                  Definir metas agora
                </Btn>
              )}
            </div>
          </div>
        </Glass>
      )}

      {/* ─── Headline KPIs ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))',
          gap: 10,
          marginBottom: 18,
        }}
      >
        <Stat
          label="Realizado no mês"
          value={finQ.isLoading ? '…' : fmtBRL(currentRevenue)}
          sub={`${dayOfMonth}/${daysInMonth} dias · média ${fmtBRL(Math.round(dailyAvg))}/dia`}
          icon="barChart"
          mod="financial"
        />
        <Stat
          label="Meta total"
          value={targetRevenue > 0 ? fmtBRL(targetRevenue) : '—'}
          sub={
            targetRevenue > 0
              ? `${fmtPct(overallPct, 0)} alcançado`
              : 'Defina sua meta mensal'
          }
          icon="percent"
          mod={overallPct >= 1 ? 'financial' : 'accentMod'}
        />
        <Stat
          label="Projeção fim do mês"
          value={finQ.isLoading ? '…' : fmtBRL(projected)}
          sub={
            targetRevenue > 0
              ? onPace
                ? `${fmtPct(projectedPct, 0)} da meta · no ritmo`
                : `${fmtPct(projectedPct, 0)} da meta · acelere`
              : 'Mantendo este ritmo'
          }
          icon="zap"
          mod={targetRevenue > 0 && onPace ? 'financial' : 'accentMod'}
        />
        <Stat
          label="Saldo a faturar"
          value={
            targetRevenue > 0
              ? fmtBRL(Math.max(0, targetRevenue - currentRevenue))
              : '—'
          }
          sub={`${daysRemaining} dia${daysRemaining !== 1 ? 's' : ''} restante${daysRemaining !== 1 ? 's' : ''} no mês`}
          icon="clock"
          mod="financial"
        />
      </div>

      {/* ─── Visão geral (gauge) ─────────────────────────────────────── */}
      {targetRevenue > 0 && (
        <Glass metal style={{ padding: '22px 26px', marginBottom: 14 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 24,
            }}
          >
            <div>
              <Mono size={10} color={T.textMuted} spacing="1px">
                META MENSAL
              </Mono>
              <p
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: T.textPrimary,
                  letterSpacing: '-0.025em',
                  marginTop: 6,
                }}
              >
                {fmtBRLFull(currentRevenue)}{' '}
                <span style={{ fontSize: 16, color: T.textMuted, fontWeight: 500 }}>
                  / {fmtBRLFull(targetRevenue)}
                </span>
              </p>
              <p style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>
                {monthLabel()} · atualizado em{' '}
                {targets.updatedAt
                  ? new Date(targets.updatedAt).toLocaleDateString('pt-BR')
                  : '—'}
              </p>

              <div style={{ marginTop: 18 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: T.textSecondary,
                    marginBottom: 6,
                  }}
                >
                  <span>Realizado</span>
                  <span style={{ fontWeight: 600, color: T.textPrimary }}>
                    {fmtPct(overallPct, 1)}
                  </span>
                </div>
                <Bar
                  pct={Math.round(overallPct * 100)}
                  color={overallPct >= 1 ? T.success : T.financial.color}
                  height={10}
                />

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: T.textSecondary,
                    marginTop: 14,
                    marginBottom: 6,
                  }}
                >
                  <span>Tempo decorrido</span>
                  <span style={{ fontWeight: 600, color: T.textPrimary }}>
                    {fmtPct(monthProgressPct, 0)}
                  </span>
                </div>
                <Bar
                  pct={Math.round(monthProgressPct * 100)}
                  color={T.textMuted}
                  height={6}
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 12,
              }}
            >
              <ForecastCard
                projected={projected}
                target={targetRevenue}
                onPace={onPace}
              />
              <PaceHint
                overallPct={overallPct}
                monthProgressPct={monthProgressPct}
                projectedPct={projectedPct}
              />
            </div>
          </div>
        </Glass>
      )}

      {/* ─── Por profissional ────────────────────────────────────────── */}
      {Object.keys(targets.perProvider).length > 0 && (
        <Glass style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
          <SectionHeader
            icon="user"
            title="Metas por profissional"
            subtitle={`${Object.keys(targets.perProvider).length} profissionais com meta definida`}
          />
          <div style={{ padding: '14px 18px' }}>
            {providers
              .filter((p) => targets.perProvider[p.id] && targets.perProvider[p.id]! > 0)
              .map((p) => {
                const goal = targets.perProvider[p.id] ?? 0;
                const realized = byProviderMap.get(p.id)?.revenue ?? 0;
                const pct = goal > 0 ? Math.min(1, realized / goal) : 0;
                return (
                  <div
                    key={p.id}
                    style={{
                      paddingBottom: 14,
                      marginBottom: 14,
                      borderBottom: `1px solid ${T.divider}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: T.textPrimary,
                        }}
                      >
                        {p.name}
                        <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>
                          {p.role}
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          color: T.textSecondary,
                          fontFamily: "'IBM Plex Mono', monospace",
                        }}
                      >
                        {fmtBRLFull(realized)}{' '}
                        <span style={{ color: T.textMuted }}>
                          / {fmtBRLFull(goal)}
                        </span>
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <Bar
                          pct={Math.round(pct * 100)}
                          color={
                            pct >= 1
                              ? T.success
                              : pct >= 0.7
                                ? T.financial.color
                                : T.warning
                          }
                          height={7}
                        />
                      </div>
                      <Badge
                        variant={
                          pct >= 1 ? 'success' : pct >= 0.5 ? 'info' : 'warning'
                        }
                      >
                        {fmtPct(pct, 0)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
          </div>
        </Glass>
      )}

      {/* ─── Por método de pagamento ─────────────────────────────────── */}
      {Object.keys(targets.perMethod).length > 0 && (
        <Glass style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
          <SectionHeader
            icon="creditCard"
            title="Metas por método de pagamento"
            subtitle="PIX, cartão, boleto, dinheiro, convênio"
          />
          <div style={{ padding: '14px 18px' }}>
            {PAYMENT_METHODS.filter(
              (m) => targets.perMethod[m] && targets.perMethod[m]! > 0,
            ).map((m) => {
              const goal = targets.perMethod[m] ?? 0;
              const realized = byMethodMap.get(m)?.amount ?? 0;
              const pct = goal > 0 ? Math.min(1, realized / goal) : 0;
              return (
                <div
                  key={m}
                  style={{
                    paddingBottom: 14,
                    marginBottom: 14,
                    borderBottom: `1px solid ${T.divider}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: T.textPrimary,
                      }}
                    >
                      {methodLabel(m)}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: T.textSecondary,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      {fmtBRLFull(realized)}{' '}
                      <span style={{ color: T.textMuted }}>
                        / {fmtBRLFull(goal)}
                      </span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <Bar
                        pct={Math.round(pct * 100)}
                        color={
                          pct >= 1
                            ? T.success
                            : pct >= 0.7
                              ? T.financial.color
                              : T.warning
                        }
                        height={7}
                      />
                    </div>
                    <Badge
                      variant={
                        pct >= 1 ? 'success' : pct >= 0.5 ? 'info' : 'warning'
                      }
                    >
                      {fmtPct(pct, 0)}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Glass>
      )}

      {finQ.isLoading && (
        <Glass style={{ padding: 22 }}>
          <Skeleton width="40%" height={18} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width="100%" height={36} delay={i * 80} />
            ))}
          </div>
        </Glass>
      )}

      <TargetsEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        targets={targets}
        providers={providers}
        onSave={(t) => {
          setTargets(t);
          setEditorOpen(false);
        }}
        onReset={reset}
      />
    </div>
  );
}

function ForecastCard({
  projected,
  target,
  onPace,
}: {
  projected: number;
  target: number;
  onPace: boolean;
}) {
  const diff = projected - target;
  const pct = target > 0 ? Math.abs(diff) / target : 0;
  return (
    <div
      style={{
        padding: '16px 18px',
        borderRadius: T.r.md,
        background: onPace ? T.successBg : T.warningBg,
        border: `1px solid ${onPace ? T.successBorder : T.warningBorder}`,
      }}
    >
      <Mono size={9} color={onPace ? T.success : T.warning} spacing="0.8px">
        PROJEÇÃO ATÉ FIM DO MÊS
      </Mono>
      <p
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: T.textPrimary,
          letterSpacing: '-0.02em',
          marginTop: 4,
        }}
      >
        {fmtBRLFull(projected)}
      </p>
      <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>
        {onPace
          ? diff >= 0
            ? `Superando a meta em ${fmtBRL(diff)} (${fmtPct(pct, 0)})`
            : 'No ritmo certo para bater a meta'
          : `Risco de ficar ${fmtBRL(Math.abs(diff))} abaixo da meta (${fmtPct(pct, 0)})`}
      </p>
    </div>
  );
}

function PaceHint({
  overallPct,
  monthProgressPct,
  projectedPct,
}: {
  overallPct:        number;
  monthProgressPct:  number;
  projectedPct:      number;
}) {
  const aheadOfTime = overallPct > monthProgressPct + 0.05;
  const behindTime  = overallPct < monthProgressPct - 0.05;

  let icon: 'zap' | 'alert' | 'check' = 'check';
  let color: string = T.success;
  let text  = 'Você está acompanhando o ritmo do mês.';

  if (aheadOfTime) {
    icon = 'zap';
    color = T.success;
    text = `Adiantado em ${fmtPct(overallPct - monthProgressPct, 0)} comparado ao tempo decorrido. Mantenha o ritmo.`;
  } else if (behindTime) {
    icon = 'alert';
    color = T.warning;
    text = `Atrasado em ${fmtPct(monthProgressPct - overallPct, 0)} comparado ao tempo decorrido. ${
      projectedPct < 0.95
        ? 'A projeção indica que a meta pode não ser alcançada — revise o pipeline.'
        : 'Mantendo este ritmo, a meta ainda é alcançável.'
    }`;
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: '12px 14px',
        borderRadius: T.r.md,
        background: 'white',
        border: `1px solid ${T.divider}`,
      }}
    >
      <Ico name={icon} size={16} color={color} />
      <p style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5 }}>{text}</p>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: 'user' | 'creditCard' | 'percent';
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        padding: '14px 18px',
        borderBottom: `1px solid ${T.divider}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: T.r.sm,
          background: T.financial.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ico name={icon} size={14} color={T.financial.color} />
      </div>
      <div>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
          {title}
        </span>
        {subtitle && (
          <p style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function NoAccess() {
  return (
    <div style={{ padding: '60px 26px', textAlign: 'center' }}>
      <Ico name="shield" size={32} color={T.textMuted} />
      <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, marginTop: 14 }}>
        Acesso restrito
      </p>
      <p
        style={{
          fontSize: 13,
          color: T.textMuted,
          marginTop: 4,
          maxWidth: 340,
          margin: '4px auto 0',
        }}
      >
        Você não tem permissão para visualizar metas financeiras.
      </p>
    </div>
  );
}

interface TargetsEditorProps {
  open: boolean;
  onClose: () => void;
  targets: FinancialTargets;
  providers: Array<{ id: string; name: string; role: string }>;
  onSave: (t: FinancialTargets) => void;
  onReset: () => void;
}

function TargetsEditorModal({
  open,
  onClose,
  targets,
  providers,
  onSave,
  onReset,
}: TargetsEditorProps) {
  const { toast } = useToast();
  const [totalRevenue, setTotalRevenue] = React.useState(targets.totalRevenue);
  const [perProvider, setPerProvider] = React.useState<Record<string, number>>(
    targets.perProvider,
  );
  const [perMethod, setPerMethod] = React.useState<
    Partial<Record<string, number>>
  >(targets.perMethod);

  React.useEffect(() => {
    if (open) {
      setTotalRevenue(targets.totalRevenue);
      setPerProvider(targets.perProvider);
      setPerMethod(targets.perMethod);
    }
  }, [open, targets]);

  function handleSave() {
    const sumProviders = Object.values(perProvider).reduce((a, b) => a + b, 0);
    if (sumProviders > totalRevenue && totalRevenue > 0) {
      const ok = window.confirm(
        `A soma das metas individuais (${fmtBRLFull(sumProviders)}) é maior que a meta total (${fmtBRLFull(totalRevenue)}). Deseja continuar mesmo assim?`,
      );
      if (!ok) return;
    }
    onSave({
      totalRevenue,
      perProvider,
      perMethod,
      updatedAt: new Date().toISOString(),
    });
    toast.success('Metas salvas', { description: monthLabel() });
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={`Metas de ${monthLabel()}`}
      subtitle="Salvas neste navegador, por clínica e por mês."
      icon="percent"
      iconTone="financial"
      width={620}
      footer={
        <>
          <Btn small icon="check" onClick={handleSave}>
            Salvar metas
          </Btn>
          {targets.updatedAt && (
            <Btn
              small
              variant="ghost"
              onClick={() => {
                if (window.confirm('Remover todas as metas deste mês?')) {
                  onReset();
                  onClose();
                }
              }}
            >
              Limpar
            </Btn>
          )}
          <div style={{ flex: 1 }} />
          <Btn small variant="ghost" onClick={onClose}>
            Cancelar
          </Btn>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field label="Meta de receita total (R$)" required icon="barChart">
          <input
            type="text"
            inputMode="decimal"
            value={maskCurrencyInput(totalRevenue)}
            onChange={(e) => setTotalRevenue(parseCurrencyInput(e.target.value))}
            style={{ ...inputStyle, fontWeight: 700, fontSize: 16 }}
          />
        </Field>

        <div>
          <Mono size={10} color={T.textMuted} spacing="0.8px">
            POR PROFISSIONAL
          </Mono>
          <p
            style={{
              fontSize: 11,
              color: T.textMuted,
              marginTop: 4,
              marginBottom: 10,
            }}
          >
            Defina quanto cada profissional deve faturar no mês. Deixe em branco para ignorar.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {providers.length === 0 ? (
              <p style={{ fontSize: 12, color: T.textMuted }}>
                Nenhum profissional ativo cadastrado.
              </p>
            ) : (
              providers.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 160px',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 13, color: T.textPrimary }}>
                    {p.name}
                    <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>
                      {p.role}
                    </span>
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={maskCurrencyInput(perProvider[p.id] ?? 0)}
                    onChange={(e) =>
                      setPerProvider((prev) => ({
                        ...prev,
                        [p.id]: parseCurrencyInput(e.target.value),
                      }))
                    }
                    placeholder="0,00"
                    style={inputStyle}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <Mono size={10} color={T.textMuted} spacing="0.8px">
            POR MÉTODO DE PAGAMENTO
          </Mono>
          <p
            style={{
              fontSize: 11,
              color: T.textMuted,
              marginTop: 4,
              marginBottom: 10,
            }}
          >
            Útil para incentivar PIX (sem custo) e desestimular boleto. Deixe em branco para ignorar.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {PAYMENT_METHODS.map((m) => (
              <div
                key={m}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 160px',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, color: T.textPrimary }}>
                  {PAYMENT_METHOD_LABELS[m as PaymentMethod]}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={maskCurrencyInput((perMethod[m] as number | undefined) ?? 0)}
                  onChange={(e) =>
                    setPerMethod((prev) => ({
                      ...prev,
                      [m]: parseCurrencyInput(e.target.value),
                    }))
                  }
                  placeholder="0,00"
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
