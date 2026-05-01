/**
 * use-prescriptions.ts
 *
 * Hooks tipados para o módulo clinical/prescriptions.
 *
 * Endpoints consumidos:
 *   trpc.clinical.prescriptions.listByPatient   → usePrescriptionsByPatient
 *   trpc.clinical.prescriptions.getById         → usePrescription
 *   trpc.clinical.prescriptions.deliveryHistory → usePrescriptionDeliveries
 *   trpc.clinical.prescriptions.create          → useCreatePrescription
 *   trpc.clinical.prescriptions.update          → useUpdatePrescription
 *   trpc.clinical.prescriptions.sign            → useSignPrescription
 *   trpc.clinical.prescriptions.cancel          → useCancelPrescription
 *   trpc.clinical.prescriptions.duplicate       → useDuplicatePrescription
 *   trpc.clinical.prescriptions.send            → useSendPrescription
 *   trpc.clinical.prescriptions.requestPdf      → useRequestPrescriptionPdf
 *
 * Todas as mutations invalidam os caches dependentes para refletir status,
 * histórico e PDF imediatamente nas telas conectadas.
 */

'use client';

import { keepPreviousData } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-provider';
import type {
  ListPrescriptionsQuery,
  PrescriptionStatus,
  PrescriptionType,
} from '@dermaos/shared';

/* ── Queries ────────────────────────────────────────────────────────────── */

export function usePrescriptionsByPatient(
  patientId: string,
  filters: Partial<Pick<ListPrescriptionsQuery, 'status' | 'type' | 'page' | 'pageSize'>> = {},
  options: { enabled?: boolean } = {},
) {
  return trpc.clinical.prescriptions.listByPatient.useQuery(
    {
      patientId,
      status:   filters.status,
      type:     filters.type,
      page:     filters.page ?? 1,
      pageSize: filters.pageSize ?? 50,
    },
    {
      enabled:           options.enabled !== false && !!patientId,
      placeholderData:   keepPreviousData,
      staleTime:         15_000,
      refetchOnWindowFocus: false,
    },
  );
}

export function usePrescription(
  prescriptionId: string,
  options: { enabled?: boolean } = {},
) {
  const query = trpc.clinical.prescriptions.getById.useQuery(
    { id: prescriptionId },
    {
      enabled:    options.enabled !== false && !!prescriptionId,
      staleTime:  15_000,
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
    prescription: query.data?.prescription ?? null,
    isNotFound:   query.isError && code === 'NOT_FOUND',
    isForbidden:  query.isError && (code === 'FORBIDDEN' || code === 'UNAUTHORIZED'),
  };
}

export function usePrescriptionDeliveries(prescriptionId: string) {
  return trpc.clinical.prescriptions.deliveryHistory.useQuery(
    { id: prescriptionId },
    {
      enabled:    !!prescriptionId,
      staleTime:  30_000,
      refetchOnWindowFocus: false,
    },
  );
}

/* ── Cache invalidation helper ──────────────────────────────────────────── */

function useInvalidatePrescription() {
  const utils = trpc.useUtils();
  return (patientId: string | null, prescriptionId?: string) => {
    if (patientId) {
      void utils.clinical.prescriptions.listByPatient.invalidate({ patientId });
      void utils.clinical.encounters.getByPatient.invalidate({ patientId });
      void utils.patients.getById.invalidate({ id: patientId });
    }
    if (prescriptionId) {
      void utils.clinical.prescriptions.getById.invalidate({ id: prescriptionId });
      void utils.clinical.prescriptions.deliveryHistory.invalidate({ id: prescriptionId });
    }
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

export function useCreatePrescription() {
  const invalidate = useInvalidatePrescription();
  return trpc.clinical.prescriptions.create.useMutation({
    onSuccess: ({ prescription }) => {
      invalidate(prescription.patientId, prescription.id);
    },
  });
}

export function useUpdatePrescription() {
  const invalidate = useInvalidatePrescription();
  return trpc.clinical.prescriptions.update.useMutation({
    onSuccess: ({ prescription }) => {
      invalidate(prescription.patientId, prescription.id);
    },
  });
}

export function useSignPrescription() {
  const invalidate = useInvalidatePrescription();
  return trpc.clinical.prescriptions.sign.useMutation({
    onSuccess: ({ prescription }) => {
      invalidate(prescription.patientId, prescription.id);
    },
  });
}

export function useCancelPrescription() {
  const invalidate = useInvalidatePrescription();
  return trpc.clinical.prescriptions.cancel.useMutation({
    onSuccess: ({ prescription }) => {
      invalidate(prescription.patientId, prescription.id);
    },
  });
}

export function useDuplicatePrescription() {
  const invalidate = useInvalidatePrescription();
  return trpc.clinical.prescriptions.duplicate.useMutation({
    onSuccess: ({ prescription }) => {
      invalidate(prescription.patientId, prescription.id);
    },
  });
}

export function useSendPrescription() {
  const invalidate = useInvalidatePrescription();
  return trpc.clinical.prescriptions.send.useMutation({
    onSuccess: ({ prescription }) => {
      invalidate(prescription.patientId, prescription.id);
    },
  });
}

export function useRequestPrescriptionPdf() {
  const invalidate = useInvalidatePrescription();
  return trpc.clinical.prescriptions.requestPdf.useMutation({
    onSuccess: (_data, vars) => {
      void invalidate(null, vars.id);
    },
  });
}

/* ── UI helpers ─────────────────────────────────────────────────────────── */

export const PRESCRIPTION_STATUS_VARIANT: Record<
  PrescriptionStatus,
  'default' | 'success' | 'warning' | 'danger' | 'info'
> = {
  rascunho:        'warning',
  emitida:         'info',
  assinada:        'success',
  enviada_digital: 'success',
  impressa:        'success',
  expirada:        'default',
  cancelada:       'danger',
};

export const PRESCRIPTION_TYPE_TONE: Record<PrescriptionType, string> = {
  topica:       'Tópica',
  sistemica:    'Sistêmica',
  manipulada:   'Manipulada',
  cosmeceutica: 'Cosmecêutica',
};
