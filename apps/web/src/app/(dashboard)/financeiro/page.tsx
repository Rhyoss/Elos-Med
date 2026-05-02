'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Glass, Btn, Stat, Mono, Badge, Ico, Bar, Skeleton,
  PageHero, T,
  type IcoName, type BadgeVariant,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { usePermission } from '@/lib/auth';
import {
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type InvoiceStatus,
  type PaymentMethod,
} from '@dermaos/shared';

const STATUS_BADGE: Record<InvoiceStatus, BadgeVariant> = {
  rascunho:  'default',
  emitida:   'info',
  parcial:   'warning',
  paga:      'success',
  vencida:   'danger',
  cancelada: 'danger',
};

function fmtBRL(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function fmtBRLFull(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function fmtPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function monthLabel(): string {
  const d = new Date();
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function SectionHeader({
  icon,
  color,
  title,
  action,
}: {
  icon: IcoName;
  color?: string;
  title: string;
  action?: React.ReactNode;
}) {
  const c = color ?? T.financial.color;
  return (
    <div
      style={{
        padding: '14px 18px',
        borderBottom: `1px solid ${T.divider}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: T.r.sm,
            background: `${c}10`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Ico name={icon} size={14} color={c} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{title}</span>
      </div>
      {action}
    </div>
  );
}

function ErrorCard({
  title,
  onRetry,
}: {
  title: string;
  onRetry: () => void;
}) {
  return (
    <Glass style={{ padding: '32px 22px', textAlign: 'center' }}>
      <Ico name="alert" size={22} color={T.danger} />
      <p style={{ fontSize: 13, color: T.textMuted, margin: '10px 0 4px' }}>{title}</p>
      <Btn small variant="ghost" onClick={onRetry}>Tentar novamente</Btn>
    </Glass>
  );
}

function EmptyState({
  icon,
  text,
  action,
}: {
  icon: IcoName;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ padding: '40px 22px', textAlign: 'center' }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: T.r.md,
          background: T.financial.bg,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <Ico name={icon} size={20} color={T.financial.color} />
      </div>
      <p style={{ fontSize: 14, color: T.textMuted, marginBottom: action ? 14 : 0 }}>{text}</p>
      {action}
    </div>
  );
}

export default function FinanceiroPage() {
  const router = useRouter();
  const canWrite = usePermission('financial', 'write');
  const canExport = usePermission('analytics', 'export');

  const today = React.useMemo(() => isoToday(), []);
  const monthStart = React.useMemo(() => isoMonthStart(), []);

  const financialQ = trpc.analytics.financial.useQuery(
    { start: monthStart, end: today },
    { staleTime: 60_000 },
  );

  const caixaQ = trpc.financial.caixa.getDia.useQuery(
    {},
    { staleTime: 30_000 },
  );

  const invoicesQ = trpc.financial.invoices.list.useQuery(
    { page: 1, limit: 10 },
    { staleTime: 30_000 },
  );

  const overdueQ = trpc.financial.invoices.list.useQuery(
    { status: 'vencida', page: 1, limit: 100 },
    { staleTime: 60_000 },
  );

  const fin = financialQ.data;
  const caixa = caixaQ.data;
  const invoices = invoicesQ.data?.data ?? [];
  const invoicesTotal = invoicesQ.data?.total ?? 0;
  const overdueCount = overdueQ.data?.total ?? 0;

  const kpis = fin?.kpis;

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '22px 26px' }}>
      <PageHero
        eyebrow="CAIXA E FATURAMENTO"
        title="Financeiro"
        module="financial"
        icon="creditCard"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {canExport && (
              <Btn variant="glass" small icon="download">
                Exportar
              </Btn>
            )}
            <Btn
              variant="glass"
              small
              icon="barChart"
              onClick={() => router.push('/financeiro/dre')}
            >
              DRE
            </Btn>
            {canWrite && (
              <Btn small icon="plus" onClick={() => router.push('/financeiro/faturas')}>
                Nova fatura
              </Btn>
            )}
          </div>
        }
      />

      {/* ── KPIs ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
          gap: 10,
          marginBottom: 20,
        }}
      >
        <Stat
          label="Receita mês"
          value={
            financialQ.isLoading
              ? '…'
              : kpis?.revenue.value != null
                ? fmtBRL(kpis.revenue.value)
                : '—'
          }
          sub={
            kpis?.revenue.trendPct != null
              ? `${kpis.revenue.trendPct >= 0 ? '+' : ''}${kpis.revenue.trendPct.toFixed(0)}% vs período anterior`
              : monthLabel()
          }
          icon="barChart"
          mod="financial"
        />
        <Stat
          label="Receita hoje"
          value={
            caixaQ.isLoading
              ? '…'
              : caixa
                ? fmtBRL(caixa.totalGeral)
                : '—'
          }
          sub={
            caixa
              ? `${caixa.countTransacoes} transaç${caixa.countTransacoes !== 1 ? 'ões' : 'ão'}`
              : 'Caixa do dia'
          }
          icon="activity"
          mod="financial"
        />
        <Stat
          label="Ticket médio"
          value={
            financialQ.isLoading
              ? '…'
              : kpis != null && kpis.avgTicket.value != null
                ? fmtBRL(kpis.avgTicket.value)
                : '—'
          }
          sub={
            kpis?.avgTicket.trendPct != null
              ? `${kpis.avgTicket.trendPct >= 0 ? '+' : ''}${kpis.avgTicket.trendPct.toFixed(0)}% vs anterior`
              : 'Por fatura paga'
          }
          icon="percent"
          mod="financial"
        />
        <Stat
          label="Faturas abertas"
          value={
            invoicesQ.isLoading
              ? '…'
              : String(invoicesTotal)
          }
          sub={`${overdueCount} vencida${overdueCount !== 1 ? 's' : ''}`}
          icon="creditCard"
          mod={overdueCount > 0 ? 'accentMod' : 'financial'}
        />
        <Stat
          label="Inadimplência"
          value={
            financialQ.isLoading
              ? '…'
              : kpis?.overdueAmount.value != null
                ? fmtBRL(kpis.overdueAmount.value)
                : '—'
          }
          sub="Total vencido em aberto"
          icon="alert"
          mod={kpis != null && (kpis.overdueAmount.value ?? 0) > 0 ? 'accentMod' : 'financial'}
        />
      </div>

      {/* ── Caixa do dia + Receita por método ──────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 14,
        }}
      >
        {/* Caixa do dia */}
        {caixaQ.isError ? (
          <ErrorCard title="Erro ao carregar caixa" onRetry={() => caixaQ.refetch()} />
        ) : (
          <Glass metal style={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Mono size={10} spacing="1.2px">CAIXA DO DIA</Mono>
              {caixa && (
                <Mono size={9} color={T.textMuted}>
                  {new Date(caixa.date).toLocaleDateString('pt-BR')}
                </Mono>
              )}
            </div>

            {caixaQ.isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
                <Skeleton width="60%" height={32} />
                <Skeleton width="40%" height={14} />
                <Skeleton width="100%" height={6} />
                <Skeleton width="100%" height={6} />
              </div>
            ) : caixa && caixa.countTransacoes > 0 ? (
              <>
                <p
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                    color: T.textPrimary,
                    letterSpacing: '-0.02em',
                    marginBottom: 8,
                  }}
                >
                  {fmtBRL(caixa.totalGeral)}
                </p>
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  <Badge variant="success">
                    {caixa.countTransacoes} transaç{caixa.countTransacoes !== 1 ? 'ões' : 'ão'}
                  </Badge>
                </div>
                {Object.entries(caixa.totalPorMetodo).map(([method, amount]) => {
                  const total = caixa.totalGeral || 1;
                  const pct = Math.round((amount / total) * 100);
                  const label =
                    PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method;
                  return (
                    <div
                      key={method}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        marginBottom: 7,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: T.textSecondary,
                          width: 95,
                          flexShrink: 0,
                        }}
                      >
                        {label}
                      </span>
                      <Bar pct={pct} color={T.primary} height={4} />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: T.textPrimary,
                          width: 80,
                          textAlign: 'right',
                          flexShrink: 0,
                        }}
                      >
                        {fmtBRL(amount)}
                      </span>
                    </div>
                  );
                })}
              </>
            ) : (
              <EmptyState
                icon="creditCard"
                text="Nenhuma transação registrada hoje"
                action={
                  canWrite ? (
                    <Btn small variant="glass" onClick={() => router.push('/financeiro/faturas')}>
                      Registrar pagamento
                    </Btn>
                  ) : undefined
                }
              />
            )}
          </Glass>
        )}

        {/* Receita por origem (topServices do analytics.financial) */}
        {financialQ.isError ? (
          <ErrorCard title="Erro ao carregar receita" onRetry={() => financialQ.refetch()} />
        ) : (
          <Glass style={{ padding: '18px 22px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                Receita por serviço
              </span>
              <Mono size={9} color={T.financial.color}>
                {monthLabel().toUpperCase()}
              </Mono>
            </div>

            {financialQ.isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i}>
                    <Skeleton width="50%" height={12} delay={i * 100} />
                    <Skeleton width="100%" height={6} delay={i * 100 + 50} style={{ marginTop: 6 }} />
                  </div>
                ))}
              </div>
            ) : fin && fin.topServices.length > 0 ? (
              <>
                {fin.topServices.slice(0, 5).map((svc) => {
                  const maxRevenue = fin.topServices[0]?.revenue || 1;
                  const pct = Math.round((svc.revenue / maxRevenue) * 100);
                  return (
                    <div key={svc.id} style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: 5,
                        }}
                      >
                        <span style={{ fontSize: 13, color: T.textSecondary }}>
                          {svc.name}
                          <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 6 }}>
                            ({svc.count}x)
                          </span>
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: T.textPrimary,
                          }}
                        >
                          {fmtBRL(svc.revenue)}
                        </span>
                      </div>
                      <Bar pct={pct} color={T.financial.color} />
                    </div>
                  );
                })}
                <div
                  style={{
                    paddingTop: 10,
                    borderTop: `1px solid ${T.divider}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}
                  >
                    Total
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: T.financial.color,
                    }}
                  >
                    {kpis?.revenue.value != null ? fmtBRL(kpis.revenue.value) : '—'}
                  </span>
                </div>
              </>
            ) : (
              <EmptyState
                icon="barChart"
                text="Nenhuma receita registrada no período"
              />
            )}
          </Glass>
        )}
      </div>

      {/* ── Recebimentos por método (período) ──────────────────────────── */}
      {fin && fin.byMethod.length > 0 && (
        <Glass style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
          <SectionHeader icon="percent" title="Recebimentos por método" />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(fin.byMethod.length, 6)}, 1fr)`,
              gap: 0,
            }}
          >
            {fin.byMethod.map((m, i) => {
              const label =
                PAYMENT_METHOD_LABELS[m.method as PaymentMethod] ?? m.method;
              return (
                <div
                  key={m.method}
                  style={{
                    padding: '16px 18px',
                    textAlign: 'center',
                    borderRight:
                      i < fin.byMethod.length - 1
                        ? `1px solid ${T.divider}`
                        : 'none',
                  }}
                >
                  <Mono size={10} spacing="0.8px" color={T.textMuted}>
                    {label.toUpperCase()}
                  </Mono>
                  <p
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: T.textPrimary,
                      marginTop: 6,
                      marginBottom: 4,
                    }}
                  >
                    {fmtBRL(m.amount)}
                  </p>
                  <span style={{ fontSize: 12, color: T.textMuted }}>
                    {fmtPct(m.share)} · {m.count}x
                  </span>
                </div>
              );
            })}
          </div>
        </Glass>
      )}

      {/* ── Aging Buckets (inadimplência por faixa) ────────────────────── */}
      {fin && kpis && (kpis.overdueAmount.value ?? 0) > 0 && (
        <Glass style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
          <SectionHeader
            icon="alert"
            color={T.danger}
            title="Inadimplência por faixa"
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 0,
            }}
          >
            {([
              { label: 'A vencer', value: fin.agingBuckets.current, color: T.success },
              { label: '0–30 dias', value: fin.agingBuckets.d0_30, color: T.warning },
              { label: '31–60 dias', value: fin.agingBuckets.d31_60, color: T.warning },
              { label: '61–90 dias', value: fin.agingBuckets.d61_90, color: T.danger },
              { label: '90+ dias', value: fin.agingBuckets.d90Plus, color: T.danger },
            ] as const).map((b, i) => (
              <div
                key={b.label}
                style={{
                  padding: '14px 16px',
                  textAlign: 'center',
                  borderRight: i < 4 ? `1px solid ${T.divider}` : 'none',
                }}
              >
                <Mono size={9} spacing="0.8px" color={T.textMuted}>
                  {b.label.toUpperCase()}
                </Mono>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: b.value > 0 ? b.color : T.textMuted,
                    marginTop: 4,
                  }}
                >
                  {b.value > 0 ? fmtBRL(b.value) : '—'}
                </p>
              </div>
            ))}
          </div>
        </Glass>
      )}

      {/* ── Faturas recentes ───────────────────────────────────────────── */}
      {invoicesQ.isError ? (
        <ErrorCard title="Erro ao carregar faturas" onRetry={() => invoicesQ.refetch()} />
      ) : (
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHeader
            icon="creditCard"
            title="Faturas recentes"
            action={
              <button
                onClick={() => router.push('/financeiro/faturas')}
                style={{
                  fontSize: 12,
                  color: T.textLink,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontWeight: 500,
                  padding: '2px 4px',
                }}
              >
                Ver todas →
              </button>
            }
          />

          {invoicesQ.isLoading ? (
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Skeleton width={70} height={13} delay={i * 100} />
                  <Skeleton width="40%" height={13} delay={i * 100 + 40} />
                  <div style={{ flex: 1 }} />
                  <Skeleton width={80} height={13} delay={i * 100 + 80} />
                  <Skeleton width={60} height={20} radius={T.r.pill} delay={i * 100 + 120} />
                </div>
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <EmptyState
              icon="creditCard"
              text="Nenhuma fatura cadastrada"
              action={
                canWrite ? (
                  <Btn small icon="plus" onClick={() => router.push('/financeiro/faturas')}>
                    Criar primeira fatura
                  </Btn>
                ) : undefined
              }
            />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['N°', 'Paciente', 'Valor', 'Pago', 'Emissão', 'Vencimento', 'Status', ''].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: '10px 16px',
                          textAlign: 'left',
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
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => {
                  const status = inv.status as InvoiceStatus;
                  return (
                    <tr
                      key={inv.id}
                      style={{
                        borderBottom: `1px solid ${T.divider}`,
                        background:
                          i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.20)',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        if (inv.patient_id) {
                          router.push(`/pacientes/${inv.patient_id}/prontuario`);
                        }
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <Mono size={10}>{inv.invoice_number}</Mono>
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          fontSize: 13,
                          color: T.textPrimary,
                          fontWeight: 500,
                        }}
                      >
                        {(inv as { patient_name?: string }).patient_name ?? '—'}
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          fontSize: 14,
                          fontWeight: 700,
                          color: T.textPrimary,
                        }}
                      >
                        {fmtBRLFull(inv.total_amount)}
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          fontSize: 13,
                          color:
                            inv.amount_paid >= inv.total_amount
                              ? T.success
                              : T.textSecondary,
                          fontWeight: 500,
                        }}
                      >
                        {fmtBRLFull(inv.amount_paid)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Mono size={10}>{fmtShortDate(inv.issue_date)}</Mono>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Mono size={10}>
                          {inv.due_date ? fmtShortDate(inv.due_date) : '—'}
                        </Mono>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge variant={STATUS_BADGE[status] ?? 'default'}>
                          {INVOICE_STATUS_LABELS[status] ?? status}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Btn
                          variant="ghost"
                          small
                          onClick={(e) => {
                            e.stopPropagation();
                            if (inv.patient_id) {
                              router.push(`/pacientes/${inv.patient_id}/prontuario`);
                            }
                          }}
                        >
                          Paciente
                        </Btn>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Glass>
      )}

      {/* ── Receita por profissional ───────────────────────────────────── */}
      {fin && fin.byProvider.length > 0 && (
        <Glass style={{ padding: 0, overflow: 'hidden', marginTop: 14 }}>
          <SectionHeader icon="user" title="Receita por profissional" />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Profissional', 'Receita', '% do total'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 16px',
                      textAlign: 'left',
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
                const totalRevenue = kpis?.revenue.value || 1;
                const share = p.revenue / totalRevenue;
                return (
                  <tr
                    key={p.providerId}
                    style={{
                      borderBottom: `1px solid ${T.divider}`,
                      background:
                        i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.20)',
                    }}
                  >
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        fontWeight: 500,
                        color: T.textPrimary,
                      }}
                    >
                      {p.providerName}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 14,
                        fontWeight: 700,
                        color: T.textPrimary,
                      }}
                    >
                      {fmtBRL(p.revenue)}
                    </td>
                    <td style={{ padding: '12px 16px', width: '40%' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <Bar
                          pct={Math.round(share * 100)}
                          color={T.financial.color}
                          height={5}
                        />
                        <Mono size={10}>
                          {fmtPct(share)}
                        </Mono>
                      </div>
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
