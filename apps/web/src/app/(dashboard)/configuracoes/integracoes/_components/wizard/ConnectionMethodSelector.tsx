'use client';

import * as React from 'react';
import { Glass, Ico, Mono, T } from '@dermaos/ui/ds';
import type { ConnectionMethod, ConnectionMethodId } from '../../_lib/wizard-config';

interface ConnectionMethodSelectorProps {
  methods: ConnectionMethod[];
  selected: ConnectionMethodId | null;
  onSelect: (id: ConnectionMethodId) => void;
}

export function ConnectionMethodSelector({ methods, selected, onSelect }: ConnectionMethodSelectorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 15, color: T.textPrimary, fontWeight: 600, marginBottom: 4 }}>
        Método de conexão
      </p>
      <p style={{ fontSize: 13, color: T.textSecondary, marginBottom: 8 }}>
        Escolha como você deseja conectar este canal ao ElosMed.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {methods.map((m) => {
          const isSelected = selected === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m.id)}
              aria-pressed={isSelected}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '16px 18px',
                borderRadius: T.r.lg,
                background: isSelected ? T.primaryBg : T.glass,
                border: `1.5px solid ${isSelected ? T.primary : T.glassBorder}`,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.18s ease',
                outline: 'none',
                boxShadow: isSelected ? `0 0 0 3px ${T.primaryRing}` : 'none',
              }}
              onFocus={(e) => {
                if (!isSelected) e.currentTarget.style.boxShadow = `0 0 0 3px ${T.primaryRing}`;
              }}
              onBlur={(e) => {
                if (!isSelected) e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: T.r.md,
                  background: isSelected ? T.primaryBg : 'rgba(200,200,200,0.12)',
                  border: `1px solid ${isSelected ? T.primaryBorder : T.divider}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Ico name={m.icon} size={18} color={isSelected ? T.primary : T.textMuted} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                    {m.label}
                  </span>
                  {m.recommended && (
                    <Mono
                      size={9}
                      color={T.success}
                      style={{
                        background: T.successBg,
                        border: `1px solid ${T.successBorder}`,
                        padding: '2px 6px',
                        borderRadius: T.r.sm,
                      }}
                    >
                      RECOMENDADO
                    </Mono>
                  )}
                </div>
                <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 3, lineHeight: 1.45 }}>
                  {m.description}
                </p>
              </div>

              <div
                aria-hidden
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: `2px solid ${isSelected ? T.primary : T.glassBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {isSelected && (
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: T.primary }} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
