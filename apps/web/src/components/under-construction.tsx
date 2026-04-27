'use client';

import type { ReactNode } from 'react';
import {
  Glass, Mono, Ico, EmptyState, Bar,
  PageHero, T,
} from '@dermaos/ui/ds';

/**
 * Roadmap progress — atualizar manualmente conforme features migram.
 * Single source of truth para todos os stubs (21 telas) saberem o status
 * geral da plataforma.
 *
 * Phase 4: DS Quite Clear aplicado em todas as 9 root routes.
 * Phase 5a: organização (_archive/) + reserva técnica.
 * Phase 5b: backend wire-up (financial/analytics/settings) + auth fixes.
 * Phase 5c: form migrations + sub-routes profundas (em andamento).
 * Phase 5d: features especializadas (DRE, faturas, auditoria, IA config).
 */
const ROADMAP_PHASES: Array<{ id: string; label: string; status: 'done' | 'wip' | 'todo' }> = [
  { id: '4',  label: 'DS Quite Clear',                 status: 'done' },
  { id: '5a', label: 'Organização + reserva técnica',  status: 'done' },
  { id: '5b', label: 'Backend wire-up (Phase 5b)',     status: 'done' },
  { id: '5c', label: 'Forms + sub-rotas profundas',    status: 'wip'  },
  { id: '5d', label: 'Features especializadas',        status: 'todo' },
];

function roadmapPercent(): number {
  const total  = ROADMAP_PHASES.length;
  const done   = ROADMAP_PHASES.filter((p) => p.status === 'done').length;
  const wip    = ROADMAP_PHASES.filter((p) => p.status === 'wip').length;
  return Math.round(((done + wip * 0.5) / total) * 100);
}

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

        {/* ── Roadmap progress bar ─────────────────────────────────────── */}
        <div style={{ marginTop: 28, paddingTop: 18, borderTop: `1px solid ${T.divider}` }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 10,
            }}
          >
            <Mono size={9} spacing="1.2px" color={T.primary}>
              ROADMAP DA PLATAFORMA
            </Mono>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>
              {roadmapPercent()}%
            </span>
          </div>
          <Bar pct={roadmapPercent()} color={T.primary} height={6} />

          <div
            style={{
              marginTop: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 8,
            }}
          >
            {ROADMAP_PHASES.map((phase) => {
              const tone =
                phase.status === 'done' ? T.success
                : phase.status === 'wip' ? T.warning
                : T.textMuted;
              const icon: 'shield' | 'clock' | 'eye' =
                phase.status === 'done' ? 'shield'
                : phase.status === 'wip' ? 'clock'
                : 'eye';
              const statusLabel =
                phase.status === 'done' ? 'CONCLUÍDA'
                : phase.status === 'wip' ? 'EM ANDAMENTO'
                : 'A SEGUIR';
              return (
                <div
                  key={phase.id}
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
                  <Ico name={icon} size={14} color={tone} />
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: T.textPrimary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      Phase {phase.id} · {phase.label}
                    </p>
                    <Mono size={7} color={tone}>{statusLabel}</Mono>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Glass>
    </div>
  );
}
