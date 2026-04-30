'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { trpc } from '@/lib/trpc-provider';
import { T, Ico } from '@dermaos/ui/ds';

/**
 * Atendimento — atalho top-level que redireciona para o prontuário do paciente.
 * Resolve o patientId via trpc.clinical.encounters.getById e navega para
 * /pacientes/[patientId]/prontuario/consulta/[encounterId].
 */
export default function AtendimentoRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const encounterId = typeof params?.encounterId === 'string' ? params.encounterId : '';

  const encounterQuery = trpc.clinical.encounters.getById.useQuery(
    { id: encounterId },
    { enabled: !!encounterId },
  );

  const encounter = encounterQuery.data?.encounter;

  useEffect(() => {
    const pid = (encounter as Record<string, unknown> | undefined)?.patient_id as string | undefined;
    if (pid) {
      router.replace(
        `/pacientes/${pid}/prontuario/consulta/${encounterId}`,
      );
    }
  }, [encounter, encounterId, router]);

  if (encounterQuery.isError) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 24px',
          textAlign: 'center',
          gap: 12,
          flex: 1,
        }}
      >
        <Ico name="alert" size={32} color={T.danger} />
        <p style={{ fontSize: 15, color: T.textSecondary }}>
          Atendimento não encontrado.
        </p>
        <button
          type="button"
          onClick={() => router.push('/agenda')}
          style={{
            marginTop: 8,
            padding: '8px 16px',
            borderRadius: 8,
            background: T.primary,
            color: '#fff',
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Voltar para Agenda
        </button>
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
      Carregando atendimento...
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
