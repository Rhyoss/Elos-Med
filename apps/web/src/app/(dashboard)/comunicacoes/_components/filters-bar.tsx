'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AssignmentFilter = 'mine' | 'team' | 'ai' | 'unassigned' | 'all';
export type ChannelTypeFilter = 'whatsapp' | 'instagram' | 'email' | 'sms' | 'webchat' | 'phone' | 'all';

export interface FiltersBarProps {
  assignment:     AssignmentFilter;
  onAssignment:   (value: AssignmentFilter) => void;
  channelType:    ChannelTypeFilter;
  onChannelType:  (value: ChannelTypeFilter) => void;
  search:         string;
  onSearch:       (value: string) => void;
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
      // Mínimo 3 caracteres (ou vazio para limpar)
      if (value.length === 0 || value.length >= 3) onSearch(value);
    }, 300);
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border bg-background p-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          value={localSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Buscar por nome ou telefone (mín. 3)…"
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Buscar conversas"
        />
        {localSearch && (
          <button
            type="button"
            onClick={() => handleSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {ASSIGNMENT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onAssignment(opt.value)}
            className={cn(
              'rounded-full px-3 py-1 text-xs transition-colors',
              assignment === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70',
            )}
            aria-pressed={assignment === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {CHANNEL_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChannelType(opt.value)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-[10px] transition-colors',
              channelType === opt.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted/60',
            )}
            aria-pressed={channelType === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
