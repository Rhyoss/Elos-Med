/**
 * use-scheduling.ts
 *
 * Hooks tipados para operações de agenda e agendamentos.
 *
 * Endpoints consumidos:
 *   trpc.scheduling.agendaDay     → useAgendaDay
 *   trpc.scheduling.agendaWeek    → useAgendaWeek
 *   trpc.scheduling.waitQueue     → useWaitQueue
 *   trpc.scheduling.listProviders → useProviders
 *   trpc.scheduling.listServices  → useServices
 *   trpc.scheduling.create        → useCreateAppointment
 *   trpc.scheduling.start         → useStartAppointment
 *   trpc.scheduling.complete      → useCompleteAppointment
 *   trpc.scheduling.cancel        → useCancelAppointment
 *   trpc.scheduling.checkIn       → useCheckInAppointment
 *   trpc.scheduling.confirm       → useConfirmAppointment
 *   trpc.scheduling.noShow        → useNoShowAppointment
 */

'use client';

import { trpc } from '@/lib/trpc-provider';

/* ── Fetch: agenda diária ───────────────────────────────────────────────── */

/** date pode ser string ISO ou Date — será coercida internamente */
export function useAgendaDay(date: Date | string, providerId?: string) {
  const d = date instanceof Date ? date : new Date(date);
  return trpc.scheduling.agendaDay.useQuery(
    { date: d, providerId },
    {
      staleTime:            30_000,
      refetchOnWindowFocus: true,
      refetchInterval:      60_000,
    },
  );
}

/* ── Fetch: agenda semanal ──────────────────────────────────────────────── */

/** startDate pode ser string ISO ou Date */
export function useAgendaWeek(startDate: Date | string, providerId?: string) {
  const d = startDate instanceof Date ? startDate : new Date(startDate);
  return trpc.scheduling.agendaWeek.useQuery(
    { startDate: d, providerId },
    {
      staleTime:            30_000,
      refetchOnWindowFocus: true,
    },
  );
}

/* ── Fetch: fila de espera ──────────────────────────────────────────────── */

export function useWaitQueue() {
  return trpc.scheduling.waitQueue.useQuery(undefined, {
    staleTime:       15_000,
    refetchInterval: 30_000,
  });
}

/* ── Fetch: providers / services ────────────────────────────────────────── */

export function useProviders() {
  return trpc.scheduling.listProviders.useQuery(undefined, { staleTime: 300_000 });
}

export function useServices() {
  return trpc.scheduling.listServices.useQuery(undefined, { staleTime: 300_000 });
}

/* ── Mutation: criar agendamento ────────────────────────────────────────── */

/**
 * Cria agendamento e invalida:
 *   - scheduling.agendaDay  (visualização diária)
 *   - scheduling.agendaWeek (visualização semanal)
 *   - patients.getById      (sidebar do prontuário — lastVisitAt)
 */
export function useCreateAppointment(patientId?: string) {
  const utils = trpc.useUtils();

  return trpc.scheduling.create.useMutation({
    onSuccess: () => {
      void utils.scheduling.agendaDay.invalidate();
      void utils.scheduling.agendaWeek.invalidate();
      if (patientId) {
        void utils.patients.getById.invalidate({ id: patientId });
      }
    },
    onError: (err) => {
      if (process.env.NODE_ENV === 'development') {
        console.error('[useCreateAppointment]', err);
      }
    },
  });
}

/* ── Mutation: ciclo de vida do agendamento ─────────────────────────────── */

function makeAppointmentLifecycleMutation(
  patientId: string | undefined,
  utils: ReturnType<typeof trpc.useUtils>,
) {
  return {
    onSuccess: () => {
      void utils.scheduling.agendaDay.invalidate();
      void utils.scheduling.agendaWeek.invalidate();
      void utils.scheduling.waitQueue.invalidate();
      if (patientId) {
        void utils.patients.getById.invalidate({ id: patientId });
      }
    },
  };
}

export function useStartAppointment(patientId?: string) {
  const utils = trpc.useUtils();
  return trpc.scheduling.start.useMutation(makeAppointmentLifecycleMutation(patientId, utils));
}

export function useCompleteAppointment(patientId?: string) {
  const utils = trpc.useUtils();
  return trpc.scheduling.complete.useMutation({
    onSuccess: () => {
      void utils.scheduling.agendaDay.invalidate();
      void utils.scheduling.agendaWeek.invalidate();
      void utils.scheduling.waitQueue.invalidate();
      if (patientId) {
        void utils.patients.getById.invalidate({ id: patientId });
        void utils.clinical.encounters.getByPatient.invalidate({ patientId });
      }
    },
  });
}

export function useCancelAppointment(patientId?: string) {
  const utils = trpc.useUtils();
  return trpc.scheduling.cancel.useMutation(makeAppointmentLifecycleMutation(patientId, utils));
}

export function useCheckInAppointment(patientId?: string) {
  const utils = trpc.useUtils();
  return trpc.scheduling.checkIn.useMutation(makeAppointmentLifecycleMutation(patientId, utils));
}

export function useConfirmAppointment(patientId?: string) {
  const utils = trpc.useUtils();
  return trpc.scheduling.confirm.useMutation(makeAppointmentLifecycleMutation(patientId, utils));
}

export function useNoShowAppointment(patientId?: string) {
  const utils = trpc.useUtils();
  return trpc.scheduling.noShow.useMutation(makeAppointmentLifecycleMutation(patientId, utils));
}
