'use client';

import { PageHero, T, Ico } from '@dermaos/ui/ds';

/**
 * Procedimentos — listagem global de procedimentos.
 * TODO: implementar listagem com filtros (tipo, período, profissional).
 * Backend: tabelas de procedimentos existem (clinical.encounters + items).
 */
export default function ProcedimentosPage() {
  return (
    <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
      <PageHero
        eyebrow="Clínico"
        title="Procedimentos"
        description="Catálogo e histórico de procedimentos realizados"
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
          <Ico name="activity" size={24} color={T.primary} />
        </div>
        <p style={{ fontSize: 15, color: T.textSecondary, maxWidth: 380 }}>
          O catálogo de procedimentos estará disponível em breve. Por enquanto, procedimentos são registrados dentro de cada consulta no prontuário.
        </p>
      </div>
    </div>
  );
}
