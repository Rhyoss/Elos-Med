'use client';

import * as React from 'react';
import { Ico, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';

interface PatientPickerProps {
  value: { id: string; name: string } | null;
  onChange: (patient: { id: string; name: string } | null) => void;
  disabled?: boolean;
  error?: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 13px',
  paddingLeft: 34,
  borderRadius: T.r.md,
  background: T.inputBg,
  border: `1px solid ${T.inputBorder}`,
  fontSize: 14,
  color: T.textPrimary,
  fontFamily: "'IBM Plex Sans', sans-serif",
  outline: 'none',
};

export function PatientPicker({ value, onChange, disabled, error }: PatientPickerProps) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen]   = React.useState(false);
  const [debounced, setDebounced] = React.useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const listQ = trpc.patients.list.useQuery(
    { search: debounced || undefined, page: 1, pageSize: 8 },
    { enabled: open && debounced.length >= 2, staleTime: 30_000 },
  );
  const items = listQ.data?.data ?? [];

  if (value) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: T.r.md,
          background: T.successBg,
          border: `1px solid ${T.successBorder}`,
        }}
      >
        <Ico name="user" size={16} color={T.success} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: T.textPrimary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {value.name}
          </p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Trocar paciente"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
            }}
          >
            <Ico name="x" size={14} color={T.textMuted} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 11,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          display: 'flex',
        }}
      >
        <Ico name="search" size={14} color={T.textMuted} />
      </span>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={disabled}
        placeholder="Buscar paciente por nome…"
        autoComplete="off"
        style={{
          ...inputStyle,
          borderColor: error ? T.danger : T.inputBorder,
        }}
      />

      {open && debounced.length >= 2 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 10,
            background: 'white',
            border: `1px solid ${T.divider}`,
            borderRadius: T.r.md,
            boxShadow: '0 12px 28px rgba(0,0,0,0.1)',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {listQ.isLoading ? (
            <p style={{ fontSize: 12, color: T.textMuted, padding: '14px 16px' }}>
              Buscando…
            </p>
          ) : items.length === 0 ? (
            <p style={{ fontSize: 12, color: T.textMuted, padding: '14px 16px' }}>
              Nenhum paciente encontrado.
            </p>
          ) : (
            items.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange({ id: p.id, name: p.name });
                  setOpen(false);
                  setQuery('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  borderBottom: `1px solid ${T.divider}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = T.metalGrad;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Ico name="user" size={14} color={T.textMuted} />
                <span style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500 }}>
                  {p.name}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
