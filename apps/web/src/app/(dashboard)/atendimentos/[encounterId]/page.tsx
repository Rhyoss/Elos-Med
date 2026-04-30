'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { trpc } from '@/lib/trpc-provider';
import { Btn, Glass, Ico, T } from '@dermaos/ui/ds';

/**
 * Atendimento — atalho top-level que redireciona para o prontuário do paciente.
 *
 * Resolve patientId via trpc.clinical.encounters.getById (campo `patientId`
 * retornado por EncounterPublic) e navega para:
 *   /pacientes/[patientId]/prontuario/consulta/[encounterId]
 *
 * encounterId inválido (não-UUID ou not found) exibe NotFound com CTA.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AtendimentoRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const encounterId = typeof params?.encounterId === 'string' ? params.encounterId : '';

  const isValidUuid = UUID_REGEX.test(encounterId);

  const encounterQuery = trpc.clinical.encounters.getById.useQuery(
    { id: encounterId },
    {
      enabled: isValidUuid,
      retry: (count, err) => {
        const code = (err as { data?: { code?: string } })?.data?.code;
        if (code === 'NOT_FOUND' || code === 'FORBIDDEN') return false;
        return count < 2;
      },
    },
  );

  const encounter = encounterQuery.data?.encounter;

  useEffect(() => {
    // encounter.patientId é o campo camelCase de EncounterPublic
    const pid = encounter?.patientId;
    if (pid) {
      router.replace(`/pacientes/${pid}/prontuario/consulta/${encounterId}`);
    }
  }, [encounter, encounterId, router]);

  if (!isValidUuid || encounterQuery.isError) {
    const code = (encounterQuery.error as { data?: { code?: string } } | null)?.data?.code;
    const message = code === 'NOT_FOUND'
      ? 'Atendimento não encontrado.'
      : 'Não foi possível carregar o atendimento.';

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 24px',
          textAlign: 'center',
          gap: 16,
          flex: 1,
        }}
      >
        <Glass
          style={{
            padding: '40px 48px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            maxWidth: 400,
          }}
        >
          <Ico name="alert" size={28} color={T.danger} />
          <p style={{ fontSize: 15, color: T.textSecondary }}>{message}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="glass" small icon="arrowLeft" onClick={() => router.push('/agenda')}>
              Voltar para Agenda
            </Btn>
            {encounterQuery.isError && !['NOT_FOUND', 'FORBIDDEN'].includes(code ?? '') && (
              <Btn variant="ghost" small icon="activity" onClick={() => void encounterQuery.refetch()}>
                Tentar novamente
              </Btn>
            )}
          </div>
        </Glass>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        gap: 10,
        color: T.textMuted,
        fontSize: 14,
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          border: `2px solid ${T.primary}`,
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      Carregando atendimento…
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
