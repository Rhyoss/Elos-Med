'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData } from '@tanstack/react-query';
import {
  Glass,
  Btn,
  Stat,
  Mono,
  Badge,
  Ico,
  PageHero,
  Skeleton,
  T,
  type IcoName,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { usePermission } from '@/lib/auth';
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_LABELS,
  type InvoiceStatus,
} from '@dermaos/shared';
import { NewInvoiceModal } from '../_components/new-invoice-modal';
import { InvoiceDetailDrawer } from '../_components/invoice-detail-drawer';
import {
  fmtBRL,
  fmtBRLFull,
  fmtShortDate,
  isoMonthStart,
  isoNDaysAgo,
  isoToday,
  STATUS_BADGE,
  monthLabel,
} from '../_lib/format';

const PAGE_SIZE = 20;

interface DateRange {
  label: string;
  from?: string;
  to?:   string;
}

const DATE_PRESETS: DateRange[] = [
  { label: 'Mês atual', from: isoMonthStart() },
  { label: 'Últimos 7 dias',  from: isoNDaysAgo(7),  to: isoToday() },
  { label: 'Últimos 30 dias', from: isoNDaysAgo(30), to: isoToday() },
  { label: 'Últimos 90 dias', from: isoNDaysAgo(90), to: isoToday() },
  { label: 'Tudo' },
];

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  paddingLeft: 32,
  borderRadius: T.r.md,
  background: T.inputBg,
  border: `1px solid ${T.inputBorder}`,
  fontSize: 13,
  color: T.textPrimary,
  fontFamily: "'IBM Plex Sans', sans-serif",
  outline: 'none',
  width: '100%',
};

export default function FaturasPage() {
  const router = useRouter();
  const params = useSearchParams();
  const canRead   = usePermission('financial', 'read');
  const canWrite  = usePermission('financial', 'write');
  const canExport = usePermission('analytics', 'export');

  const [search, setSearch]                 = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [status, setStatus]                 = React.useState<InvoiceStatus | ''>('');
  const [dateRange, setDateRange]           = React.useState<DateRange>(DATE_PRESETS[0]!);
  const [page, setPage]                     = React.useState(1);
  const [showNewInvoice, setShowNewInvoice] = React.useState(
    params.get('novo') === '1',
  );
  const [selectedInvoiceId, setSelectedInvoiceId] = React.useState<string | null>(
    params.get('fatura'),
  );

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(1);
  }, [status, dateRange]);

  const listQ = trpc.financial.invoices.list.useQuery(
    {
      search: debouncedSearch || undefined,
      status: status || undefined,
      dateFrom: dateRange.from ? new Date(dateRange.from) : undefined,
      dateTo:   dateRange.to   ? new Date(dateRange.to)   : undefined,
      page,
      limit: PAGE_SIZE,
    },
    { enabled: canRead, placeholderData: keepPreviousData, staleTime: 15_000 },
  );

  const today = React.useMemo(() => isoToday(), []);
  const monthStart = React.useMemo(() => isoMonthStart(), []);

  const monthFinQ = trpc.analytics.financial.useQuery(
    { start: monthStart, end: today },
    { enabled: canRead, staleTime: 60_000 },
  );

  // Status counts (simple parallel fetches per status — small N)
  const overdueQ = trpc.financial.invoices.list.useQuery(
    { status: 'vencida', page: 1, limit: 1 },
    { enabled: canRead, staleTime: 60_000 },
  );
  const draftQ = trpc.financial.invoices.list.useQuery(
    { status: 'rascunho', page: 1, limit: 1 },
    { enabled: canRead, staleTime: 60_000 },
  );
  const openQ = trpc.financial.invoices.list.useQuery(
    { status: 'emitida', page: 1, limit: 1 },
    { enabled: canRead, staleTime: 60_000 },
  );

  if (!canRead) return <NoAccess />;

  const data       = listQ.data;
  const invoices   = data?.data ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fin        = monthFinQ.data;

  const hasFilters = !!(debouncedSearch || status || dateRange.from);

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '22px 26px' }}>
      <PageHero
        eyebrow="FATURAMENTO"
        title="Faturas & Cobranças"
        module="financial"
        icon="creditCard"
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
              <Btn variant="glass" small icon="download" onClick={() => exportCsv(invoices)}>
                Exportar CSV
              </Btn>
            )}
            {canWrite && (
              <Btn small icon="plus" onClick={() => setShowNewInvoice(true)}>
                Nova fatura
              </Btn>
            )}
          </div>
        }
      />

      {/* ─── KPIs do mês ──────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
          gap: 10,
          marginBottom: 20,
        }}
      >
        <Stat
          label={`Receita ${monthLabel().toLowerCase()}`}
          value={
            monthFinQ.isLoading
              ? '…'
              : fin?.kpis.revenue.value != null
                ? fmtBRL(fin.kpis.revenue.value)
                : '—'
          }
          sub={
            fin?.kpis.revenue.trendPct != null
              ? `${fin.kpis.revenue.trendPct >= 0 ? '+' : ''}${fin.kpis.revenue.trendPct.toFixed(0)}% vs mês anterior`
              : 'Pago, líquido de estornos'
          }
          icon="barChart"
          mod="financial"
        />
        <Stat
          label="Em aberto"
          value={
            openQ.isLoading ? '…' : String((openQ.data?.total ?? 0) + (overdueQ.data?.total ?? 0))
          }
          sub={`${overdueQ.data?.total ?? 0} vencida${(overdueQ.data?.total ?? 0) !== 1 ? 's' : ''}`}
          icon="clock"
          mod={(overdueQ.data?.total ?? 0) > 0 ? 'accentMod' : 'financial'}
        />
        <Stat
          label="Inadimplência"
          value={
            monthFinQ.isLoading
              ? '…'
              : fin?.kpis.overdueAmount.value != null
                ? fmtBRL(fin.kpis.overdueAmount.value)
                : '—'
          }
          sub="Total vencido em aberto"
          icon="alert"
          mod={
            fin && (fin.kpis.overdueAmount.value ?? 0) > 0 ? 'accentMod' : 'financial'
          }
        />
        <Stat
          label="Rascunhos"
          value={draftQ.isLoading ? '…' : String(draftQ.data?.total ?? 0)}
          sub="Aguardando emissão"
          icon="edit"
          mod="financial"
        />
      </div>

      {/* ─── Filtros ─────────────────────────────────────────────────── */}
      <Glass style={{ padding: '14px 18px', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 220 }}>
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: 11,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                display: 'flex',
              }}
            >
              <Ico name="search" size={13} color={T.textMuted} />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número, paciente…"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <FilterChip
              label="Todas"
              active={!status}
              onClick={() => setStatus('')}
            />
            {INVOICE_STATUSES.map((s) => (
              <FilterChip
                key={s}
                label={INVOICE_STATUS_LABELS[s]}
                active={status === s}
                tone={
                  s === 'paga' ? 'success'
                    : s === 'vencida' || s === 'cancelada' ? 'danger'
                    : s === 'parcial' ? 'warning'
                    : s === 'emitida' ? 'info'
                    : 'default'
                }
                onClick={() => setStatus(status === s ? '' : s)}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {DATE_PRESETS.map((preset) => (
              <FilterChip
                key={preset.label}
                label={preset.label}
                icon="calendar"
                active={dateRange.label === preset.label}
                onClick={() => setDateRange(preset)}
              />
            ))}
          </div>
        </div>

        {hasFilters && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingTop: 10,
              marginTop: 10,
              borderTop: `1px solid ${T.divider}`,
            }}
          >
            <Mono size={10} color={T.textMuted}>
              {total} resultado{total !== 1 ? 's' : ''}
            </Mono>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatus('');
                setDateRange(DATE_PRESETS[0]!);
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 12,
                color: T.textLink,
                cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              Limpar filtros
            </button>
          </div>
        )}
      </Glass>

      {/* ─── Tabela ──────────────────────────────────────────────────── */}
      <Glass style={{ padding: 0, overflow: 'hidden' }}>
        {listQ.isLoading ? (
          <div style={{ padding: '20px' }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{ display: 'flex', gap: 10, padding: '10px 0' }}
              >
                <Skeleton width={70} height={14} delay={i * 60} />
                <Skeleton width="30%" height={14} delay={i * 60 + 30} />
                <div style={{ flex: 1 }} />
                <Skeleton width={80} height={14} delay={i * 60 + 60} />
                <Skeleton width={70} height={20} radius={T.r.pill} delay={i * 60 + 80} />
              </div>
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: '60px 22px', textAlign: 'center' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: T.r.lg,
                background: T.financial.bg,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <Ico name="creditCard" size={26} color={T.financial.color} />
            </div>
            <p
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: T.textPrimary,
                marginBottom: 6,
              }}
            >
              {hasFilters ? 'Nenhuma fatura para esses filtros' : 'Nenhuma fatura ainda'}
            </p>
            <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 18 }}>
              {hasFilters
                ? 'Limpe os filtros para ver outras faturas.'
                : 'Crie sua primeira fatura para iniciar o faturamento.'}
            </p>
            {canWrite && !hasFilters && (
              <Btn small icon="plus" onClick={() => setShowNewInvoice(true)}>
                Criar primeira fatura
              </Btn>
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  'N°',
                  'Paciente',
                  'Emissão',
                  'Vencimento',
                  'Total',
                  'Pago',
                  'Saldo',
                  'Status',
                ].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: '11px 14px',
                      textAlign: i >= 4 ? 'right' : 'left',
                      fontSize: 10,
                      fontFamily: "'IBM Plex Mono', monospace",
                      letterSpacing: '1px',
                      color: T.textMuted,
                      fontWeight: 500,
                      borderBottom: `1px solid ${T.divider}`,
                      background: T.metalGrad,
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => {
                const s = inv.status as InvoiceStatus;
                const balance = Math.max(0, inv.total_amount - inv.amount_paid);
                const isOverdue =
                  s === 'vencida' ||
                  (inv.due_date &&
                    new Date(inv.due_date) < new Date() &&
                    s === 'emitida');
                return (
                  <tr
                    key={inv.id}
                    onClick={() => setSelectedInvoiceId(inv.id)}
                    style={{
                      borderBottom: `1px solid ${T.divider}`,
                      background:
                        i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.18)',
                      cursor: 'pointer',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = T.financial.bg;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.18)';
                    }}
                  >
                    <td style={{ padding: '12px 14px' }}>
                      <Mono size={11}>{inv.invoice_number}</Mono>
                    </td>
                    <td
                      style={{
                        padding: '12px 14px',
                        fontSize: 13,
                        color: T.textPrimary,
                        fontWeight: 500,
                        maxWidth: 240,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {inv.patient_name ?? '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <Mono size={10}>{fmtShortDate(inv.issue_date)}</Mono>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <Mono
                        size={10}
                        color={isOverdue ? T.danger : undefined}
                      >
                        {fmtShortDate(inv.due_date)}
                      </Mono>
                    </td>
                    <td
                      style={{
                        padding: '12px 14px',
                        fontSize: 13,
                        fontWeight: 700,
                        color: T.textPrimary,
                        textAlign: 'right',
                      }}
                    >
                      {fmtBRLFull(inv.total_amount)}
                    </td>
                    <td
                      style={{
                        padding: '12px 14px',
                        fontSize: 13,
                        color: inv.amount_paid > 0 ? T.success : T.textMuted,
                        fontWeight: 500,
                        textAlign: 'right',
                      }}
                    >
                      {fmtBRLFull(inv.amount_paid)}
                    </td>
                    <td
                      style={{
                        padding: '12px 14px',
                        fontSize: 13,
                        fontWeight: 600,
                        color:
                          balance > 0 && isOverdue
                            ? T.danger
                            : balance > 0
                              ? T.warning
                              : T.textMuted,
                        textAlign: 'right',
                      }}
                    >
                      {fmtBRLFull(balance)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <Badge variant={STATUS_BADGE[s]}>
                        {INVOICE_STATUS_LABELS[s]}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderTop: `1px solid ${T.divider}`,
              background: T.metalGrad,
            }}
          >
            <Mono size={10} color={T.textMuted}>
              Página {page} de {totalPages} · {total} faturas
            </Mono>
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn
                variant="ghost"
                small
                icon="arrowLeft"
                disabled={page <= 1 || listQ.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Btn>
              <Btn
                variant="ghost"
                small
                disabled={page >= totalPages || listQ.isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </Btn>
            </div>
          </div>
        )}
      </Glass>

      <NewInvoiceModal
        open={showNewInvoice}
        onClose={() => setShowNewInvoice(false)}
        onCreated={(id) => {
          setShowNewInvoice(false);
          setSelectedInvoiceId(id);
        }}
      />

      <InvoiceDetailDrawer
        open={!!selectedInvoiceId}
        invoiceId={selectedInvoiceId}
        canWrite={canWrite}
        onClose={() => setSelectedInvoiceId(null)}
      />
    </div>
  );
}

function FilterChip({
  label,
  icon,
  active,
  tone = 'default',
  onClick,
}: {
  label: string;
  icon?: IcoName;
  active: boolean;
  tone?: 'default' | 'success' | 'danger' | 'warning' | 'info';
  onClick: () => void;
}) {
  const colors = (() => {
    if (!active) return { bg: 'white', border: T.divider, color: T.textSecondary };
    switch (tone) {
      case 'success': return { bg: T.successBg, border: T.successBorder, color: T.success };
      case 'danger':  return { bg: T.dangerBg,  border: T.dangerBorder,  color: T.danger  };
      case 'warning': return { bg: T.warningBg, border: T.warningBorder, color: T.warning };
      case 'info':    return { bg: T.infoBg,    border: T.infoBorder,    color: T.info    };
      default:        return { bg: T.financial.bg, border: T.financial.border, color: T.financial.color };
    }
  })();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 12px',
        borderRadius: T.r.pill,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.color,
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        fontFamily: "'IBM Plex Sans', sans-serif",
        cursor: 'pointer',
        transition: 'all 0.12s',
      }}
    >
      {icon && <Ico name={icon} size={11} color={colors.color} />}
      {label}
    </button>
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
        Você não tem permissão para visualizar faturas. Contate o administrador.
      </p>
    </div>
  );
}

interface InvoiceListItem {
  invoice_number: string;
  patient_name:   string | null;
  issue_date:     string;
  due_date:       string | null;
  total_amount:   number;
  amount_paid:    number;
  status:         string;
}

function exportCsv(rows: InvoiceListItem[]): void {
  const header = ['Numero', 'Paciente', 'Emissao', 'Vencimento', 'Total', 'Pago', 'Saldo', 'Status'];
  const lines = rows.map((r) => [
    r.invoice_number,
    (r.patient_name ?? '').replace(/[",\n]/g, ' '),
    r.issue_date,
    r.due_date ?? '',
    (r.total_amount / 100).toFixed(2).replace('.', ','),
    (r.amount_paid / 100).toFixed(2).replace('.', ','),
    ((r.total_amount - r.amount_paid) / 100).toFixed(2).replace('.', ','),
    r.status,
  ]);
  const csv = [header, ...lines].map((row) => row.map((c) => `"${c}"`).join(';')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `faturas-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
