'use client';
import * as React from 'react';
import { T } from '../../tokens';
import { Badge } from './Badge';
import { Glass } from './Glass';
import { Ico } from './Ico';
import { Mono } from './Mono';

export interface EncounterCardProps {
  id: string;
  type: string;
  date: string;
  doctor?: string;
  status?: { label: string; variant?: 'default' | 'success' | 'warning' | 'danger' };
  chiefComplaint?: string;
  diagnosis?: string;
  notes?: string;
  plan?: string;
  /** Open state (controlled). */
  expanded?: boolean;
  /** Toggle handler. If omitted, the card stays in its `expanded` state. */
  onToggle?: () => void;
}

/**
 * Collapsible clinical encounter card. Header shows type/date/doctor + status
 * badge; expanded body shows chief complaint, diagnosis, notes, plan in a
 * 2-col grid.
 */
export function EncounterCard({
  type,
  date,
  doctor,
  status,
  chiefComplaint,
  diagnosis,
  notes,
  plan,
  expanded,
  onToggle,
}: EncounterCardProps) {
  return (
    <Glass hover style={{ padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          width: '100%',
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'transparent',
          border: 'none',
          cursor: onToggle ? 'pointer' : 'default',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: T.r.md,
              background: T.clinical.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ico name="calendar" size={16} color={T.clinical.color} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: 0 }}>
              {type}
            </p>
            <Mono size={9}>
              {date}
              {doctor && ` · ${doctor}`}
            </Mono>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {status && (
            <Badge variant={status.variant ?? 'default'} dot={false}>
              {status.label}
            </Badge>
          )}
          {onToggle && (
            <Ico
              name="chevDown"
              size={16}
              color={T.textMuted}
            />
          )}
        </div>
      </button>
      {expanded && (
        <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${T.divider}` }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: chiefComplaint && diagnosis ? '1fr 1fr' : '1fr',
              gap: 10,
              marginTop: 14,
            }}
          >
            {chiefComplaint && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: T.r.md,
                  background: T.primaryBg,
                  border: `1px solid ${T.primaryBorder}`,
                }}
              >
                <Mono size={7} color={T.primary}>
                  QUEIXA PRINCIPAL
                </Mono>
                <p
                  style={{
                    fontSize: 12,
                    color: T.textPrimary,
                    margin: '4px 0 0',
                    lineHeight: 1.5,
                  }}
                >
                  {chiefComplaint}
                </p>
              </div>
            )}
            {diagnosis && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: T.r.md,
                  background: T.glass,
                  border: `1px solid ${T.glassBorder}`,
                }}
              >
                <Mono size={7}>DIAGNÓSTICO</Mono>
                <p style={{ fontSize: 12, color: T.textPrimary, margin: '4px 0 0' }}>
                  {diagnosis}
                </p>
              </div>
            )}
          </div>
          {notes && (
            <div
              style={{
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: T.r.md,
                background: T.glass,
                border: `1px solid ${T.glassBorder}`,
              }}
            >
              <Mono size={7}>OBSERVAÇÕES CLÍNICAS</Mono>
              <p
                style={{
                  fontSize: 12,
                  color: T.textSecondary,
                  margin: '4px 0 0',
                  lineHeight: 1.6,
                }}
              >
                {notes}
              </p>
            </div>
          )}
          {plan && (
            <div
              style={{
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: T.r.md,
                background: T.clinical.bg,
                border: `1px solid ${T.clinical.color}15`,
              }}
            >
              <Mono size={7} color={T.clinical.color}>
                PLANO DE TRATAMENTO
              </Mono>
              <p
                style={{
                  fontSize: 12,
                  color: T.textPrimary,
                  margin: '4px 0 0',
                  lineHeight: 1.6,
                }}
              >
                {plan}
              </p>
            </div>
          )}
        </div>
      )}
    </Glass>
  );
}
