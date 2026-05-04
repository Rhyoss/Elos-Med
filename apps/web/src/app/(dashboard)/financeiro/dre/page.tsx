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
  T,
  type IcoName,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { usePermission } from '@/lib/auth';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@dermaos/shared';
import {
  fmtBRL,
  fmtBRLFull,
  fmtPct,
  isoMonthStart,
  isoMonthEnd,
  isoToday,
  isoNDaysAgo,
  monthLabel,
  methodLabel,
  daysBetween,
} from '../_lib/format';

interface PeriodPreset {
  id:    string;
  label: string;
  /** Start date inclusive (yyyy-mm-dd). */
  start: string;
  /** End date inclusive (yyyy-mm-dd). */
  end:   string;
  hint?: string;
}

function buildPresets(): PeriodPreset[] {
  const today = new Date();
  const monthStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(today.getFullYear(), today.getMonth(), 0);
  const yearStart      = new Date(today.getFullYear(), 0, 1);
  const quarterMonth   = Math.floor(today.getMonth() / 3) * 3;
  const quarterStart   = new Date(today.getFullYear(), quarterMonth, 1);

  return [
    {
      id: 'this-month',
      label: monthLabel(today),
      start: isoMonthStart(today),
      end: isoToday(),
      hint: 'Mês atual (até hoje)',
    },
    {
      id: 'last-month',
      label: monthLabel(lastMonthStart),
      start: lastMonthStart.toISOString().slice(0, 10),
      end: lastMonthEnd.toISOString().slice(0, 10),
      hint: 'Mês anterior fechado',
    },
    {
      id: 'last-30',
      label: 'Últimos 30 dias',
      start: isoNDaysAgo(30),
      end: isoToday(),
    },
    {
      id: 'this-quarter',
      label: `Trimestre ${Math.floor(quarterMonth / 3) + 1}T`,
      start: quarterStart.toISOString().slice(0, 10),
      end: isoToday(),
      hint: 'Trimestre atual',
    },
    {
      id: 'this-year',
      label: `Ano ${today.getFullYear()}`,
      start: yearStart.toISOString().slice(0, 10),
      end: isoToday(),
      hint: 'Acumulado do ano',
    },
  ];
}

const inputStyle: React.CSSProperties = {
  padding: '7px 11px',
  borderRadius: T.r.md,
  background: T.inputBg,
  border: `1px solid ${T.inputBorder}`,
  fontSize: 13,
  color: T.textPrimary,
  fontFamily: "'IBM Plex Sans', sans-serif",
  outline: 'none',
};

export default function DrePage() {
  const router = useRouter();
  const canRead   = usePermission('financial', 'read');
  const canExport = usePermission('analytics', 'export');

  const presets = React.useMemo(buildPresets, []);
  const [presetId, setPresetId]     = React.useState(presets[0]!.id);
  const [customStart, setCustomStart] = React.useState(isoMonthStart());
  const [customEnd, setCustomEnd]     = React.useState(isoToday());
  const [useCustom, setUseCustom]     = React.useState(false);

  const range = React.useMemo(() => {
    if (useCustom) return { start: customStart, end: customEnd };
    const p = presets.find((x) => x.id === presetId) ?? presets[0]!;
    return { start: p.start, end: p.end };
  }, [useCustom, customStart, customEnd, presetId, presets]);

  const finQ = trpc.analytics.financial.useQuery(range, {
    enabled: canRead,
    staleTime: 60_000,
  });

  // Custos (compras de suprimentos no mesmo período — apenas recebidos)
  const purchasesQ = trpc.supply.purchaseOrders.list.useQuery(
    {
      dateFrom: range.start,
      dateTo:   range.end,
      status:   'recebido',
      page:     1,
      limit:    200,
    },
    { enabled: canRead, staleTime: 60_000 },
  );

  // Faturas canceladas no período (informativo)
  const cancelledQ = trpc.financial.invoices.list.useQuery(
    {
      status: 'cancelada',
      dateFrom: new Date(range.start),
      dateTo:   new Date(range.end),
      page: 1,
      limit: 100,
    },
    { enabled: canRead, staleTime: 60_000 },
  );

  if (!canRead) return <NoAccess />;

  const fin = finQ.data;
  const purchases = purchasesQ.data?.items ?? [];
  const cancelled = cancelledQ.data?.data ?? [];

  // ── DRE math (centavos) ──────────────────────────────────────────────
  const grossRevenue = fin?.kpis.revenue.value ?? 0;
  const refunds      = fin?.kpis.refunds.value ?? 0;
  const netRevenue   = fin?.kpis.netRevenue.value ?? grossRevenue - refunds;
  // supply.purchase_orders.total_amount é DECIMAL(12,2) em reais → converte p/ centavos
  const supplyCost = purchases.reduce(
    (acc, o) => acc + Math.round((o.totalAmount ?? 0) * 100),
    0,
  );
  const operatingProfit = netRevenue - supplyCost;
  const margin       = netRevenue > 0 ? operatingProfit / netRevenue : 0;
  const days         = daysBetween(range.start, range.end);
  const dailyAvg     = days > 0 ? Math.round(grossRevenue / days) : 0;

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '22px 26px' }}>
      <PageHero
        eyebrow="DEMONSTRATIVO DE RESULTADO"
        title="DRE Gerencial"
        module="financial"
        icon="barChart"
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
            {canExport && (
              <Btn
                variant="glass"
                small
                icon="download"
                onClick={() => exportDreCsv({ range, fin, supplyCost, operatingProfit })}
              >
                Exportar CSV
              </Btn>
            )}
            {canExport && (
              <Btn
                variant="glass"
                small
                icon="printer"
                onClick={() => window.print()}
              >
                Imprimir
              </Btn>
            )}
          </div>
        }
      />

      {/* ─── Period selector ─────────────────────────────────────────── */}
      <Glass style={{ padding: '12px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Mono size={10} color={T.textMuted} style={{ marginRight: 6 }}>
            PERÍODO
          </Mono>
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setUseCustom(false);
                setPresetId(p.id);
              }}
              title={p.hint}
              style={{
                padding: '6px 12px',
                borderRadius: T.r.pill,
                background:
                  !useCustom && presetId === p.id ? T.financial.bg : 'white',
                border: `1px solid ${
                  !useCustom && presetId === p.id ? T.financial.border : T.divider
                }`,
                color:
                  !useCustom && presetId === p.id
                    ? T.financial.color
                    : T.textSecondary,
                fontSize: 12,
                fontWeight: !useCustom && presetId === p.id ? 600 : 500,
                fontFamily: "'IBM Plex Sans', sans-serif",
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="date"
              value={customStart}
              onChange={(e) => {
                setCustomStart(e.target.value);
                setUseCustom(true);
              }}
              style={inputStyle}
            />
            <span style={{ fontSize: 11, color: T.textMuted }}>→</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => {
                setCustomEnd(e.target.value);
                setUseCustom(true);
              }}
              style={inputStyle}
            />
          </div>
        </div>
      </Glass>

      {/* ─── KPIs ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
          gap: 10,
          marginBottom: 18,
        }}
      >
        <Stat
          label="Receita bruta"
          value={finQ.isLoading ? '…' : fmtBRL(grossRevenue)}
          sub={`${days} dia${days !== 1 ? 's' : ''} · média ${fmtBRL(dailyAvg)}/dia`}
          icon="barChart"
          mod="financial"
        />
        <Stat
          label="Receita líquida"
          value={finQ.isLoading ? '…' : fmtBRL(netRevenue)}
          sub={`(–) ${fmtBRL(refunds)} em estornos`}
          icon="activity"
          mod="financial"
        />
        <Stat
          label="Resultado operacional"
          value={finQ.isLoading ? '…' : fmtBRL(operatingProfit)}
          sub={
            operatingProfit >= 0
              ? `Margem ${fmtPct(margin, 1)}`
              : `Prejuízo ${fmtPct(Math.abs(margin), 1)}`
          }
          icon="percent"
          mod={operatingProfit >= 0 ? 'financial' : 'accentMod'}
        />
        <Stat
          label="Faturas pagas"
          value={finQ.isLoading ? '…' : String(fin?.kpis.paidInvoices.value ?? 0)}
          sub={`Ticket médio ${fmtBRL(fin?.kpis.avgTicket.value ?? 0)}`}
          icon="creditCard"
          mod="financial"
        />
      </div>

      {/* ─── DRE table ───────────────────────────────────────────────── */}
      <Glass style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
        <div
          style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${T.divider}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
              <Ico name="barChart" size={14} color={T.financial.color} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
                Demonstrativo do resultado
              </h3>
              <p style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
                {new Date(range.start).toLocaleDateString('pt-BR')} até{' '}
                {new Date(range.end).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
          {finQ.data?.cached && (
            <Mono size={9} color={T.textMuted}>
              CACHE · {new Date(finQ.data.generatedAt).toLocaleTimeString('pt-BR')}
            </Mono>
          )}
        </div>

        {finQ.isLoading ? (
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} width="100%" height={28} delay={i * 70} />
            ))}
          </div>
        ) : (
          <div style={{ padding: '6px 0' }}>
            <DreLine
              label="(+) Receita bruta de serviços"
              value={grossRevenue}
              color={T.financial.color}
              hint="Pagamentos aprovados, antes de estornos"
            />
            <DreLine
              label="(–) Estornos / cancelamentos"
              value={-refunds}
              indent
              color={T.warning}
              hint={`${cancelled.length} faturas canceladas no período`}
            />
            <DreLine
              label="= Receita líquida"
              value={netRevenue}
              bold
              accent
            />
            <DreLine
              label="(–) Custo de produtos & insumos"
              value={-supplyCost}
              indent
              color={T.warning}
              hint={`${purchases.length} pedidos de compra recebidos`}
            />
            <DreLine
              label="= Resultado operacional"
              value={operatingProfit}
              bold
              accent
              positiveColor={operatingProfit >= 0 ? T.success : T.danger}
            />
            <DreLine
              label="Margem operacional"
              value={null}
              extraValue={fmtPct(margin, 1)}
              color={operatingProfit >= 0 ? T.success : T.danger}
            />
          </div>
        )}
      </Glass>

      {/* ─── Receita por método ──────────────────────────────────────── */}
      {fin && fin.byMethod.length > 0 && (
        <Glass style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
          <SectionHeader
            icon="percent"
            title="Receita por método de pagamento"
            subtitle="Distribuição dos recebimentos do período"
          />
          <div style={{ padding: '14px 18px' }}>
            {fin.byMethod.map((m) => {
              const max = fin.byMethod[0]?.amount || 1;
              const pct = Math.round((m.amount / max) * 100);
              return (
                <div key={m.method} style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 5,
                    }}
                  >
                    <span style={{ fontSize: 13, color: T.textSecondary, fontWeight: 500 }}>
                      {methodLabel(m.method)}
                      <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>
                        {m.count}× · {fmtPct(m.share)}
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: T.textPrimary,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      {fmtBRLFull(m.amount)}
                    </span>
                  </div>
                  <Bar
                    pct={pct}
                    color={methodColor(m.method as PaymentMethod)}
                    height={6}
                  />
                </div>
              );
            })}
          </div>
          <div
            style={{
              padding: '10px 18px',
              borderTop: `1px solid ${T.divider}`,
              display: 'flex',
              justifyContent: 'space-between',
              background: T.metalGrad,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>
              Total recebido
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: T.financial.color,
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              {fmtBRLFull(fin.byMethod.reduce((a, m) => a + m.amount, 0))}
            </span>
          </div>
        </Glass>
      )}

      {/* ─── Aging ───────────────────────────────────────────────────── */}
      {fin && (
        <Glass style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
          <SectionHeader
            icon="alert"
            tone="danger"
            title="Inadimplência por faixa"
            subtitle="Saldo em aberto por dias de vencimento"
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 0,
            }}
          >
            {([
              { label: 'A vencer',  value: fin.agingBuckets.current,  color: T.success },
              { label: '0–30 dias', value: fin.agingBuckets.d0_30,    color: T.warning },
              { label: '31–60 dias', value: fin.agingBuckets.d31_60,  color: T.warning },
              { label: '61–90 dias', value: fin.agingBuckets.d61_90,  color: T.danger },
              { label: '90+ dias',   value: fin.agingBuckets.d90Plus, color: T.danger },
            ] as const).map((b, i) => (
              <div
                key={b.label}
                style={{
                  padding: '16px 14px',
                  textAlign: 'center',
                  borderRight: i < 4 ? `1px solid ${T.divider}` : 'none',
                }}
              >
                <Mono size={9} spacing="0.8px" color={T.textMuted}>
                  {b.label.toUpperCase()}
                </Mono>
                <p
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: b.value > 0 ? b.color : T.textMuted,
                    marginTop: 6,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {b.value > 0 ? fmtBRL(b.value) : '—'}
                </p>
              </div>
            ))}
          </div>
        </Glass>
      )}

      {/* ─── Por profissional ────────────────────────────────────────── */}
      {fin && fin.byProvider.length > 0 && (
        <Glass style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
          <SectionHeader
            icon="user"
            title="Receita por profissional"
            subtitle="Faturado no período (líquido)"
          />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Profissional', 'Receita', '% do total', 'Comissão'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 16px',
                      textAlign: i === 0 ? 'left' : 'right',
                      fontSize: 10,
                      fontFamily: "'IBM Plex Mono', monospace",
                      letterSpacing: '1px',
                      color: T.textMuted,
                      fontWeight: 500,
                      borderBottom: `1px solid ${T.divider}`,
                      background: T.metalGrad,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fin.byProvider.map((p, i) => {
                const share = grossRevenue > 0 ? p.revenue / grossRevenue : 0;
                return (
                  <tr
                    key={p.providerId}
                    style={{
                      borderBottom: `1px solid ${T.divider}`,
                      background:
                        i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.18)',
                    }}
                  >
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        color: T.textPrimary,
                        fontWeight: 500,
                      }}
                    >
                      {p.providerName}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        fontWeight: 700,
                        color: T.textPrimary,
                        textAlign: 'right',
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      {fmtBRLFull(p.revenue)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          width: 160,
                          justifyContent: 'flex-end',
                        }}
                      >
                        <Bar
                          pct={Math.round(share * 100)}
                          color={T.financial.color}
                          height={5}
                        />
                        <Mono size={10}>{fmtPct(share)}</Mono>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 12,
                        color: p.commission != null ? T.textSecondary : T.textMuted,
                        textAlign: 'right',
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      {p.commission != null ? fmtBRLFull(p.commission) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Glass>
      )}

      {/* ─── Top serviços ────────────────────────────────────────────── */}
      {fin && fin.topServices.length > 0 && (
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHeader
            icon="layers"
            title="Top serviços por receita"
            subtitle="Mix de procedimentos no período"
          />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Serviço', 'Volume', 'Receita', 'Ticket médio'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 16px',
                      textAlign: i === 0 ? 'left' : 'right',
                      fontSize: 10,
                      fontFamily: "'IBM Plex Mono', monospace",
                      letterSpacing: '1px',
                      color: T.textMuted,
                      fontWeight: 500,
                      borderBottom: `1px solid ${T.divider}`,
                      background: T.metalGrad,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fin.topServices.slice(0, 10).map((s, i) => {
                const ticket = s.count > 0 ? Math.round(s.revenue / s.count) : 0;
                return (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: `1px solid ${T.divider}`,
                      background:
                        i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.18)',
                    }}
                  >
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        color: T.textPrimary,
                        fontWeight: 500,
                      }}
                    >
                      {s.name}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        color: T.textSecondary,
                        textAlign: 'right',
                      }}
                    >
                      ×{s.count}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        fontWeight: 700,
                        color: T.textPrimary,
                        textAlign: 'right',
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      {fmtBRLFull(s.revenue)}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 12,
                        color: T.textSecondary,
                        textAlign: 'right',
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      {fmtBRLFull(ticket)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Glass>
      )}
    </div>
  );
}

interface DreLineProps {
  label: string;
  value: number | null;
  extraValue?: string;
  bold?: boolean;
  indent?: boolean;
  accent?: boolean;
  color?: string;
  positiveColor?: string;
  hint?: string;
}

function DreLine({
  label,
  value,
  extraValue,
  bold,
  indent,
  accent,
  color,
  positiveColor,
  hint,
}: DreLineProps) {
  const display =
    extraValue != null
      ? extraValue
      : value == null
        ? '—'
        : fmtBRLFull(value);
  const valueColor =
    value != null && value !== 0
      ? value > 0
        ? positiveColor ?? color ?? T.textPrimary
        : color ?? T.warning
      : color ?? T.textPrimary;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '12px 22px',
        paddingLeft: indent ? 42 : 22,
        background: accent ? T.metalGrad : 'transparent',
        borderTop: accent ? `1px solid ${T.divider}` : 'none',
        borderBottom: accent ? `1px solid ${T.divider}` : 'none',
      }}
    >
      <div>
        <p
          style={{
            fontSize: bold ? 14 : 13,
            fontWeight: bold ? 700 : 500,
            color: T.textPrimary,
          }}
        >
          {label}
        </p>
        {hint && (
          <p style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{hint}</p>
        )}
      </div>
      <span
        style={{
          fontSize: bold ? 17 : 14,
          fontWeight: bold ? 700 : 500,
          color: valueColor,
          fontFamily: "'IBM Plex Mono', monospace",
          letterSpacing: bold ? '-0.01em' : 0,
        }}
      >
        {display}
      </span>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  tone = 'financial',
}: {
  icon: IcoName;
  title: string;
  subtitle?: string;
  tone?: 'financial' | 'danger';
}) {
  const c =
    tone === 'danger' ? T.danger : T.financial.color;
  const bg =
    tone === 'danger' ? T.dangerBg : T.financial.bg;
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
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ico name={icon} size={14} color={c} />
      </div>
      <div>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
          {title}
        </span>
        {subtitle && (
          <p style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

const METHOD_COLORS: Record<PaymentMethod, string> = {
  pix:            '#06A77D',
  cartao_credito: '#1A4A5A',
  cartao_debito:  '#2A4A7A',
  dinheiro:       '#A87510',
  boleto:         '#6B3F73',
  plano_saude:    '#4D1717',
};

function methodColor(method: PaymentMethod): string {
  return METHOD_COLORS[method] ?? T.financial.color;
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
        Você não tem permissão para visualizar o DRE.
      </p>
    </div>
  );
}

function exportDreCsv({
  range,
  fin,
  supplyCost,
  operatingProfit,
}: {
  range:           { start: string; end: string };
  fin:             ReturnType<typeof Object> | undefined | unknown;
  supplyCost:      number;
  operatingProfit: number;
}): void {
  const f = fin as
    | {
        kpis: { revenue: { value: number }; refunds: { value: number }; netRevenue: { value: number } };
        byMethod: Array<{ method: string; amount: number; count: number; share: number }>;
      }
    | undefined;
  if (!f) return;
  const rows: Array<[string, string]> = [
    ['Período',                `${range.start} → ${range.end}`],
    ['(+) Receita bruta',      (f.kpis.revenue.value / 100).toFixed(2).replace('.', ',')],
    ['(-) Estornos',           (f.kpis.refunds.value / 100).toFixed(2).replace('.', ',')],
    ['= Receita líquida',      (f.kpis.netRevenue.value / 100).toFixed(2).replace('.', ',')],
    ['(-) Custo de insumos',   (supplyCost / 100).toFixed(2).replace('.', ',')],
    ['= Resultado operacional', (operatingProfit / 100).toFixed(2).replace('.', ',')],
    ['', ''],
    ['Receita por método',     ''],
    ...f.byMethod.map<[string, string]>((m) => [
      PAYMENT_METHOD_LABELS[m.method as PaymentMethod] ?? m.method,
      (m.amount / 100).toFixed(2).replace('.', ','),
    ]),
  ];
  const csv = rows
    .map((row) => row.map((c) => `"${c}"`).join(';'))
    .join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dre-${range.start}-a-${range.end}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
