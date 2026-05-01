'use client';

import * as React from 'react';
import { Mono, T } from '@dermaos/ui/ds';

export const ANATOMICAL_REGIONS = [
  { id: 'fronte', label: 'Fronte', group: 'face' },
  { id: 'glabela', label: 'Glabela', group: 'face' },
  { id: 'periorbital', label: 'Periorbital', group: 'face' },
  { id: 'nariz', label: 'Nariz', group: 'face' },
  { id: 'malar', label: 'Malar / Zigomático', group: 'face' },
  { id: 'labios', label: 'Lábios', group: 'face' },
  { id: 'sulco_nasogeniano', label: 'Sulco nasogeniano', group: 'face' },
  { id: 'mento', label: 'Mento / Queixo', group: 'face' },
  { id: 'mandibula', label: 'Mandíbula / Jawline', group: 'face' },
  { id: 'temporal', label: 'Temporal', group: 'face' },
  { id: 'pescoco', label: 'Pescoço', group: 'corpo' },
  { id: 'colo', label: 'Colo / Décolleté', group: 'corpo' },
  { id: 'maos', label: 'Mãos', group: 'corpo' },
  { id: 'braco', label: 'Braço', group: 'corpo' },
  { id: 'abdomen', label: 'Abdômen', group: 'corpo' },
  { id: 'costas', label: 'Costas', group: 'corpo' },
  { id: 'gluteo', label: 'Glúteo', group: 'corpo' },
  { id: 'coxa', label: 'Coxa', group: 'corpo' },
  { id: 'perna', label: 'Perna', group: 'corpo' },
  { id: 'couro_cabeludo', label: 'Couro cabeludo', group: 'cabeça' },
  { id: 'orelha', label: 'Orelha', group: 'cabeça' },
  { id: 'axilas', label: 'Axilas', group: 'corpo' },
  { id: 'regiao_intima', label: 'Região íntima', group: 'corpo' },
  { id: 'outro', label: 'Outro', group: 'outro' },
] as const;

export type AnatomicalRegionId = (typeof ANATOMICAL_REGIONS)[number]['id'];

const GROUPS: { id: string; label: string }[] = [
  { id: 'face', label: 'FACE' },
  { id: 'cabeça', label: 'CABEÇA' },
  { id: 'corpo', label: 'CORPO' },
  { id: 'outro', label: 'OUTRO' },
];

interface AnatomicalRegionSelectorProps {
  value: AnatomicalRegionId[];
  onChange: (regions: AnatomicalRegionId[]) => void;
  max?: number;
}

export function AnatomicalRegionSelector({ value, onChange, max = 10 }: AnatomicalRegionSelectorProps) {
  function toggle(id: AnatomicalRegionId) {
    if (value.includes(id)) {
      onChange(value.filter((r) => r !== id));
    } else if (value.length < max) {
      onChange([...value, id]);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {GROUPS.map((group) => {
        const regions = ANATOMICAL_REGIONS.filter((r) => r.group === group.id);
        if (regions.length === 0) return null;

        return (
          <div key={group.id}>
            <Mono size={9} spacing="1px" color={T.textMuted} style={{ marginBottom: 8 }}>
              {group.label}
            </Mono>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {regions.map((region) => {
                const selected = value.includes(region.id);
                return (
                  <button
                    key={region.id}
                    type="button"
                    onClick={() => toggle(region.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: T.r.md,
                      border: `1.5px solid ${selected ? T.clinical.color : T.glassBorder}`,
                      background: selected ? T.clinical.bg : 'rgba(255,255,255,0.5)',
                      color: selected ? T.clinical.color : T.textSecondary,
                      fontSize: 13,
                      fontWeight: selected ? 600 : 400,
                      fontFamily: "'IBM Plex Sans', sans-serif",
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {region.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {value.length > 0 && (
        <Mono size={10} color={T.textMuted}>
          {value.length} {value.length === 1 ? 'região selecionada' : 'regiões selecionadas'}
        </Mono>
      )}
    </div>
  );
}
