/**
 * use-procedures.ts
 *
 * Hooks tipados para protocolos seriados e sessões.
 *
 * Endpoints consumidos:
 *   trpc.clinical.protocols.create          → useCreateProtocol
 *   trpc.clinical.protocols.update          → useUpdateProtocol
 *   trpc.clinical.protocols.cancel          → useCancelProtocol
 *   trpc.clinical.protocols.pause           → usePauseProtocol
 *   trpc.clinical.protocols.resume          → useResumeProtocol
 *   trpc.clinical.protocols.getById         → useProtocol
 *   trpc.clinical.protocols.listByPatient   → usePatientProtocols  (re-export)
 *   trpc.clinical.protocols.listActive      → useActiveProtocols
 *   trpc.clinical.protocols.listSessions    → useProtocolSessions
 *   trpc.clinical.protocols.getSessionById  → useProtocolSession
 *   trpc.clinical.protocols.registerSession → useRegisterSession
 *   trpc.clinical.protocols.suggestNextSession → useSuggestNextSession
 */

'use client';

import { trpc } from '@/lib/trpc-provider';

/* ── Queries ───────────────────────────────────────────────────────────── */

export function useProtocol(protocolId: string) {
  const query = trpc.clinical.protocols.getById.useQuery(
    { id: protocolId },
    {
      enabled: !!protocolId,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  );

  return {
    ...query,
    protocol: query.data?.protocol ?? null,
  };
}

export function usePatientProtocols(patientId: string, status?: 'ativo' | 'pausado' | 'concluido' | 'cancelado') {
  return trpc.clinical.protocols.listByPatient.useQuery(
    { patientId, status },
    { enabled: !!patientId, staleTime: 30_000 },
  );
}

export function useActiveProtocols() {
  return trpc.clinical.protocols.listActive.useQuery(undefined, {
    staleTime: 30_000,
  });
}

export function useProtocolSessions(protocolId: string) {
  return trpc.clinical.protocols.listSessions.useQuery(
    { protocolId },
    { enabled: !!protocolId, staleTime: 15_000 },
  );
}

export function useProtocolSession(sessionId: string) {
  return trpc.clinical.protocols.getSessionById.useQuery(
    { sessionId },
    { enabled: !!sessionId, staleTime: 30_000 },
  );
}

export function useSuggestNextSession(protocolId: string) {
  return trpc.clinical.protocols.suggestNextSession.useQuery(
    { protocolId },
    { enabled: !!protocolId, staleTime: 60_000 },
  );
}

/* ── Mutations ─────────────────────────────────────────────────────────── */

export function useCreateProtocol(patientId: string) {
  const utils = trpc.useUtils();

  return trpc.clinical.protocols.create.useMutation({
    onSuccess: () => {
      void utils.clinical.protocols.listByPatient.invalidate({ patientId });
      void utils.clinical.protocols.listActive.invalidate();
      void utils.clinical.encounters.getByPatient.invalidate({ patientId });
    },
  });
}

export function useUpdateProtocol(patientId: string) {
  const utils = trpc.useUtils();

  return trpc.clinical.protocols.update.useMutation({
    onSuccess: (_, vars) => {
      void utils.clinical.protocols.getById.invalidate({ id: vars.id });
      void utils.clinical.protocols.listByPatient.invalidate({ patientId });
    },
  });
}

export function useCancelProtocol(patientId: string) {
  const utils = trpc.useUtils();

  return trpc.clinical.protocols.cancel.useMutation({
    onSuccess: (_, vars) => {
      void utils.clinical.protocols.getById.invalidate({ id: vars.id });
      void utils.clinical.protocols.listByPatient.invalidate({ patientId });
      void utils.clinical.protocols.listActive.invalidate();
    },
  });
}

export function usePauseProtocol(patientId: string) {
  const utils = trpc.useUtils();

  return trpc.clinical.protocols.pause.useMutation({
    onSuccess: (_, vars) => {
      void utils.clinical.protocols.getById.invalidate({ id: vars.id });
      void utils.clinical.protocols.listByPatient.invalidate({ patientId });
    },
  });
}

export function useResumeProtocol(patientId: string) {
  const utils = trpc.useUtils();

  return trpc.clinical.protocols.resume.useMutation({
    onSuccess: (_, vars) => {
      void utils.clinical.protocols.getById.invalidate({ id: vars.id });
      void utils.clinical.protocols.listByPatient.invalidate({ patientId });
    },
  });
}

export function useRegisterSession(patientId: string, protocolId: string) {
  const utils = trpc.useUtils();

  return trpc.clinical.protocols.registerSession.useMutation({
    onSuccess: () => {
      void utils.clinical.protocols.getById.invalidate({ id: protocolId });
      void utils.clinical.protocols.listByPatient.invalidate({ patientId });
      void utils.clinical.protocols.listSessions.invalidate({ protocolId });
      void utils.clinical.protocols.suggestNextSession.invalidate({ protocolId });
      void utils.clinical.protocols.listActive.invalidate();
      void utils.clinical.encounters.getByPatient.invalidate({ patientId });
    },
  });
}
