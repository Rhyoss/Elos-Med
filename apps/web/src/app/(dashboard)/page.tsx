'use client';

import * as React from 'react';
import {
  Glass, Btn, Stat, Mono, Badge, Ico,
  PageHero, formatHeroDate, T,
} from '@dermaos/ui/ds';
import { trpc } from '../../lib/trpc-provider';

/**
 * Dashboard — visão geral da clínica em tempo real.
 *
 * Stats (4 KPIs):
 *  - Consultas hoje (scheduling.agendaDay) + fila (scheduling.waitQueue)
 *  - Receita do dia (financial.invoices.list, status=paga, dateFrom=today)
 *  - Comunicações (omni.unreadCount)
 *  - Estoque (supply.stock.position com statuses críticos)
 *
 * Painéis: agenda do dia, alertas críticos (estoque + faturas vencidas),
 * comunicações recentes (omni.listConversations).
 */
const formatBRL = (cents: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(cents / 100);

const formatTime = (date: Date | string | null | undefined): string => {
  if (!date) return '--:--';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const STATUS_TO_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  scheduled:    'default',
  confirmed:    'success',
  checked_in:   'success',
  in_progress:  'success',
  completed:    'success',
  no_show:      'warning',
  cancelled:    'danger',
};

const STATUS_LABEL: Record<string, string> = {
  scheduled:    'Agendado',
  confirmed:    'Confirmado',
  checked_in:   'Check-in',
  in_progress:  'Em atendimento',
  completed:    'Finalizado',
  no_show:      'Falta',
  cancelled:    'Cancelado',
};

export default function DashboardPage() {
  const today = React.useMemo(() => new Date(), []);
  const startOfDay = React.useMemo(() => {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [today]);
  const endOfDay = React.useMemo(() => {
    const d = new Date(today);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [today]);

  const agendaQ      = trpc.scheduling.agendaDay.useQuery({ date: startOfDay });
  const waitQueueQ   = trpc.scheduling.waitQueue.useQuery();
  const unreadQ      = trpc.omni.unreadCount.useQuery();
  const conversationsQ = trpc.omni.listConversations.useQuery({ assignment: 'all', limit: 5 });
  const stockAlertsQ = trpc.supply.stock.position.useQuery({
    statuses: ['CRITICO', 'RUPTURA', 'VENCIMENTO_PROXIMO'],
    page: 1,
    limit: 50,
  });
  const todayInvoicesQ = trpc.financial.invoices.list.useQuery({
    status:   'paga',
    dateFrom: startOfDay,
    dateTo:   endOfDay,
    page:     1,
    limit:    100,
  });
  const overdueInvoicesQ = trpc.financial.invoices.list.useQuery({
    status: 'vencida',
    page:   1,
    limit:  10,
  });

  const appts        = agendaQ.data?.appointments ?? [];
  const waitQueue    = waitQueueQ.data?.queue ?? [];
  const unread       = unreadQ.data?.count ?? 0;
  const conversations = conversationsQ.data?.data ?? [];
  const stockAlerts  = stockAlertsQ.data?.data ?? [];
  const stockTotal   = stockAlertsQ.data?.total ?? 0;
  const todayInvoices = todayInvoicesQ.data?.data ?? [];
  const overdueInvoices = overdueInvoicesQ.data?.data ?? [];

  const revenueToday = todayInvoices.reduce((sum, inv) => sum + (inv.amount_paid ?? 0), 0);

  const stats = [
    {
      label: 'Consultas',
      value: appts.length.toString(),
      sub:   waitQueue.length > 0 ? `${waitQueue.length} em espera` : 'Nenhum em espera',
      icon:  'calendar' as const,
      mod:   'clinical' as const,
      pct:   Math.min(100, appts.length * 10),
    },
    {
      label: 'Receita',
      value: formatBRL(revenueToday),
      sub:   `${todayInvoices.length} fatura${todayInvoices.length === 1 ? '' : 's'}`,
      icon:  'creditCard' as const,
      mod:   'financial' as const,
      pct:   Math.min(100, Math.round(revenueToday / 100)),
    },
    {
      label: 'Comunicações',
      value: unread.toString(),
      sub:   unread > 0 ? 'não lidas' : 'tudo respondido',
      icon:  'message' as const,
      mod:   'aiMod' as const,
      pct:   Math.min(100, unread * 10),
    },
    {
      label: 'Estoque',
      value: stockTotal > 0 ? `${stockTotal} alerta${stockTotal === 1 ? '' : 's'}` : 'OK',
      sub:   stockTotal > 0 ? 'FEFO + ruptura' : 'sem riscos',
      icon:  'box' as const,
      mod:   'supply' as const,
      pct:   stockTotal > 0 ? Math.min(100, stockTotal * 8) : 100,
    },
  ];

  const criticalAlerts: Array<{ msg: string; color: string; icon: 'alert' | 'creditCard' }> = [
    ...stockAlerts.slice(0, 3).map((s) => {
      const worst = s.statuses.includes('RUPTURA')
        ? 'RUPTURA'
        : s.statuses.includes('CRITICO')
        ? 'CRITICO'
        : 'VENCIMENTO_PROXIMO';
      const label =
        worst === 'RUPTURA' ? 'em ruptura' :
        worst === 'CRITICO' ? 'crítico' : 'vencendo';
      return {
        msg:   `Estoque ${label}: ${s.name}`,
        color: worst === 'VENCIMENTO_PROXIMO' ? T.warning : T.danger,
        icon:  'alert' as const,
      };
    }),
    ...overdueInvoices.slice(0, 2).map((inv) => ({
      msg:   `Fatura #${inv.invoice_number} vencida — ${formatBRL(inv.amount_due)}`,
      color: T.danger,
      icon:  'creditCard' as const,
    })),
  ].slice(0, 5);

  const isLoading =
    agendaQ.isLoading ||
    waitQueueQ.isLoading ||
    unreadQ.isLoading ||
    stockAlertsQ.isLoading ||
    todayInvoicesQ.isLoading;

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '22px 26px' }}>
      <PageHero
        eyebrow={formatHeroDate(today)}
        title="Dashboard"
        actions={<Btn small icon="activity">Relatório</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 18 }}>
        {stats.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        {/* Agenda de Hoje */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Ico name="calendar" size={14} color={T.clinical.color} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Agenda de Hoje</span>
          </div>
          {isLoading && appts.length === 0 ? (
            <EmptyRow text="Carregando…" />
          ) : appts.length === 0 ? (
            <EmptyRow text="Nenhum agendamento para hoje" />
          ) : (
            appts.slice(0, 4).map((a, i) => {
              const variant = STATUS_TO_VARIANT[a.status] ?? 'default';
              const statusLabel = STATUS_LABEL[a.status] ?? a.status;
              const last = i === Math.min(appts.length, 4) - 1;
              return (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 16px',
                    borderBottom: last ? 'none' : `1px solid ${T.divider}`,
                  }}
                >
                  <Mono size={9}>{formatTime(a.scheduledAt)}</Mono>
                  <div style={{ width: 3, height: 28, borderRadius: 2, background: T.clinical.color }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.patient.name}
                    </p>
                    <p style={{ fontSize: 10, color: T.textTertiary }}>
                      {a.service?.name ?? a.provider.name}
                    </p>
                  </div>
                  <Badge variant={variant} dot={false}>{statusLabel}</Badge>
                </div>
              );
            })
          )}
        </Glass>

        {/* Alertas Críticos */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Ico name="alert" size={14} color={T.danger} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Alertas Críticos</span>
          </div>
          {isLoading && criticalAlerts.length === 0 ? (
            <EmptyRow text="Carregando…" />
          ) : criticalAlerts.length === 0 ? (
            <EmptyRow text="Nenhum alerta no momento" />
          ) : (
            criticalAlerts.map((a, i) => {
              const last = i === criticalAlerts.length - 1;
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 9,
                    padding: '10px 16px',
                    borderBottom: last ? 'none' : `1px solid ${T.divider}`,
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: T.r.sm,
                      background: `${a.color}0F`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Ico name={a.icon} size={13} color={a.color} />
                  </div>
                  <p style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.5 }}>{a.msg}</p>
                </div>
              );
            })
          )}
        </Glass>

        {/* Comunicações */}
        <Glass style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Ico name="message" size={14} color={T.aiMod.color} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Comunicações</span>
          </div>
          {conversationsQ.isLoading && conversations.length === 0 ? (
            <EmptyRow text="Carregando…" />
          ) : conversations.length === 0 ? (
            <EmptyRow text="Nenhuma conversa recente" />
          ) : (
            conversations.slice(0, 4).map((c, i) => {
              const last = i === Math.min(conversations.length, 4) - 1;
              return (
                <div
                  key={c.id}
                  style={{
                    padding: '10px 16px',
                    borderBottom: last ? 'none' : `1px solid ${T.divider}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>
                      {c.contactName ?? 'Contato sem nome'}
                    </span>
                    <Mono size={8}>{formatTime(c.lastMessageAt)}</Mono>
                  </div>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: 8,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: T.primaryBg,
                        color: T.primary,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      {c.channelType}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: T.textMuted,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {c.lastMessagePreview ?? '—'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </Glass>
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div style={{ padding: '24px 16px', textAlign: 'center', color: T.textMuted, fontSize: 11 }}>
      {text}
    </div>
  );
}
