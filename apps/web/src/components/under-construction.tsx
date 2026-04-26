'use client';

import type { ReactNode } from 'react';
import {
  Glass, Mono, Ico, EmptyState,
  PageHero, T,
} from '@dermaos/ui/ds';

interface UnderConstructionProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Optional module accent (matches the parent route's color). */
  module?: 'clinical' | 'aiMod' | 'supply' | 'financial' | 'accentMod';
  /** Optional eyebrow (e.g. "EM PRODUÇÃO · ROADMAP Q2 2026"). */
  eyebrow?: ReactNode;
  /** Optional icon for the PageHero tile. */
  icon?: 'grid' | 'calendar' | 'user' | 'users' | 'message' | 'box' | 'creditCard'
    | 'barChart' | 'settings' | 'shield' | 'zap' | 'activity' | 'layers'
    | 'clock' | 'eye' | 'file' | 'globe' | 'lock' | 'hash' | 'percent';
}

/**
 * UnderConstruction — placeholder page with full DS chrome (Quite Clear).
 * Used by 22 sub-routes still on the Phase-5 backlog.
 */
export function UnderConstruction({
  title,
  description,
  actions,
  module,
  eyebrow,
  icon,
}: UnderConstructionProps) {
  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '22px 26px' }}>
      <PageHero
        eyebrow={eyebrow ?? 'EM PRODUÇÃO · DS QUITE CLEAR'}
        title={title}
        module={module}
        icon={icon}
        description={description}
        actions={actions}
      />

      <Glass style={{ padding: '40px 24px' }}>
        <EmptyState
          icon="layers"
          label="EM CONSTRUÇÃO"
          title="Esta seção está sendo finalizada"
          description={
            <>
              O módulo já tem chrome DS Quite Clear, mas o miolo (formulários, tabelas,
              integrações) está sendo migrado. Acompanhe o progresso na sidebar e use os
              módulos vizinhos enquanto isso.
            </>
          }
          tone="primary"
        />

        <div
          style={{
            marginTop: 24,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 8,
          }}
        >
          {[
            { l: 'DS aplicado',     d: 'Chrome Quite Clear' },
            { l: 'tRPC plumbing',   d: 'Backend pronto' },
            { l: 'UI legacy',       d: 'Em migração' },
            { l: 'Roadmap',         d: 'Phase 5b' },
          ].map((item) => (
            <div
              key={item.l}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: T.r.md,
                background: T.glass,
                border: `1px solid ${T.glassBorder}`,
              }}
            >
              <Ico name="shield" size={14} color={T.primary} />
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary }}>
                  {item.l}
                </p>
                <Mono size={7}>{item.d}</Mono>
              </div>
            </div>
          ))}
        </div>
      </Glass>
    </div>
  );
}
