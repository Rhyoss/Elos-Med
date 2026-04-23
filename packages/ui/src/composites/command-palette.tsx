'use client';

import * as React from 'react';
import { Command } from 'cmdk';
import { Search, Clock, User, Calendar, Package, Zap, X } from 'lucide-react';
import { cn } from '../utils.js';

/* ── Tipos ──────────────────────────────────────────────────────────────── */

export interface CommandItem {
  id: string;
  label: string;
  subtitle?: string;
  group: 'patients' | 'appointments' | 'products' | 'quick-actions';
  onSelect: () => void;
  icon?: React.ReactNode;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items?: CommandItem[];
  onSearch?: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

/* ── Ícones por grupo ────────────────────────────────────────────────────── */

const groupConfig = {
  patients:      { label: 'Pacientes', icon: User },
  appointments:  { label: 'Agendamentos', icon: Calendar },
  products:      { label: 'Produtos', icon: Package },
  'quick-actions': { label: 'Ações Rápidas', icon: Zap },
} as const;

/* ── Histórico de buscas recentes ────────────────────────────────────────── */

function useRecentSearches(maxItems = 5) {
  const [recents, setRecents] = React.useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('dermaos-cmd-recents') ?? '[]');
    } catch {
      return [];
    }
  });

  function addRecent(query: string) {
    if (!query.trim()) return;
    setRecents((prev) => {
      const updated = [query, ...prev.filter((r) => r !== query)].slice(0, maxItems);
      localStorage.setItem('dermaos-cmd-recents', JSON.stringify(updated));
      return updated;
    });
  }

  return { recents, addRecent };
}

/* ── Componente ──────────────────────────────────────────────────────────── */

export function CommandPalette({
  open,
  onOpenChange,
  items = [],
  onSearch,
  isLoading,
  placeholder = 'Buscar pacientes, agendamentos, produtos…',
}: CommandPaletteProps) {
  const [query, setQuery] = React.useState('');
  const { recents, addRecent } = useRecentSearches();

  /* Cmd+K / Ctrl+K para abrir/fechar */
  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  /* Limpa a query ao fechar */
  React.useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  function handleSelect(item: CommandItem) {
    addRecent(item.label);
    item.onSelect();
    onOpenChange(false);
  }

  /* Agrupa itens por grupo */
  const groups = React.useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of items) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return map;
  }, [items]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-start justify-center pt-20"
      style={{ zIndex: 'var(--z-modal)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Busca global"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-bg-overlay/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Painel */}
      <div className="relative w-full max-w-xl mx-4">
        <Command
          className={cn(
            'rounded-xl border bg-popover shadow-xl overflow-hidden',
          )}
          shouldFilter={!onSearch}
          onKeyDown={(e) => { if (e.key === 'Escape') onOpenChange(false); }}
        >
          {/* Input */}
          <div className="flex items-center gap-2 px-3 border-b">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <Command.Input
              value={query}
              onValueChange={(v) => { setQuery(v); onSearch?.(v); }}
              placeholder={placeholder}
              className={cn(
                'flex-1 py-3 text-sm bg-transparent outline-none placeholder:text-muted-foreground',
              )}
              aria-label="Buscar"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Limpar busca"
                className="p-0.5 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            <kbd
              className="hidden sm:flex items-center gap-0.5 text-xs text-muted-foreground border rounded px-1.5 py-0.5 bg-muted"
              aria-label="Tecla Escape para fechar"
            >
              Esc
            </kbd>
          </div>

          {/* Lista */}
          <Command.List className="max-h-[380px] overflow-y-auto p-2">
            {isLoading && (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" aria-hidden="true" />
                Buscando…
              </div>
            )}

            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              Nenhum resultado para "{query}"
            </Command.Empty>

            {/* Buscas recentes (quando sem query) */}
            {!query && recents.length > 0 && (
              <Command.Group
                heading={
                  <span className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    Recentes
                  </span>
                }
              >
                {recents.map((r) => (
                  <Command.Item
                    key={r}
                    value={r}
                    onSelect={() => { setQuery(r); onSearch?.(r); }}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer',
                      'text-foreground hover:bg-hover data-[selected=true]:bg-hover',
                    )}
                  >
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    {r}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Resultados por grupo */}
            {Array.from(groups.entries()).map(([groupKey, groupItems]) => {
              const cfg = groupConfig[groupKey as keyof typeof groupConfig];
              const GroupIcon = cfg?.icon ?? Zap;

              return (
                <Command.Group
                  key={groupKey}
                  heading={
                    <span className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <GroupIcon className="h-3 w-3" aria-hidden="true" />
                      {cfg?.label ?? groupKey}
                    </span>
                  }
                >
                  {groupItems.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={`${item.label} ${item.subtitle ?? ''}`}
                      onSelect={() => handleSelect(item)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer',
                        'text-foreground hover:bg-hover data-[selected=true]:bg-selected',
                      )}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0 [&_svg]:size-4">
                        {item.icon ?? <GroupIcon aria-hidden="true" />}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate">{item.label}</span>
                        {item.subtitle && (
                          <span className="text-xs text-muted-foreground truncate">{item.subtitle}</span>
                        )}
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>

          {/* Footer com atalho */}
          <div className="flex items-center gap-3 px-3 py-2 border-t text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="border rounded px-1 py-0.5 bg-muted">↑</kbd>
              <kbd className="border rounded px-1 py-0.5 bg-muted">↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="border rounded px-1 py-0.5 bg-muted">↵</kbd>
              selecionar
            </span>
            <span className="flex items-center gap-1 ml-auto">
              <kbd className="border rounded px-1 py-0.5 bg-muted">⌘K</kbd>
              abrir/fechar
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
