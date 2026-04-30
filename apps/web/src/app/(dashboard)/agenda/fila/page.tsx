'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, useToast } from '@dermaos/ui';
import {
  Btn, Glass, Mono, Badge, Ico, EmptyState,
  PageHero, formatHeroDate, T,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { useRealtime } from '@/hooks/use-realtime';

/* ── Glassmorphism context menu ──────────────────────────────────────── */

interface ActionMenuProps {
  appointmentId: string;
  patientId: string;
  patientName: string;
  status: string;
  anchorRect: { top: number; left: number; width: number };
  onClose: () => void;
  onStart: () => void;
  onComplete: () => void;
  onNoShow: () => void;
  onCancel: () => void;
}

function ActionMenu({
  patientId,
  patientName,
  status,
  anchorRect,
  onClose,
  onStart,
  onComplete,
  onNoShow,
  onCancel,
}: ActionMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const isInProgress = status === 'in_progress';

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const menuTop = anchorRect.top + 40;
  const menuRight = window.innerWidth - anchorRect.left - anchorRect.width;

  const actions = [
    ...(isInProgress
      ? [
          { label: 'Continuar atendimento', icon: 'arrowRight' as const, onClick: () => { window.location.href = `/pacientes/${patientId}/prontuario`; }, variant: 'primary' as const },
          { label: 'Concluir atendimento', icon: 'check' as const, onClick: onComplete, variant: 'success' as const },
        ]
      : [
          { label: 'Iniciar atendimento', icon: 'zap' as const, onClick: onStart, variant: 'primary' as const },
        ]),
    { label: 'Ver prontuário', icon: 'eye' as const, onClick: () => { window.location.href = `/pacientes/${patientId}/prontuario`; }, variant: 'default' as const },
    { label: 'Agendar retorno', icon: 'calendar' as const, onClick: () => { window.location.href = `/agenda?paciente=${patientId}&novo=1`; }, variant: 'default' as const },
    { type: 'divider' as const },
    { label: 'Marcar falta', icon: 'x' as const, onClick: onNoShow, variant: 'warning' as const },
    { label: 'Cancelar', icon: 'x' as const, onClick: onCancel, variant: 'danger' as const },
  ] as const;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Ações para ${patientName}`}
      style={{
        position: 'fixed',
        top: menuTop,
        right: Math.max(16, menuRight),
        zIndex: 500,
        minWidth: 220,
        background: T.glass,
        backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
        WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
        border: `1px solid ${T.glassBorder}`,
        borderRadius: T.r.lg,
        boxShadow: '0 24px 56px rgba(0,0,0,0.14), 0 6px 14px rgba(0,0,0,0.06)',
        padding: '6px 0',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '44%',
          background: T.metalHighlight,
          borderRadius: `${T.r.lg}px ${T.r.lg}px 0 0`,
          pointerEvents: 'none',
          opacity: 0.18,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ padding: '8px 14px 6px', borderBottom: `1px solid ${T.divider}` }}>
          <Mono size={10} color={T.textMuted}>{patientName.toUpperCase()}</Mono>
        </div>
        {actions.map((action, i) => {
          if ('type' in action && action.type === 'divider') {
            return <div key={i} style={{ height: 1, background: T.divider, margin: '4px 0' }} />;
          }
          const a = action as { label: string; icon: 'arrowRight' | 'check' | 'zap' | 'eye' | 'calendar' | 'x'; onClick: () => void; variant: string };
          const color = a.variant === 'danger' ? T.danger
            : a.variant === 'warning' ? T.warning
            : a.variant === 'success' ? T.success
            : a.variant === 'primary' ? T.primary
            : T.textSecondary;
          return (
            <button
              key={i}
              role="menuitem"
              type="button"
              onClick={() => { a.onClick(); onClose(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '8px 14px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                color,
                transition: 'background 0.12s',
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = T.glassHover; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
            >
              <Ico name={a.icon} size={16} color={color} />
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Priority indicator ──────────────────────────────────────────────── */

function PriorityDot({ waiting }: { waiting: number }) {
  const color = waiting > 45 ? T.danger : waiting > 20 ? T.warning : T.success;
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}44`,
        flexShrink: 0,
      }}
    />
  );
}

/* ── Main page ─────────────────────────────────────────────────────────── */

export default function FilaEsperaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [, setTick] = React.useState(0);
  const [menuTarget, setMenuTarget] = React.useState<{
    entry: (typeof entries)[number];
    rect: { top: number; left: number; width: number };
  } | null>(null);

  const queueQuery = trpc.scheduling.waitQueue.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const startMut = trpc.scheduling.start.useMutation();
  const completeMut = trpc.scheduling.complete.useMutation();
  const noShowMut = trpc.scheduling.noShow.useMutation();
  const cancelMut = trpc.scheduling.cancel.useMutation();

  useRealtime(
    ['appointment.checked_in', 'appointment.updated', 'appointment.created'],
    () => { void queueQuery.refetch(); },
  );

  React.useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const entries = queueQuery.data?.queue ?? [];

  const inProgressCount = entries.filter((e) => e.status === 'in_progress').length;
  const waitingCount = entries.filter((e) => e.status !== 'in_progress').length;
  const avgWait = waitingCount > 0
    ? Math.round(entries.filter((e) => e.status !== 'in_progress').reduce((s, e) => s + e.waitingMinutes, 0) / waitingCount)
    : 0;

  async function handleStart(appointmentId: string, patientId: string) {
    try {
      await startMut.mutateAsync({ id: appointmentId });
      toast.success('Atendimento iniciado');
      router.push(`/pacientes/${patientId}/prontuario`);
    } catch (err) {
      toast.error('Erro ao iniciar', { description: err instanceof Error ? err.message : 'Erro desconhecido' });
    }
  }

  async function handleComplete(appointmentId: string) {
    try {
      await completeMut.mutateAsync({ id: appointmentId });
      toast.success('Atendimento concluído');
      void queueQuery.refetch();
    } catch (err) {
      toast.error('Erro', { description: err instanceof Error ? err.message : 'Erro desconhecido' });
    }
  }

  async function handleNoShow(appointmentId: string) {
    try {
      await noShowMut.mutateAsync({ id: appointmentId });
      toast.success('Marcado como falta');
      void queueQuery.refetch();
    } catch (err) {
      toast.error('Erro', { description: err instanceof Error ? err.message : 'Erro desconhecido' });
    }
  }

  async function handleCancel(appointmentId: string) {
    try {
      await cancelMut.mutateAsync({ id: appointmentId, reason: 'Cancelado pela recepção' });
      toast.success('Agendamento cancelado');
      void queueQuery.refetch();
    } catch (err) {
      toast.error('Erro', { description: err instanceof Error ? err.message : 'Erro desconhecido' });
    }
  }

  function openMenu(entry: (typeof entries)[number], e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuTarget({ entry, rect: { top: rect.top, left: rect.left, width: rect.width } });
  }

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '22px 26px' }}>
      <PageHero
        eyebrow={formatHeroDate(new Date())}
        title="Fila de Espera"
        module="clinical"
        icon="clock"
        description={`${entries.length} paciente${entries.length === 1 ? '' : 's'} na fila`}
        actions={
          <Link href="/agenda" style={{ textDecoration: 'none' }}>
            <Btn variant="glass" small icon="arrowLeft">Voltar à Agenda</Btn>
          </Link>
        }
      />

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'AGUARDANDO', value: waitingCount, color: T.warning },
          { label: 'EM ATENDIMENTO', value: inProgressCount, color: T.success },
          { label: 'ESPERA MÉDIA', value: `${avgWait} min`, color: avgWait > 30 ? T.danger : T.clinical.color },
          { label: 'TOTAL NA FILA', value: entries.length, color: T.primary },
        ].map((kpi) => (
          <Glass key={kpi.label} style={{ padding: '16px 18px', textAlign: 'center' }}>
            <Mono size={10}>{kpi.label}</Mono>
            <p style={{ fontSize: 28, fontWeight: 700, color: kpi.color, margin: '8px 0 0', letterSpacing: '-0.02em' }}>
              {kpi.value}
            </p>
          </Glass>
        ))}
      </div>

      {queueQuery.isLoading ? (
        <Glass style={{ padding: 32, textAlign: 'center' }}>
          <Mono size={11} color={T.textMuted}>CARREGANDO FILA…</Mono>
        </Glass>
      ) : entries.length === 0 ? (
        <Glass style={{ padding: 40 }}>
          <EmptyState
            icon="users"
            title="Fila vazia"
            description="Nenhum paciente fez check-in. Eles aparecerão aqui automaticamente quando fizerem check-in na recepção."
            action={
              <Link href="/agenda" style={{ textDecoration: 'none' }}>
                <Btn variant="glass" small icon="calendar">Ver Agenda</Btn>
              </Link>
            }
          />
        </Glass>
      ) : (
        <div role="list" aria-label="Fila de espera" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((entry, index) => {
            const isInProgress = entry.status === 'in_progress';
            const waiting = entry.waitingMinutes;
            const isOverdue = waiting > 30 && !isInProgress;
            const checkedInAt = new Date(entry.checkedInAt);
            const scheduledAt = new Date(entry.scheduledAt);

            const accentColor = isInProgress
              ? T.success
              : isOverdue
                ? T.danger
                : T.clinical.color;

            return (
              <Glass
                key={entry.appointmentId}
                hover
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 16,
                  padding: '14px 16px',
                  borderLeft: `3px solid ${accentColor}`,
                  cursor: 'pointer',
                }}
                onClick={() => router.push(`/pacientes/${entry.patientId}/prontuario`)}
              >
                {/* Position */}
                <div
                  aria-label={`Posição ${index + 1} na fila`}
                  style={{
                    width: 40,
                    height: 40,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    background: isInProgress ? T.success : T.clinical.bg,
                    color: isInProgress ? '#fff' : T.clinical.color,
                    fontWeight: 700,
                    fontSize: 14,
                    border: isInProgress ? 'none' : `1px solid ${T.clinical.color}30`,
                  }}
                >
                  {isInProgress ? <Ico name="zap" size={18} color="#fff" /> : index + 1}
                </div>

                {/* Patient info */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p style={{ fontSize: 16, fontWeight: 600, color: T.textPrimary, lineHeight: 1.2 }}>
                      {entry.patientName}
                    </p>
                    {isInProgress && <Badge variant="success" dot>Em atendimento</Badge>}
                    {isOverdue && <Badge variant="danger" dot>Atrasado</Badge>}
                  </div>
                  <Mono size={11}>
                    {entry.providerName}
                    {entry.serviceName ? ` · ${entry.serviceName}` : ''}
                  </Mono>
                </div>

                {/* Times */}
                <div style={{ minWidth: 140, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Ico name="check" size={12} color={T.success} />
                    <Mono size={11}>CHECK-IN {format(checkedInAt, 'HH:mm', { locale: ptBR })}</Mono>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Ico name="clock" size={12} color={T.textMuted} />
                    <Mono size={11} color={T.textTertiary}>AGENDADO {format(scheduledAt, 'HH:mm', { locale: ptBR })}</Mono>
                  </div>
                </div>

                {/* Wait time */}
                <div
                  style={{
                    minWidth: 100,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 16,
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 700,
                    color: accentColor,
                    fontFamily: "'IBM Plex Sans', sans-serif",
                  }}
                  aria-label={isInProgress ? 'Em atendimento' : `Aguardando há ${waiting} minutos`}
                >
                  <PriorityDot waiting={waiting} />
                  {isInProgress ? 'Em atend.' : `${waiting} min`}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  {isInProgress ? (
                    <Link href={`/pacientes/${entry.patientId}/prontuario`} style={{ textDecoration: 'none' }}>
                      <Btn variant="glass" small icon="arrowRight">Continuar</Btn>
                    </Link>
                  ) : (
                    <Btn
                      small
                      icon="zap"
                      onClick={() => handleStart(entry.appointmentId, entry.patientId)}
                      loading={startMut.isPending && startMut.variables?.id === entry.appointmentId}
                    >
                      Iniciar
                    </Btn>
                  )}
                  <Btn
                    variant="ghost"
                    small
                    iconOnly
                    icon="more"
                    onClick={(e) => openMenu(entry, e)}
                    aria-label={`Mais ações para ${entry.patientName}`}
                  />
                </div>
              </Glass>
            );
          })}
        </div>
      )}

      {menuTarget && (
        <ActionMenu
          appointmentId={menuTarget.entry.appointmentId}
          patientId={menuTarget.entry.patientId}
          patientName={menuTarget.entry.patientName}
          status={menuTarget.entry.status}
          anchorRect={menuTarget.rect}
          onClose={() => setMenuTarget(null)}
          onStart={() => handleStart(menuTarget.entry.appointmentId, menuTarget.entry.patientId)}
          onComplete={() => handleComplete(menuTarget.entry.appointmentId)}
          onNoShow={() => handleNoShow(menuTarget.entry.appointmentId)}
          onCancel={() => handleCancel(menuTarget.entry.appointmentId)}
        />
      )}
    </div>
  );
}
