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
}

export function ProntuarioTabs({ value, onChange }: ProntuarioTabsProps) {
  return (
    <nav
      aria-label="Seções do prontuário"
      style={{
        padding: '0 24px',
        borderBottom: `1px solid ${T.divider}`,
        display: 'flex',
        gap: 0,
        flexShrink: 0,
        overflowX: 'auto',
        background: '#F5F5F5',
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
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              borderTop: 'none',
              borderRight: 'none',
              borderLeft: 'none',
              borderBottom: `2px solid ${active ? '#004D40' : 'transparent'}`,
              background: 'transparent',
              color: active ? '#004D40' : '#6C757D',
              fontSize: 13,
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            <Ico name={t.icon} size={15} color={active ? '#004D40' : '#6C757D'} />
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
