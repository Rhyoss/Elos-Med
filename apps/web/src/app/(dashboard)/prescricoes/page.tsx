'use client';

import { PageHero, T, Ico } from '@dermaos/ui/ds';

/**
 * Prescrições — listagem global de prescrições.
 * TODO: implementar listagem com filtros (paciente, período, status).
 * Backend: trpc.clinical.prescriptions.list já existe dentro do prontuário.
 */
export default function PrescricoesPage() {
  return (
    <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
      <PageHero
        eyebrow="Clínico"
        title="Prescrições"
        description="Visão consolidada de todas as prescrições emitidas"
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 24px',
          textAlign: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: T.primaryBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ico name="file" size={24} color={T.primary} />
        </div>
        <p style={{ fontSize: 15, color: T.textSecondary, maxWidth: 380 }}>
          A listagem global de prescrições estará disponível em breve. Por enquanto, acesse prescrições pelo prontuário do paciente.
        </p>
      </div>
    </div>
  );
}
