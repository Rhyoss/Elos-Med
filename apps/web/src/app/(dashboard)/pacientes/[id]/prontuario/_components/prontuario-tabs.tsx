'use client';

import * as React from 'react';
import { Ico, T } from '@dermaos/ui/ds';

export type ProntuarioTabId =
  | 'resumo'
  | 'consultas'
  | 'prescricoes'
  | 'protocolos'
  | 'imagens'
  | 'timeline';

interface TabDef {
  id: ProntuarioTabId;
  label: string;
  icon: 'grid' | 'calendar' | 'file' | 'layers' | 'image' | 'clock';
}

const TABS: TabDef[] = [
  { id: 'resumo',      label: 'Resumo',      icon: 'grid'     },
  { id: 'consultas',   label: 'Consultas',   icon: 'calendar' },
  { id: 'prescricoes', label: 'Prescrições', icon: 'file'     },
  { id: 'protocolos',  label: 'Protocolos',  icon: 'layers'   },
  { id: 'imagens',     label: 'Imagens',     icon: 'image'    },
  { id: 'timeline',    label: 'Timeline',    icon: 'clock'    },
];

interface ProntuarioTabsProps {
  value: ProntuarioTabId;
  onChange: (tab: ProntuarioTabId) => void;
  trailing?: React.ReactNode;
}

export function ProntuarioTabs({ value, onChange, trailing }: ProntuarioTabsProps) {
  return (
    <nav
      aria-label="Seções do prontuário"
      style={{
        padding: '0 20px',
        borderBottom: `1px solid ${T.divider}`,
        display: 'flex',
        gap: 0,
        flexShrink: 0,
        overflowX: 'auto',
      }}
    >
      {TABS.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-current={active ? 'page' : undefined}
            style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderTop: 'none',
              borderRight: 'none',
              borderLeft: 'none',
              borderBottom: `2px solid ${active ? T.primary : 'transparent'}`,
              background: 'transparent',
              color: active ? T.primary : T.textMuted,
              fontSize: 12,
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            <Ico name={t.icon} size={14} color={active ? T.primary : T.textMuted} />
            {t.label}
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
      {trailing && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 0' }}>{trailing}</div>
      )}
    </nav>
  );
}
