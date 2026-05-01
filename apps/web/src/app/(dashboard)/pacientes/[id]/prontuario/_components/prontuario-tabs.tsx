'use client';

import * as React from 'react';
import { TabBar, type TabItem } from '@dermaos/ui/ds';

export type ProntuarioTabId =
  | 'resumo'
  | 'consultas'
  | 'prescricoes'
  | 'procedimentos'
  | 'protocolos'
  | 'imagens'
  | 'documentos'
  | 'timeline';

const TABS: TabItem[] = [
  { id: 'resumo',        label: 'Resumo',        icon: 'grid'     },
  { id: 'consultas',     label: 'Consultas',     icon: 'calendar' },
  { id: 'prescricoes',   label: 'Prescrições',   icon: 'file'     },
  { id: 'procedimentos', label: 'Procedimentos', icon: 'zap'      },
  { id: 'protocolos',    label: 'Protocolos',    icon: 'layers'   },
  { id: 'imagens',       label: 'Imagens',       icon: 'image'    },
  { id: 'documentos',    label: 'Documentos',    icon: 'file'     },
  { id: 'timeline',      label: 'Timeline',      icon: 'clock'    },
];

interface ProntuarioTabsProps {
  value: ProntuarioTabId;
  onChange: (tab: ProntuarioTabId) => void;
  trailing?: React.ReactNode;
}

export function ProntuarioTabs({ value, onChange, trailing }: ProntuarioTabsProps) {
  return (
    <TabBar
      tabs={TABS}
      activeId={value}
      onChange={(id) => onChange(id as ProntuarioTabId)}
      module="clinical"
      trailing={trailing}
    />
  );
}
