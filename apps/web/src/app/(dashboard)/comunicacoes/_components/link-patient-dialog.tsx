'use client';

import * as React from 'react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@dermaos/ui';
import { Input, Mono, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';

export interface LinkPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName?: string | null;
  isLinking?: boolean;
  onConfirm: (patientId: string) => void;
}

export function LinkPatientDialog({
  open,
  onOpenChange,
  contactName,
  isLinking,
  onConfirm,
}: LinkPatientDialogProps) {
  const [query, setQuery]   = React.useState('');
  const [picked, setPicked] = React.useState<{ id: string; name: string } | null>(null);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setPicked(null);
    }
  }, [open]);

  const debounced = useDebouncedValue(query, 250);

  const searchQuery = trpc.patients.search.useQuery(
    { query: debounced.trim(), page: 1, limit: 8 },
    { enabled: open && debounced.trim().length >= 2, staleTime: 15_000 },
  );

  const results = searchQuery.data?.data ?? [];

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular contato a paciente</DialogTitle>
          <DialogDescription>
            {contactName
              ? `Busque um paciente para vincular a "${contactName}".`
              : 'Busque um paciente cadastrado para vincular a este contato.'}
          </DialogDescription>
        </DialogHeader>

        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Input
            leadingIcon="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPicked(null);
            }}
            placeholder="Nome ou CPF (mín. 2)…"
            autoFocus
            aria-label="Buscar paciente"
          />

          <div
            style={{
              minHeight: 180,
              maxHeight: 240,
              overflowY: 'auto',
              border: `1px solid ${T.divider}`,
              borderRadius: T.r.md,
              background: T.glass,
            }}
          >
            {debounced.trim().length < 2 && (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <Mono size={9}>DIGITE PARA BUSCAR</Mono>
              </div>
            )}

            {debounced.trim().length >= 2 && searchQuery.isLoading && (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <Mono size={9}>BUSCANDO…</Mono>
              </div>
            )}

            {debounced.trim().length >= 2 && searchQuery.isError && (
              <div style={{ padding: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Mono size={9} color={T.danger}>FALHA NA BUSCA</Mono>
                <button
                  type="button"
                  onClick={() => searchQuery.refetch()}
                  style={{
                    fontSize: 11,
                    color: T.primary,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {debounced.trim().length >= 2 && !searchQuery.isLoading && !searchQuery.isError && results.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Mono size={9}>NENHUM PACIENTE ENCONTRADO</Mono>
                <a
                  href={`/pacientes/novo?nome=${encodeURIComponent(query)}`}
                  style={{ fontSize: 11, color: T.primary, fontWeight: 600 }}
                >
                  Cadastrar novo paciente →
                </a>
              </div>
            )}

            {results.length > 0 && (
              <ul role="listbox" aria-label="Resultados">
                {results.map((p) => {
                  const isPicked = picked?.id === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isPicked}
                        onClick={() => setPicked({ id: p.id, name: p.name })}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 12px',
                          background: isPicked ? T.primaryBg : 'transparent',
                          border: 'none',
                          borderBottom: `1px solid ${T.divider}`,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          fontFamily: "'IBM Plex Sans', sans-serif",
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>
                          {p.name}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: T.textMuted,
                            fontFamily: "'IBM Plex Mono', monospace",
                          }}
                        >
                          {p.cpfMasked ?? '—'} {p.phone ? `· ${p.phone}` : ''} {p.age != null ? `· ${p.age} anos` : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLinking}>
            Cancelar
          </Button>
          <Button
            disabled={!picked || isLinking}
            onClick={() => picked && onConfirm(picked.id)}
          >
            {isLinking ? 'Vinculando…' : 'Vincular'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
