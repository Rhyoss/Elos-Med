'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  SheetRoot,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetFooter,
  Button,
  Input,
  Textarea,
  StatusBadge,
  AllergyBanner,
  TimelineActivity,
  ConfirmDialog,
  useToast,
  type AnyStatus,
} from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import { STATUS_LABEL, formatSlotRange } from '@/lib/agenda-utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface AppointmentCardData {
  id:           string;
  patientId:    string;
  providerId:   string;
  scheduledAt:  Date | string;
  endsAt?:      Date | string;
  durationMin:  number;
  room:         string | null;
  type:         string;
  status:       string;
  source:       string;
  patientNotes: string | null;
  internalNotes: string | null;
  statusHistory: Array<{ status: string; changed_at: string; changed_by: string | null; reason?: string; via?: string }>;
  patient: {
    id:       string;
    name:     string;
    photoUrl: string | null;
    age:      number | null;
    allergiesSummary: string;
    allergiesCount:   number;
  };
  provider: { id: string; name: string };
  service:  { id: string; name: string } | null;
}

interface Props {
  appointment: AppointmentCardData | null;
  open:        boolean;
  onOpenChange: (open: boolean) => void;
  onMutated?:  () => void;
}

export function AppointmentDetailSheet({ appointment, open, onOpenChange, onMutated }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [cancelOpen,  setCancelOpen]  = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');

  const confirmMut    = trpc.scheduling.confirm.useMutation();
  const checkInMut    = trpc.scheduling.checkIn.useMutation();
  const startMut      = trpc.scheduling.start.useMutation();
  const completeMut   = trpc.scheduling.complete.useMutation();
  const cancelMut     = trpc.scheduling.cancel.useMutation();
  const rescheduleMut = trpc.scheduling.reschedule.useMutation();

  const scheduledAt = useMemo(
    () => appointment ? new Date(appointment.scheduledAt) : null,
    [appointment],
  );
  const endsAt = useMemo(
    () => appointment && scheduledAt
      ? new Date(scheduledAt.getTime() + appointment.durationMin * 60_000)
      : null,
    [appointment, scheduledAt],
  );

  if (!appointment || !scheduledAt || !endsAt) {
    return (
      <SheetRoot open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Detalhes do agendamento</SheetTitle>
          </SheetHeader>
          <SheetBody>Selecione um agendamento.</SheetBody>
        </SheetContent>
      </SheetRoot>
    );
  }

  const status = appointment.status as AnyStatus;

  async function handle(
    mut: { mutateAsync: (args: { id: string }) => Promise<unknown>; isPending: boolean },
    successMsg: string,
  ) {
    try {
      await mut.mutateAsync({ id: appointment!.id });
      toast.success(successMsg);
      onMutated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar';
      toast.error('Erro', { description: message });
    }
  }

  async function handleConfirm() {
    try {
      await confirmMut.mutateAsync({ id: appointment!.id, via: 'manual' });
      toast.success('Agendamento confirmado');
      onMutated?.();
    } catch (err) {
      toast.error('Erro', { description: err instanceof Error ? err.message : 'Erro desconhecido' });
    }
  }

  async function handleCancelConfirm() {
    if (!cancelReason.trim()) {
      toast.error('Motivo é obrigatório');
      return;
    }
    try {
      await cancelMut.mutateAsync({ id: appointment!.id, reason: cancelReason });
      toast.success('Agendamento cancelado');
      setCancelOpen(false);
      setCancelReason('');
      onOpenChange(false);
      onMutated?.();
    } catch (err) {
      toast.error('Erro', { description: err instanceof Error ? err.message : 'Erro desconhecido' });
    }
  }

  async function handleReschedule() {
    if (!rescheduleDate) return;
    try {
      await rescheduleMut.mutateAsync({
        id: appointment!.id,
        newScheduledAt: new Date(rescheduleDate),
      });
      toast.success('Agendamento remarcado');
      setRescheduleOpen(false);
      onOpenChange(false);
      onMutated?.();
    } catch (err) {
      toast.error('Erro', { description: err instanceof Error ? err.message : 'Erro desconhecido' });
    }
  }

  async function handleStart() {
    try {
      await startMut.mutateAsync({ id: appointment!.id });
      toast.success('Atendimento iniciado');
      onMutated?.();
      onOpenChange(false);
      router.push(`/pacientes/${appointment!.patientId}/prontuario`);
    } catch (err) {
      toast.error('Erro', { description: err instanceof Error ? err.message : 'Erro desconhecido' });
    }
  }

  return (
    <>
      <SheetRoot open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="max-w-[460px]">
          <SheetHeader>
            <SheetTitle>Detalhes do agendamento</SheetTitle>
            <div className="flex items-center gap-2 pt-1">
              <StatusBadge status={status} domain="appointment" />
              <span className="text-xs text-muted-foreground">
                {format(scheduledAt, "dd/MM/yyyy", { locale: ptBR })} • {formatSlotRange(scheduledAt, endsAt)}
              </span>
            </div>
          </SheetHeader>

          <SheetBody className="space-y-6">
            {/* Paciente */}
            <section aria-labelledby="sheet-patient-heading" className="space-y-2">
              <h3 id="sheet-patient-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Paciente
              </h3>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                  {appointment.patient.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={appointment.patient.photoUrl} alt={appointment.patient.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">
                      {appointment.patient.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{appointment.patient.name}</p>
                  {appointment.patient.age !== null && (
                    <p className="text-xs text-muted-foreground">{appointment.patient.age} anos</p>
                  )}
                </div>
              </div>
              {appointment.patient.allergiesCount > 0 && (
                <AllergyBanner
                  allergies={appointment.patient.allergiesSummary.split(', ').filter(Boolean)}
                />
              )}
            </section>

            {/* Detalhes */}
            <section aria-labelledby="sheet-details-heading" className="space-y-2">
              <h3 id="sheet-details-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Detalhes
              </h3>
              <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                <dt className="text-muted-foreground">Tipo</dt>
                <dd>{appointment.service?.name ?? appointment.type}</dd>
                <dt className="text-muted-foreground">Duração</dt>
                <dd>{appointment.durationMin} min</dd>
                <dt className="text-muted-foreground">Médico</dt>
                <dd>{appointment.provider.name}</dd>
                <dt className="text-muted-foreground">Sala</dt>
                <dd>{appointment.room ?? '—'}</dd>
                <dt className="text-muted-foreground">Origem</dt>
                <dd className="capitalize">{appointment.source.replace('_', ' ')}</dd>
              </dl>
              {appointment.patientNotes && (
                <div>
                  <p className="text-xs text-muted-foreground mt-2">Observações do paciente</p>
                  <p className="text-sm whitespace-pre-wrap">{appointment.patientNotes}</p>
                </div>
              )}
              {appointment.internalNotes && (
                <div>
                  <p className="text-xs text-muted-foreground mt-2">Notas internas</p>
                  <p className="text-sm whitespace-pre-wrap">{appointment.internalNotes}</p>
                </div>
              )}
            </section>

            {/* Timeline */}
            {appointment.statusHistory.length > 0 && (
              <section aria-labelledby="sheet-timeline-heading" className="space-y-2">
                <h3 id="sheet-timeline-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Histórico
                </h3>
                <TimelineActivity
                  events={appointment.statusHistory.map((h) => ({
                    id:        `${h.changed_at}-${h.status}`,
                    title:     STATUS_LABEL[h.status] ?? h.status,
                    timestamp: h.changed_at,
                    subtitle:  h.reason ?? h.via,
                  }))}
                />
              </section>
            )}
          </SheetBody>

          <SheetFooter className="flex-wrap justify-between gap-2">
            <Link
              href={`/pacientes/${appointment.patient.id}/perfil`}
              className="text-sm underline text-primary-700 hover:text-primary-500"
            >
              Ver perfil do paciente
            </Link>
            <div className="flex gap-2 flex-wrap">
              {status === 'scheduled' && (
                <>
                  <Button variant="outline" onClick={() => setCancelOpen(true)}>Cancelar</Button>
                  <Button onClick={handleConfirm} isLoading={confirmMut.isPending}>Confirmar</Button>
                </>
              )}
              {status === 'confirmed' && (
                <>
                  <Button variant="outline" onClick={() => setRescheduleOpen(true)}>Remarcar</Button>
                  <Button variant="outline" onClick={() => setCancelOpen(true)}>Cancelar</Button>
                  <Button onClick={() => handle(checkInMut, 'Check-in realizado')} isLoading={checkInMut.isPending}>
                    Check-in
                  </Button>
                </>
              )}
              {status === 'waiting' && (
                <Button onClick={handleStart} isLoading={startMut.isPending}>
                  Iniciar Atendimento
                </Button>
              )}
              {status === 'in_progress' && (
                <Button onClick={() => handle(completeMut, 'Atendimento concluído')} isLoading={completeMut.isPending}>
                  Concluir
                </Button>
              )}
              {status === 'completed' && (
                <Link href={`/pacientes/${appointment.patient.id}/prontuario`}>
                  <Button>Ver Prontuário</Button>
                </Link>
              )}
            </div>
          </SheetFooter>
        </SheetContent>
      </SheetRoot>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={(o) => { setCancelOpen(o); if (!o) setCancelReason(''); }}
        title="Cancelar agendamento"
        description="Informe o motivo do cancelamento. O paciente poderá ser notificado."
        confirmLabel="Confirmar cancelamento"
        isLoading={cancelMut.isPending}
        onConfirm={handleCancelConfirm}
      >
        <Textarea
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Ex: paciente pediu para remarcar"
          rows={3}
          aria-label="Motivo do cancelamento"
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        title="Remarcar agendamento"
        description="Selecione a nova data e horário."
        confirmLabel="Remarcar"
        isLoading={rescheduleMut.isPending}
        onConfirm={handleReschedule}
      >
        <Input
          type="datetime-local"
          value={rescheduleDate}
          onChange={(e) => setRescheduleDate(e.target.value)}
          aria-label="Nova data e horário"
        />
      </ConfirmDialog>
    </>
  );
}
