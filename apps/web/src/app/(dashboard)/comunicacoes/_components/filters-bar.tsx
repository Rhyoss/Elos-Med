'use client';

import * as React from 'react';
import { Input, Mono, T } from '@dermaos/ui/ds';

export type AssignmentFilter = 'mine' | 'team' | 'ai' | 'unassigned' | 'all';
export type ChannelTypeFilter = 'whatsapp' | 'instagram' | 'email' | 'sms' | 'webchat' | 'phone' | 'all';

export interface FiltersBarProps {
  assignment:    AssignmentFilter;
  onAssignment:  (value: AssignmentFilter) => void;
  channelType:   ChannelTypeFilter;
  onChannelType: (value: ChannelTypeFilter) => void;
  search:        string;
  onSearch:      (value: string) => void;
}

const ASSIGNMENT_OPTIONS: Array<{ value: AssignmentFilter; label: string }> = [
  { value: 'all',        label: 'Todas' },
  { value: 'mine',       label: 'Minhas' },
  { value: 'team',       label: 'Equipe' },
  { value: 'ai',         label: 'IA' },
  { value: 'unassigned', label: 'Não atribuídas' },
];

const CHANNEL_OPTIONS: Array<{ value: ChannelTypeFilter; label: string }> = [
  { value: 'all',       label: 'Todos' },
  { value: 'whatsapp',  label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'email',     label: 'E-mail' },
  { value: 'sms',       label: 'SMS' },
  { value: 'webchat',   label: 'Chat' },
  { value: 'phone',     label: 'Telefone' },
];

function PillToggle({
  active,
  size,
  onClick,
  children,
  pressed,
}: {
  active: boolean;
  size: 'sm' | 'xs';
  onClick: () => void;
  children: React.ReactNode;
  pressed: boolean;
}) {
  const isLarge = size === 'sm';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      style={{
        padding: isLarge ? '4px 12px' : '2px 10px',
        borderRadius: T.r.pill,
        background: active ? T.primary : T.glass,
        color: active ? T.textInverse : T.textSecondary,
        border: `1px solid ${active ? T.primary : T.glassBorder}`,
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: isLarge ? 11 : 10,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

export function FiltersBar({
  assignment,
  onAssignment,
  channelType,
  onChannelType,
  search,
  onSearch,
}: FiltersBarProps) {
  const [localSearch, setLocalSearch] = React.useState(search);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  function handleSearchChange(value: string) {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.length === 0 || value.length >= 3) onSearch(value);
    }, 300);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 12px',
        borderBottom: `1px solid ${T.divider}`,
        background: T.glass,
        backdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
        WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
        flexShrink: 0,
      }}
    >
      <Input
        leadingIcon="search"
        type="search"
        value={localSearch}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="Buscar por nome ou telefone (mín. 3)…"
        aria-label="Buscar conversas"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Mono size={7} spacing="1px">ATRIBUIÇÃO</Mono>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {ASSIGNMENT_OPTIONS.map((opt) => (
            <PillToggle
              key={opt.value}
              active={assignment === opt.value}
              pressed={assignment === opt.value}
              size="sm"
              onClick={() => onAssignment(opt.value)}
            >
              {opt.label}
            </PillToggle>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Mono size={7} spacing="1px">CANAL</Mono>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {CHANNEL_OPTIONS.map((opt) => (
            <PillToggle
              key={opt.value}
              active={channelType === opt.value}
              pressed={channelType === opt.value}
              size="xs"
              onClick={() => onChannelType(opt.value)}
            >
              {opt.label}
            </PillToggle>
          ))}
        </div>
      </div>
    </div>
  );
}
