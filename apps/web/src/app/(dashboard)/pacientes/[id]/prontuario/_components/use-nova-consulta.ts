'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { trpc } from '@/lib/trpc-provider';

/**
 * useNovaConsulta — "Nova Consulta" + detecção de rascunho ativo.
 *
 * - Se há um encounter `rascunho` ou `revisao` aberto para o paciente,
 *   expõe `hasOpenDraft = true` e `openDraftId`. A UI mostra
 *   "Continuar Atendimento" ao invés de criar nova consulta (evita duplicação).
 * - Caso contrário, `startEncounter()` cria appointment walk-in + encounter
 *   draft e redireciona para o editor.
 *
 * Invalidações após sucesso:
 *   - scheduling.agendaDay              (novo appointment aparece na agenda)
 *   - clinical.encounters.getByPatient  (novo rascunho aparece no prontuário)
 *   - patients.getById                  (lastVisitAt pode mudar)
 */
const DRAFT_STATUSES = new Set(['rascunho', 'revisao']);

export function useNovaConsulta(patientId: string) {
  const router = useRouter();
  const user   = useAuthStore((s) => s.user);
  const utils  = trpc.useUtils();

  const providersQ        = trpc.scheduling.listProviders.useQuery();
  const recentEncountersQ = trpc.clinical.encounters.getByPatient.useQuery({
    patientId,
    page:     1,
    pageSize: 10,
  });

  const createAppointmentMut = trpc.scheduling.create.useMutation();
  const createEncounterMut   = trpc.clinical.encounters.create.useMutation();

  const openDraft    = recentEncountersQ.data?.data.find((e) => DRAFT_STATUSES.has(e.status));
  const hasOpenDraft = !!openDraft;
  const openDraftId  = openDraft?.id ?? null;

  const isStarting =
    providersQ.isLoading ||
    createAppointmentMut.isPending ||
    createEncounterMut.isPending;

  async function startEncounter() {
    if (!user) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[useNovaConsulta] Sessão não carregada ainda');
      }
      return;
    }

    const providers  = providersQ.data?.providers ?? [];
    const providerId = providers.find((p) => p.id === user.id)?.id ?? providers[0]?.id;

    if (!providerId) {
      // TODO: substituir por toast do sistema quando disponível
      alert('Nenhum profissional ativo encontrado nesta clínica.');
      return;
    }

    try {
      const appt = await createAppointmentMut.mutateAsync({
        patientId,
        providerId,
        scheduledAt: new Date(),
        durationMin: 30,
        type:        'consultation',
        source:      'walk_in',
      });

      const enc = await createEncounterMut.mutateAsync({
        appointmentId: appt.appointment.id,
      });

      /* ── Invalidar caches para refletir novo atendimento ──────────── */
      void utils.scheduling.agendaDay.invalidate();
      void utils.clinical.encounters.getByPatient.invalidate({ patientId });
      void utils.patients.getById.invalidate({ id: patientId });

      router.push(`/pacientes/${patientId}/prontuario/consulta/${enc.encounter.id}`);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[useNovaConsulta] Falha ao iniciar:', err);
      }
      // TODO: substituir por toast do sistema quando disponível
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      alert(`Não foi possível iniciar a consulta:\n${msg}`);
    }
  }

  return {
    startEncounter,
    isStarting,
    hasOpenDraft,
    openDraftId,
  };
}
