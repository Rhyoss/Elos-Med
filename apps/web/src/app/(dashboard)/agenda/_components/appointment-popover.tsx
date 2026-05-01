'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  useToast,
} from '@dermaos/ui';
import { Btn, Ico, Mono, T, type IcoName } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { STATUS_LABEL, formatSlotRange } from '@/lib/agenda-utils';
import type { AppointmentCardData } from './appointment-detail-sheet';

interface AppointmentPopoverProps {
  appointment: AppointmentCardData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMutated?: () => void;
  onOpenSheet?: () => void;
  onReschedule?: () => void;
  onCancel?: () => void;
  children: React.ReactNode;
}

export function AppointmentPopover({
  appointment,
  open,
  onOpenChange,
  onMutated,
  onOpenSheet,
  onReschedule,
  onCancel,
  children,
}: AppointmentPopoverProps) {
  const router = useRouter();
  const { toast } = useToast();

  const confirmMut = trpc.scheduling.confirm.useMutation();
  const checkInMut = trpc.scheduling.checkIn.useMutation();
  const startMut   = trpc.scheduling.start.useMutation();
  const completeMut = trpc.scheduling.complete.useMutation();
  const noShowMut  = trpc.scheduling.noShow.useMutation();

  if (!appointment) return <>{children}</>;

  const scheduledAt = new Date(appointment.scheduledAt);
  const endsAt = new Date(scheduledAt.getTime() + appointment.durationMin * 60_000);
  const status = appointment.status;

  async function act(
    label: string,
    fn: () => Promise<unknown>,
  ) {
    try {
      await fn();
      toast.success(label);
      onMutated?.();
      onOpenChange(false);
    } catch (err) {
      toast.error('Erro', { description: err instanceof Error ? err.message : 'Erro desconhecido' });
    }
  }

  const actions: Array<{
    label: string;
    icon: IcoName;
    onClick: () => void;
    variant?: 'ghost' | 'danger';
    show: boolean;
    loading?: boolean;
  }> = [
    {
      label: 'Abrir prontuário',
      icon: 'file',
      onClick: () => {
        onOpenChange(false);
        router.push(`/pacientes/${appointment.patientId}/prontuario`);
      },
      show: true,
    },
    {
      label: 'Ficha do paciente',
      icon: 'user',
      onClick: () => {
        onOpenChange(false);
        router.push(`/pacientes/${appointment.patientId}/perfil`);
      },
      show: true,
    },
    {
      label: 'Confirmar',
      icon: 'check',
      onClick: () => act('Consulta confirmada', () => confirmMut.mutateAsync({ id: appointment.id, via: 'manual' })),
      show: status === 'scheduled',
      loading: confirmMut.isPending,
    },
    {
      label: 'Check-in',
      icon: 'user',
      onClick: () => act('Check-in realizado', () => checkInMut.mutateAsync({ id: appointment.id })),
      show: status === 'confirmed',
      loading: checkInMut.isPending,
    },
    {
      label: 'Iniciar atendimento',
      icon: 'zap',
      onClick: () => {
        void act('Atendimento iniciado', () => startMut.mutateAsync({ id: appointment.id }));
        router.push(`/pacientes/${appointment.patientId}/prontuario`);
      },
      show: status === 'waiting' || status === 'checked_in',
      loading: startMut.isPending,
    },
    {
      label: 'Concluir',
      icon: 'check',
      onClick: () => act('Atendimento concluído', () => completeMut.mutateAsync({ id: appointment.id })),
      show: status === 'in_progress',
      loading: completeMut.isPending,
    },
    {
      label: 'Remarcar',
      icon: 'calendar',
      onClick: () => { onOpenChange(false); onReschedule?.(); },
      show: status === 'scheduled' || status === 'confirmed',
    },
    {
      label: 'Não compareceu',
      icon: 'alert',
      onClick: () => act('Marcado como não compareceu', () => noShowMut.mutateAsync({ id: appointment.id })),
      show: status === 'scheduled' || status === 'confirmed' || status === 'waiting',
      loading: noShowMut.isPending,
    },
    {
      label: 'Cancelar',
      icon: 'x',
      onClick: () => { onOpenChange(false); onCancel?.(); },
      variant: 'danger',
      show: status !== 'completed' && status !== 'cancelled' && status !== 'no_show',
    },
  ];

  const visibleActions = actions.filter((a) => a.show);

  return (
    <PopoverRoot open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-80 p-0"
        style={{
          background: '#fff',
          borderRadius: T.r.lg,
          border: `1px solid ${T.divider}`,
          boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)',
          zIndex: 'var(--z-overlay)',
        }}
      >
        {/* Header */}
        <div
          className="px-4 pt-3.5 pb-3"
          style={{ borderBottom: `1px solid ${T.divider}` }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
              style={{
                background: T.clinical.bg,
                border: `1px solid ${T.clinical.border}`,
              }}
            >
              {appointment.patient.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={appointment.patient.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold" style={{ color: T.clinical.color }}>
                  {appointment.patient.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate" style={{ color: T.textPrimary }}>
                {appointment.patient.name}
              </p>
              <Mono size={9} color={T.textMuted}>
                {format(scheduledAt, 'dd/MM', { locale: ptBR })} · {formatSlotRange(scheduledAt, endsAt)} · {appointment.durationMin}min
              </Mono>
            </div>
          </div>
          {appointment.service && (
            <p className="text-xs mt-1.5" style={{ color: T.textSecondary }}>
              {appointment.service.name} — {appointment.provider.name}
            </p>
          )}
          {appointment.patient.allergiesCount > 0 && (
            <div className="flex items-center gap-1.5 mt-2 text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">
              <Ico name="alert" size={10} color="#dc2626" />
              ALERGIAS: {appointment.patient.allergiesSummary}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="py-1.5">
          {visibleActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={action.loading}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-black/[0.03] disabled:opacity-50"
              style={{
                color: action.variant === 'danger' ? T.danger : T.textPrimary,
              }}
            >
              <Ico
                name={action.icon}
                size={14}
                color={action.variant === 'danger' ? T.danger : T.textSecondary}
              />
              <span className="text-[13px]">
                {action.loading ? 'Aguarde…' : action.label}
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2.5 flex justify-between items-center"
          style={{ borderTop: `1px solid ${T.divider}` }}
        >
          <Mono size={8} color={T.textMuted}>
            {STATUS_LABEL[status] ?? status}
          </Mono>
          <button
            type="button"
            onClick={() => { onOpenChange(false); onOpenSheet?.(); }}
            className="text-xs underline underline-offset-2 transition-colors hover:opacity-70"
            style={{ color: T.primary }}
          >
            Ver detalhes
          </button>
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}
