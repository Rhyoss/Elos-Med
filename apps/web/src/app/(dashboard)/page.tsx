'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Glass, Btn, Stat, Mono, Badge, Ico, Skeleton,
  PageHero, formatHeroDate, T,
  type IcoName, type BadgeVariant, type StatProps,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { usePermission } from '@/lib/auth';
import { useAuthStore } from '@/stores/auth-store';

/* ── Formatters ──────────────────────────────────────────────────────── */

const fmtBRL = (cents: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(cents / 100);

const fmtTime = (d: Date | string | null | undefined) => {
  if (!d) return '--:--';
  return (typeof d === 'string' ? new Date(d) : d).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/* ── Status maps ─────────────────────────────────────────────────────── */

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  checked_in: 'Check-in',
  in_progress: 'Atendendo',
  completed: 'Finalizado',
  no_show: 'Falta',
  cancelled: 'Cancelado',
};

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  scheduled: 'default',
  confirmed: 'default',
  checked_in: 'success',
  in_progress: 'info',
  completed: 'success',
  no_show: 'warning',
  cancelled: 'danger',
};

/* ── SectionCard ─────────────────────────────────────────────────────── */

function SectionCard({
  title,
  icon,
  iconColor,
  isLoading,
  isError,
  onRetry,
  count,
  viewAllHref,
  emptyText,
  emptyIcon,
  emptyPositive,
  isEmpty,
  children,
  style,
}: {
  title: string;
  icon: IcoName;
  iconColor?: string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  count?: number;
  viewAllHref?: string;
  emptyText?: string;
  emptyIcon?: IcoName;
  emptyPositive?: boolean;
  isEmpty?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const color = iconColor ?? T.primary;

  return (
    <Glass style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', ...style }}>
      <div
        style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${T.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: T.r.sm,
              background: `${color}10`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Ico name={icon} size={14} color={color} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{title}</span>
          {count != null && count > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: T.textInverse,
                background: color,
                borderRadius: T.r.pill,
                padding: '1px 8px',
                minWidth: 20,
                textAlign: 'center',
                lineHeight: '18px',
              }}
            >
              {count}
            </span>
          )}
        </div>
        {viewAllHref && (
          <button
            onClick={() => router.push(viewAllHref)}
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
            Ver tudo →
          </button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {isError ? (
          <div style={{ padding: '32px 18px', textAlign: 'center' }}>
            <Ico name="alert" size={22} color={T.danger} />
            <p style={{ fontSize: 13, color: T.textMuted, margin: '10px 0 14px' }}>
              Erro ao carregar
            </p>
            {onRetry && (
              <Btn small variant="ghost" onClick={onRetry}>
                Tentar novamente
              </Btn>
            )}
          </div>
        ) : isLoading ? (
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Skeleton width={32} height={32} radius={T.r.sm} delay={i * 120} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skeleton width="65%" height={13} delay={i * 120 + 40} />
                  <Skeleton width="40%" height={10} delay={i * 120 + 80} />
                </div>
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div
            style={{
              padding: '32px 18px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {emptyIcon && (
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: T.r.md,
                  background: emptyPositive ? T.successBg : T.primaryBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ico name={emptyIcon} size={18} color={emptyPositive ? T.success : T.textMuted} />
              </div>
            )}
            <span style={{ fontSize: 13, color: emptyPositive ? T.success : T.textMuted, lineHeight: 1.5 }}>
              {emptyText ?? 'Nenhum item'}
            </span>
          </div>
        ) : (
          children
        )}
      </div>
    </Glass>
  );
}

/* ── KpiStat ─────────────────────────────────────────────────────────── */

function KpiStat({ href, ...rest }: StatProps & { href: string }) {
  const router = useRouter();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => e.key === 'Enter' && router.push(href)}
      style={{ cursor: 'pointer' }}
    >
      <Stat {...rest} />
    </div>
  );
}

/* ── ApptItem ────────────────────────────────────────────────────────── */

function ApptItem({
  time,
  name,
  detail,
  status,
  action,
  highlight,
  last,
}: {
  time: string;
  name: string;
  detail?: string;
  status?: string;
  action?: { label: string; onClick: () => void };
  highlight?: boolean;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 18px',
        borderBottom: last ? 'none' : `1px solid ${T.divider}`,
        background: highlight ? `${T.warning}08` : 'transparent',
      }}
    >
      <Mono size={11} color={highlight ? T.warning : undefined}>{time}</Mono>
      <div
        style={{
          width: 3,
          height: 32,
          borderRadius: 2,
          background: highlight ? T.warning : T.clinical.color,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: T.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </p>
        {detail && (
          <p style={{ fontSize: 12, color: T.textTertiary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {detail}
          </p>
        )}
      </div>
      {status && (
        <Badge variant={STATUS_VARIANT[status] ?? 'default'} dot={false} style={{ fontSize: 11 }}>
          {STATUS_LABEL[status] ?? status}
        </Badge>
      )}
      {action && (
        <Btn small variant="glass" onClick={action.onClick} style={{ flexShrink: 0 }}>
          {action.label}
        </Btn>
      )}
    </div>
  );
}

/* ── AlertRow ────────────────────────────────────────────────────────── */

function AlertRow({
  icon,
  color,
  text,
  action,
  onAction,
  last,
}: {
  icon: IcoName;
  color: string;
  text: string;
  action?: string;
  onAction?: () => void;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 18px',
        borderBottom: last ? 'none' : `1px solid ${T.divider}`,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: T.r.sm,
          background: `${color}0F`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <Ico name={icon} size={13} color={color} />
      </div>
      <p style={{ flex: 1, fontSize: 13, color: T.textSecondary, lineHeight: 1.5, minWidth: 0 }}>
        {text}
      </p>
      {action && onAction && (
        <Btn small variant="ghost" onClick={onAction} style={{ flexShrink: 0 }}>
          {action}
        </Btn>
      )}
    </div>
  );
}

/* ── Subsection label ────────────────────────────────────────────────── */

function SubLabel({ children, color }: { children: string; color?: string }) {
  return (
    <div style={{ padding: '8px 18px 2px' }}>
      <Mono size={10} spacing="1px" color={color ?? T.textMuted}>{children}</Mono>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Dashboard Page                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const router = useRouter();
  const now = React.useMemo(() => new Date(), []);
  const clinic = useAuthStore((s) => s.clinic);

  const startOfDay = React.useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now]);
  const endOfDay = React.useMemo(() => {
    const d = new Date(now);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [now]);

  const canSupply = usePermission('supply', 'read');
  const canFinancial = usePermission('financial', 'read');
  const canOmni = usePermission('omni', 'read');

  /* ── Queries ─────────────────────────────────────────────────────── */

  const agendaQ = trpc.scheduling.agendaDay.useQuery({ date: startOfDay });
  const waitQ = trpc.scheduling.waitQueue.useQuery();

  const stockQ = trpc.supply.stock.position.useQuery(
    { statuses: ['CRITICO', 'RUPTURA', 'VENCIMENTO_PROXIMO'], page: 1, limit: 50 },
    { enabled: canSupply },
  );
  const revenueQ = trpc.financial.invoices.list.useQuery(
    { status: 'paga', dateFrom: startOfDay, dateTo: endOfDay, page: 1, limit: 100 },
    { enabled: canFinancial },
  );
  const overdueQ = trpc.financial.invoices.list.useQuery(
    { status: 'vencida', page: 1, limit: 10 },
    { enabled: canFinancial },
  );
  const unreadQ = trpc.omni.unreadCount.useQuery(undefined, { enabled: canOmni });
  const convsQ = trpc.omni.listConversations.useQuery(
    { assignment: 'all', limit: 5 },
    { enabled: canOmni },
  );

  /* ── Derived data ────────────────────────────────────────────────── */

  const appts = agendaQ.data?.appointments ?? [];
  const queue = waitQ.data?.queue ?? [];
  const stockAlerts = stockQ.data?.data ?? [];
  const stockTotal = stockQ.data?.total ?? 0;
  const invoicesToday = revenueQ.data?.data ?? [];
  const revenue = invoicesToday.reduce((s: number, inv) => s + (inv.amount_paid ?? 0), 0);
  const overdueInvoices = overdueQ.data?.data ?? [];
  const unread = unreadQ.data?.count ?? 0;
  const convs = convsQ.data?.data ?? [];

  const inProgress = appts.filter((a) => a.status === 'in_progress');
  const upcoming = appts
    .filter(
      (a) =>
        ['scheduled', 'confirmed'].includes(a.status) &&
        new Date(a.scheduledAt).getTime() >= now.getTime(),
    )
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const late = appts.filter(
    (a) =>
      ['scheduled', 'confirmed'].includes(a.status) &&
      new Date(a.scheduledAt).getTime() < now.getTime(),
  );
  const completed = appts.filter((a) => a.status === 'completed');
  const nextAppt = upcoming[0] ?? inProgress[0] ?? null;

  const allergyPatients = appts.filter(
    (a) =>
      a.patient.allergiesCount > 0 &&
      !['completed', 'cancelled', 'no_show'].includes(a.status),
  );

  /* ── Alerts ──────────────────────────────────────────────────────── */

  const alerts: Array<{ icon: IcoName; color: string; text: string; action?: string; href?: string }> = [];

  for (const a of allergyPatients.slice(0, 3)) {
    alerts.push({
      icon: 'shield',
      color: T.danger,
      text: `${a.patient.name}: ${a.patient.allergiesSummary || 'alergias registradas'}`,
      action: 'Ver ficha',
      href: `/pacientes/${a.patientId}/prontuario`,
    });
  }

  for (const s of stockAlerts.slice(0, 3)) {
    const worst = s.statuses.includes('RUPTURA')
      ? 'RUPTURA'
      : s.statuses.includes('CRITICO')
        ? 'CRITICO'
        : 'VENCIMENTO_PROXIMO';
    const label = worst === 'RUPTURA' ? 'em ruptura' : worst === 'CRITICO' ? 'crítico' : 'vencendo';
    alerts.push({
      icon: 'box',
      color: worst === 'VENCIMENTO_PROXIMO' ? T.warning : T.danger,
      text: `Estoque ${label}: ${s.name}`,
      action: 'Ver estoque',
      href: '/suprimentos',
    });
  }

  for (const inv of overdueInvoices.slice(0, 2)) {
    alerts.push({
      icon: 'creditCard',
      color: T.danger,
      text: `Fatura #${inv.invoice_number} vencida — ${fmtBRL(inv.amount_due)}`,
      action: 'Ver fatura',
      href: '/financeiro',
    });
  }

  const alertsLoading =
    agendaQ.isLoading ||
    (canSupply && stockQ.isLoading) ||
    (canFinancial && overdueQ.isLoading);

  /* ── Agora: empty check ──────────────────────────────────────────── */

  const agoraEmpty =
    inProgress.length === 0 &&
    queue.length === 0 &&
    upcoming.length === 0 &&
    late.length === 0;

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '24px 28px' }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <PageHero
        eyebrow={
          clinic?.name
            ? `${formatHeroDate(now)} · ${clinic.name.toUpperCase()}`
            : formatHeroDate(now)
        }
        title="Dashboard"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {nextAppt && (
              <Btn
                small
                variant="primary"
                icon="activity"
                onClick={() => router.push(`/pacientes/${nextAppt.patientId}/prontuario`)}
              >
                Próximo atendimento
              </Btn>
            )}
            <Btn small variant="glass" icon="calendar" onClick={() => router.push('/agenda')}>
              Agenda de hoje
            </Btn>
          </div>
        }
      />

      {/* ── KPI Row ────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))',
          gap: 10,
          marginBottom: 20,
        }}
      >
        <KpiStat
          label="Consultas"
          value={agendaQ.isLoading ? '…' : appts.length.toString()}
          sub={`${completed.length} finalizada${completed.length !== 1 ? 's' : ''}`}
          icon="calendar"
          mod="clinical"
          href="/agenda"
        />
        <KpiStat
          label="Aguardando"
          value={waitQ.isLoading ? '…' : queue.length.toString()}
          sub={
            queue.length > 0
              ? `${queue[0]?.waitingMinutes ?? 0} min o mais antigo`
              : 'Fila vazia'
          }
          icon="clock"
          mod="clinical"
          href="/agenda"
        />
        <KpiStat
          label="Atrasos"
          value={agendaQ.isLoading ? '…' : late.length.toString()}
          sub={late.length > 0 ? 'pacientes atrasados' : 'Nenhum atraso'}
          icon="alert"
          mod={late.length > 0 ? 'accentMod' : 'clinical'}
          href="/agenda"
        />
        {/* TODO: backend não expõe endpoint para pendências clínicas
            (rascunhos, prescrições não enviadas, docs sem assinatura)
            em nível de clínica. KPI desabilitado. */}
        <KpiStat
          label="Pendências"
          value="—"
          sub="em breve"
          icon="edit"
          mod="clinical"
          href="/prescricoes"
        />
        {canSupply && (
          <KpiStat
            label="Estoque"
            value={stockQ.isLoading ? '…' : stockTotal > 0 ? stockTotal.toString() : 'OK'}
            sub={
              stockTotal > 0
                ? `alerta${stockTotal !== 1 ? 's' : ''} ativo${stockTotal !== 1 ? 's' : ''}`
                : 'Sem riscos'
            }
            icon="box"
            mod="supply"
            href="/suprimentos"
          />
        )}
        {canFinancial && (
          <KpiStat
            label="Receita"
            value={revenueQ.isLoading ? '…' : fmtBRL(revenue)}
            sub={`${invoicesToday.length} fatura${invoicesToday.length !== 1 ? 's' : ''} paga${invoicesToday.length !== 1 ? 's' : ''}`}
            icon="creditCard"
            mod="financial"
            href="/financeiro"
          />
        )}
      </div>

      {/* ── Three Columns ──────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 14,
          marginBottom: 14,
          alignItems: 'start',
        }}
      >
        {/* ─ AGORA ─────────────────────────────────────────────────── */}
        <SectionCard
          title="Agora"
          icon="activity"
          iconColor={T.clinical.color}
          isLoading={agendaQ.isLoading || waitQ.isLoading}
          isError={agendaQ.isError && waitQ.isError}
          onRetry={() => {
            void agendaQ.refetch();
            void waitQ.refetch();
          }}
          count={inProgress.length + queue.length}
          viewAllHref="/agenda"
          isEmpty={agoraEmpty}
          emptyText="Nenhum paciente aguardando ou em atendimento"
          emptyIcon="check"
          emptyPositive
        >
          {inProgress.map((a, i) => (
            <ApptItem
              key={a.id}
              time={fmtTime(a.scheduledAt)}
              name={a.patient.name}
              detail={a.service?.name ?? a.provider.name}
              status={a.status}
              action={{
                label: 'Abrir',
                onClick: () => router.push(`/pacientes/${a.patientId}/prontuario`),
              }}
              last={i === inProgress.length - 1 && queue.length === 0 && upcoming.length === 0 && late.length === 0}
            />
          ))}

          {inProgress.length > 0 && queue.length > 0 && <SubLabel>FILA DE ESPERA</SubLabel>}

          {queue.map((q, i) => (
            <ApptItem
              key={q.appointmentId}
              time={`${q.waitingMinutes} min`}
              name={q.patientName}
              detail={q.serviceName ?? q.providerName}
              status="checked_in"
              highlight={q.waitingMinutes > 30}
              action={{
                label: 'Chamar',
                onClick: () => router.push(`/pacientes/${q.patientId}/prontuario`),
              }}
              last={i === queue.length - 1 && upcoming.length === 0 && late.length === 0}
            />
          ))}

          {upcoming.length > 0 && (inProgress.length > 0 || queue.length > 0) && (
            <SubLabel>PRÓXIMOS</SubLabel>
          )}
          {upcoming.slice(0, 4).map((a, i) => (
            <ApptItem
              key={a.id}
              time={fmtTime(a.scheduledAt)}
              name={a.patient.name}
              detail={a.service?.name ?? a.provider.name}
              status={a.status}
              last={i === Math.min(upcoming.length, 4) - 1 && late.length === 0}
            />
          ))}

          {late.length > 0 && <SubLabel color={T.warning}>ATRASADOS</SubLabel>}
          {late.slice(0, 3).map((a, i) => (
            <ApptItem
              key={a.id}
              time={fmtTime(a.scheduledAt)}
              name={a.patient.name}
              detail={a.service?.name ?? a.provider.name}
              status={a.status}
              highlight
              action={{
                label: 'Contatar',
                onClick: () => router.push(`/pacientes/${a.patientId}/prontuario`),
              }}
              last={i === Math.min(late.length, 3) - 1}
            />
          ))}
        </SectionCard>

        {/* ─ PENDÊNCIAS ────────────────────────────────────────────── */}
        {/* TODO: backend não expõe endpoints para pendências clínicas
            em nível de clínica (evoluções em rascunho, prescrições não
            enviadas, documentos sem assinatura, retornos a agendar,
            imagens sem consentimento). UI preparada — ativar quando os
            endpoints estiverem disponíveis. */}
        <SectionCard
          title="Pendências"
          icon="edit"
          iconColor={T.clinical.color}
          isLoading={false}
          isEmpty
          emptyText="Nenhuma pendência crítica hoje"
          emptyIcon="check"
          emptyPositive
          viewAllHref="/prescricoes"
        />

        {/* ─ ALERTAS ───────────────────────────────────────────────── */}
        <SectionCard
          title="Alertas"
          icon="alert"
          iconColor={alerts.length > 0 ? T.danger : T.success}
          isLoading={alertsLoading as boolean}
          isError={false}
          count={alerts.length}
          isEmpty={!alertsLoading && alerts.length === 0}
          emptyText="Nenhum alerta crítico hoje"
          emptyIcon="check"
          emptyPositive
        >
          {alerts.map((a, i) => (
            <AlertRow
              key={i}
              icon={a.icon}
              color={a.color}
              text={a.text}
              action={a.action}
              onAction={a.href ? () => router.push(a.href!) : undefined}
              last={i === alerts.length - 1}
            />
          ))}
        </SectionCard>
      </div>

      {/* ── Comunicações Recentes ──────────────────────────────────── */}
      {canOmni && (
        <SectionCard
          title="Comunicações Recentes"
          icon="message"
          iconColor={T.aiMod.color}
          isLoading={convsQ.isLoading}
          isError={convsQ.isError}
          onRetry={() => convsQ.refetch()}
          count={unread}
          viewAllHref="/comunicacoes"
          isEmpty={convs.length === 0}
          emptyText="Nenhuma conversa recente"
          emptyIcon="message"
        >
          {convs.slice(0, 5).map((c, i) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/comunicacoes?id=${c.id}`)}
              onKeyDown={(e) => e.key === 'Enter' && router.push(`/comunicacoes?id=${c.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 18px',
                borderBottom: i === convs.length - 1 ? 'none' : `1px solid ${T.divider}`,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = T.primaryBg;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'transparent';
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: T.r.md,
                  background: T.aiMod.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Ico name="message" size={16} color={T.aiMod.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                    {c.contactName ?? 'Contato sem nome'}
                  </span>
                  <Mono size={10}>{fmtTime(c.lastMessageAt)}</Mono>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Badge variant="default" dot={false} style={{ fontSize: 10, padding: '1px 6px' }}>
                    {c.channelType}
                  </Badge>
                  <span
                    style={{
                      fontSize: 13,
                      color: T.textMuted,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flex: 1,
                    }}
                  >
                    {c.lastMessagePreview ?? '—'}
                  </span>
                </div>
              </div>
              <Ico name="arrowRight" size={14} color={T.textMuted} />
            </div>
          ))}
        </SectionCard>
      )}
    </div>
  );
}
