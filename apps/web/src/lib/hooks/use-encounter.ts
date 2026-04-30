/**
 * use-encounter.ts
 *
 * Hooks tipados para operações de atendimento (encounters).
 *
 * Endpoints consumidos:
 *   trpc.clinical.encounters.getById         → useEncounter
 *   trpc.clinical.encounters.getByPatient    → usePatientEncounters
 *   trpc.clinical.encounters.create          → useCreateEncounter
 *   trpc.clinical.encounters.update          → useUpdateEncounter
 *   trpc.clinical.encounters.autoSave        → useAutoSaveEncounter
 *   trpc.clinical.encounters.sign            → useSignEncounter
 *   trpc.clinical.prescriptions.listByPatient→ usePatientPrescriptions
 *   trpc.clinical.lesions.listByPatient      → usePatientLesions
 *   trpc.clinical.protocols.listByPatient    → usePatientProtocols
 */

'use client';

import { trpc } from '@/lib/trpc-provider';

/* ── Fetch: encounter by ID ─────────────────────────────────────────────── */

/**
 * Busca atendimento por ID.
 * isNotFound=true quando o backend responde NOT_FOUND.
 */
export function useEncounter(encounterId: string) {
  const query = trpc.clinical.encounters.getById.useQuery(
    { id: encounterId },
    {
      enabled:              !!encounterId,
      staleTime:            0,
      refetchOnWindowFocus: false,
      retry: (count, err) => {
        const code = (err as { data?: { code?: string } })?.data?.code;
        if (code === 'NOT_FOUND' || code === 'FORBIDDEN' || code === 'UNAUTHORIZED') return false;
        return count < 2;
      },
    },
  );

  const code = (query.error as { data?: { code?: string } } | null)?.data?.code;

  return {
    ...query,
    encounter:    query.data?.encounter ?? null,
    isNotFound:   query.isError && code === 'NOT_FOUND',
    isForbidden:  query.isError && (code === 'FORBIDDEN' || code === 'UNAUTHORIZED'),
  };
}

/* ── Fetch: encounters by patient ───────────────────────────────────────── */

export function usePatientEncounters(
  patientId: string,
  page = 1,
  pageSize = 20,
) {
  return trpc.clinical.encounters.getByPatient.useQuery(
    { patientId, page, pageSize },
    {
      enabled:              !!patientId,
      staleTime:            30_000,
      refetchOnWindowFocus: false,
    },
  );
}

/* ── Fetch: prescriptions by patient ───────────────────────────────────── */

export function usePatientPrescriptions(patientId: string, page = 1, pageSize = 20) {
  return trpc.clinical.prescriptions.listByPatient.useQuery(
    { patientId, page, pageSize },
    { enabled: !!patientId, staleTime: 30_000 },
  );
}

/* ── Fetch: lesions / clinical photos by patient ───────────────────────── */

export function usePatientLesions(patientId: string) {
  return trpc.clinical.lesions.listByPatient.useQuery(
    { patientId },
    { enabled: !!patientId, staleTime: 60_000 },
  );
}

export function usePatientImages(patientId: string) {
  // trpc.clinical.lesions.listPatientImages — lista imagens de todas as lesões do paciente
  return trpc.clinical.lesions.listPatientImages.useQuery(
    { patientId },
    { enabled: !!patientId, staleTime: 60_000 },
  );
}

/* ── Fetch: protocols by patient ────────────────────────────────────────── */

export function usePatientProtocols(patientId: string) {
  return trpc.clinical.protocols.listByPatient.useQuery(
    { patientId },
    { enabled: !!patientId, staleTime: 30_000 },
  );
}

/* ── Mutation: create encounter ─────────────────────────────────────────── */

/**
 * Cria atendimento a partir de appointmentId.
 * Invalida após sucesso:
 *   - clinical.encounters.getByPatient  (aba Consultas do prontuário)
 *   - scheduling.agendaDay              (agenda dia)
 *   - patients.getById                  (sidebar do prontuário)
 */
export function useCreateEncounter(patientId: string) {
  const utils = trpc.useUtils();

  return trpc.clinical.encounters.create.useMutation({
    onSuccess: () => {
      void utils.clinical.encounters.getByPatient.invalidate({ patientId });
      void utils.scheduling.agendaDay.invalidate();
      void utils.patients.getById.invalidate({ id: patientId });
    },
    onError: (err) => {
      if (process.env.NODE_ENV === 'development') {
        console.error('[useCreateEncounter]', err);
      }
    },
  });
}

/* ── Mutation: sign encounter ───────────────────────────────────────────── */

/**
 * Assina atendimento (imutável após assinatura).
 * Invalida após sucesso:
 *   - clinical.encounters.getById          (status → assinado)
 *   - clinical.encounters.getByPatient     (lista)
 *   - patients.getById                     (sidebar — lastVisitAt muda)
 *   - scheduling.agendaDay                 (status do appointment)
 */
export function useSignEncounter(encounterId: string, patientId: string) {
  const utils = trpc.useUtils();

  return trpc.clinical.encounters.sign.useMutation({
    onSuccess: () => {
      void utils.clinical.encounters.getById.invalidate({ id: encounterId });
      void utils.clinical.encounters.getByPatient.invalidate({ patientId });
      void utils.patients.getById.invalidate({ id: patientId });
      void utils.scheduling.agendaDay.invalidate();
    },
    onError: (err) => {
      if (process.env.NODE_ENV === 'development') {
        console.error('[useSignEncounter]', err);
      }
    },
  });
}

/* ── Mutation: create prescription ─────────────────────────────────────── */

/**
 * Cria prescrição vinculada ao paciente.
 * Invalida após sucesso:
 *   - clinical.prescriptions.listByPatient (aba Prescrições)
 *   - clinical.encounters.getByPatient     (timeline da consulta)
 */
export function useCreatePrescription(patientId: string) {
  const utils = trpc.useUtils();

  return trpc.clinical.prescriptions.create.useMutation({
    onSuccess: () => {
      void utils.clinical.prescriptions.listByPatient.invalidate({ patientId });
      void utils.clinical.encounters.getByPatient.invalidate({ patientId });
    },
    onError: (err) => {
      if (process.env.NODE_ENV === 'development') {
        console.error('[useCreatePrescription]', err);
      }
    },
  });
}
