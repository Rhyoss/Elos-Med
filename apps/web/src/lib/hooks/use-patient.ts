/**
 * use-patient.ts
 *
 * Hooks tipados para operações de pacientes.
 *
 * Endpoints consumidos:
 *   trpc.patients.list       → usePatientsList
 *   trpc.patients.getById    → usePatient
 *   trpc.patients.search     → usePatientSearch
 *   trpc.patients.create     → useCreatePatient   (invalida patients.list)
 *   trpc.patients.update     → useUpdatePatient   (invalida patients.getById + patients.list)
 *   trpc.patients.delete     → useDeletePatient   (invalida patients.list)
 *   trpc.patients.getActivity→ usePatientActivity
 */

'use client';

import { keepPreviousData } from '@tanstack/react-query';
import { trpc }             from '@/lib/trpc-provider';
import type { PatientListQuery, SearchPatientInput } from '@dermaos/shared';

/* ── Fetch: patient by ID ───────────────────────────────────────────────── */

/**
 * Busca paciente por ID. Retorna isNotFound=true quando o backend responde NOT_FOUND.
 * Nunca renderiza prontuário com patientId inválido — use `isNotFound` para redirecionar.
 */
export function usePatient(patientId: string) {
  const query = trpc.patients.getById.useQuery(
    { id: patientId },
    {
      staleTime:           30_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => {
        // Não retenta NOT_FOUND nem FORBIDDEN — são erros definitivos
        const code = (err as { data?: { code?: string } })?.data?.code;
        if (code === 'NOT_FOUND' || code === 'FORBIDDEN' || code === 'UNAUTHORIZED') {
          return false;
        }
        return count < 2;
      },
    },
  );

  const code = (query.error as { data?: { code?: string } } | null)?.data?.code;

  return {
    ...query,
    patient:      query.data?.patient ?? null,
    isNotFound:   query.isError && code === 'NOT_FOUND',
    isForbidden:  query.isError && (code === 'FORBIDDEN' || code === 'UNAUTHORIZED'),
    isNetworkError: query.isError && !code,
  };
}

/* ── Fetch: patients list ───────────────────────────────────────────────── */

/**
 * Lista paginada de pacientes com filtros.
 * O campo `placeholderData` mantém dados anteriores durante fetch de nova página.
 */
export function usePatientsList(params: Partial<PatientListQuery> = {}) {
  return trpc.patients.list.useQuery(
    {
      search:   params.search   || undefined,
      status:   params.status   || undefined,
      source:   params.source   || undefined,
      page:     params.page     ?? 1,
      pageSize: params.pageSize ?? 20,
      sortBy:   params.sortBy   ?? 'name',
      sortDir:  params.sortDir  ?? 'asc',
    },
    { placeholderData: keepPreviousData },
  );
}

/* ── Fetch: patient search ──────────────────────────────────────────────── */

export function usePatientSearch(params: Partial<SearchPatientInput> & { enabled?: boolean } = {}) {
  return trpc.patients.search.useQuery(
    {
      query:   params.query   || undefined,
      status:  params.status  || undefined,
      page:    params.page    ?? 1,
      limit:   params.limit   ?? 20,
      sort:    params.sort    ?? 'name',
      sortDir: params.sortDir ?? 'asc',
    },
    { enabled: params.enabled !== false && !!(params.query && params.query.length >= 2) },
  );
}

/* ── Fetch: patient activity ────────────────────────────────────────────── */

export function usePatientActivity(patientId: string) {
  return trpc.patients.getActivity.useQuery(
    { id: patientId },
    { staleTime: 60_000, refetchOnWindowFocus: false },
  );
}

/* ── Mutation: create patient ───────────────────────────────────────────── */

/**
 * Cria paciente e invalida automaticamente:
 *   - patients.list (para que a tabela mostre o novo registro)
 */
export function useCreatePatient() {
  const utils = trpc.useUtils();

  return trpc.patients.create.useMutation({
    onSuccess: () => {
      void utils.patients.list.invalidate();
    },
    onError: (err) => {
      if (process.env.NODE_ENV === 'development') {
        console.error('[useCreatePatient]', err);
      }
    },
  });
}

/* ── Mutation: update patient ───────────────────────────────────────────── */

/**
 * Atualiza paciente e invalida:
 *   - patients.getById  (para refletir na sidebar/prontuário)
 *   - patients.list     (para refletir nome/status na tabela)
 */
export function useUpdatePatient(patientId: string) {
  const utils = trpc.useUtils();

  return trpc.patients.update.useMutation({
    onSuccess: () => {
      void utils.patients.getById.invalidate({ id: patientId });
      void utils.patients.list.invalidate();
    },
    onError: (err) => {
      if (process.env.NODE_ENV === 'development') {
        console.error('[useUpdatePatient]', err);
      }
    },
  });
}

/* ── Mutation: delete patient ───────────────────────────────────────────── */

/**
 * Soft-delete de paciente (requer motivo).
 * Invalida patients.list após sucesso.
 */
export function useDeletePatient() {
  const utils = trpc.useUtils();

  return trpc.patients.delete.useMutation({
    onSuccess: () => {
      void utils.patients.list.invalidate();
    },
    onError: (err) => {
      if (process.env.NODE_ENV === 'development') {
        console.error('[useDeletePatient]', err);
      }
    },
  });
}
