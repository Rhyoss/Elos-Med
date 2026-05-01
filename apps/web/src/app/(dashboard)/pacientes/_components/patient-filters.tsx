'use client';

import * as React from 'react';
import { Input, Select, Btn, Mono, Ico, Badge, T } from '@dermaos/ui/ds';

/* ── Source options ────────────────────────────────────────────────────── */

const SOURCE_OPTIONS = [
  { value: 'whatsapp',  label: 'WhatsApp'   },
  { value: 'google',    label: 'Google'     },
  { value: 'referral',  label: 'Indicação'  },
  { value: 'walk_in',   label: 'Presencial' },
  { value: 'instagram', label: 'Instagram'  },
  { value: 'facebook',  label: 'Facebook'   },
  { value: 'site',      label: 'Site'       },
] as const;

const SOURCE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  SOURCE_OPTIONS.map((o) => [o.value, o.label]),
);

const STATUS_OPTIONS = [
  { value: 'active',      label: 'Ativo'       },
  { value: 'inactive',    label: 'Inativo'     },
  { value: 'blocked',     label: 'Bloqueado'   },
  { value: 'transferred', label: 'Transferido' },
] as const;

const STATUS_LABEL_MAP: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

/* ── Types ────────────────────────────────────────────────────────────── */

export interface PatientFilters {
  search: string;
  status: string;
  source: string;
  sortBy: 'name' | 'createdAt' | 'lastVisitAt';
  sortDir: 'asc' | 'desc';
}

export interface PatientFiltersBarProps {
  filters: PatientFilters;
  onChange: (filters: PatientFilters) => void;
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  onNewPatient: () => void;
  onQuickRegister: () => void;
}

/* ── Component ────────────────────────────────────────────────────────── */

export function PatientFiltersBar({
  filters,
  onChange,
  total,
  isLoading,
  isFetching,
  onNewPatient,
  onQuickRegister,
}: PatientFiltersBarProps) {
  const [expanded, setExpanded] = React.useState(false);

  const hasFilters = !!(filters.search || filters.status || filters.source);

  function setField<K extends keyof PatientFilters>(key: K, value: PatientFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function clearAll() {
    onChange({ ...filters, search: '', status: '', source: '' });
  }

  // Active filter chips
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (filters.status) {
    chips.push({
      key: 'status',
      label: `Status: ${STATUS_LABEL_MAP[filters.status] ?? filters.status}`,
      onRemove: () => setField('status', ''),
    });
  }
  if (filters.source) {
    chips.push({
      key: 'source',
      label: `Origem: ${SOURCE_LABEL_MAP[filters.source] ?? filters.source}`,
      onRemove: () => setField('source', ''),
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Main toolbar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Input
            leadingIcon="search"
            type="search"
            placeholder="Buscar por nome, CPF ou telefone…"
            value={filters.search}
            onChange={(e) => setField('search', e.target.value)}
            aria-label="Buscar pacientes"
          />
        </div>

        {/* Filter toggle */}
        <Btn
          variant={expanded ? 'glass' : 'ghost'}
          small
          icon="filter"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls="patient-filters-panel"
        >
          Filtros
          {hasFilters && !expanded && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: T.primary,
                color: T.textInverse,
                fontSize: 10,
                fontWeight: 700,
                marginLeft: 4,
              }}
            >
              {chips.length}
            </span>
          )}
        </Btn>

        {/* Quick register */}
        <Btn variant="glass" small icon="zap" onClick={onQuickRegister}>
          Cadastro rápido
        </Btn>

        {/* Full register */}
        <Btn small icon="plus" onClick={onNewPatient}>
          Novo paciente
        </Btn>
      </div>

      {/* Expandable filters panel */}
      {expanded && (
        <div
          id="patient-filters-panel"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            borderRadius: T.r.md,
            background: T.glass,
            border: `1px solid ${T.glassBorder}`,
          }}
        >
          <div style={{ width: 160 }}>
            <Select
              value={filters.status}
              onChange={(e) => setField('status', e.target.value)}
              aria-label="Filtrar por status"
            >
              <option value="">Todos os status</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>

          <div style={{ width: 160 }}>
            <Select
              value={filters.source}
              onChange={(e) => setField('source', e.target.value)}
              aria-label="Filtrar por origem"
            >
              <option value="">Todas as origens</option>
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>

          <div style={{ width: 160 }}>
            <Select
              value={`${filters.sortBy}:${filters.sortDir}`}
              onChange={(e) => {
                const [sortBy, sortDir] = e.target.value.split(':') as [PatientFilters['sortBy'], PatientFilters['sortDir']];
                onChange({ ...filters, sortBy, sortDir });
              }}
              aria-label="Ordenar por"
            >
              <option value="name:asc">Nome A–Z</option>
              <option value="name:desc">Nome Z–A</option>
              <option value="lastVisitAt:desc">Última consulta ↓</option>
              <option value="lastVisitAt:asc">Última consulta ↑</option>
              <option value="createdAt:desc">Cadastro recente</option>
              <option value="createdAt:asc">Cadastro antigo</option>
            </Select>
          </div>

          {hasFilters && (
            <Btn variant="ghost" small icon="x" onClick={clearAll}>
              Limpar
            </Btn>
          )}
        </div>
      )}

      {/* Filter chips + count row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {chips.map((chip) => (
          <span
            key={chip.key}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px 3px 12px',
              borderRadius: T.r.pill,
              background: T.primaryBg,
              border: `1px solid ${T.primaryBorder}`,
              fontSize: 12,
              fontWeight: 500,
              color: T.primary,
            }}
          >
            {chip.label}
            <button
              type="button"
              onClick={chip.onRemove}
              aria-label={`Remover filtro ${chip.label}`}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                borderRadius: '50%',
              }}
            >
              <Ico name="x" size={10} color={T.primary} />
            </button>
          </span>
        ))}
        {filters.search && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px 3px 12px',
              borderRadius: T.r.pill,
              background: T.primaryBg,
              border: `1px solid ${T.primaryBorder}`,
              fontSize: 12,
              fontWeight: 500,
              color: T.primary,
            }}
          >
            Busca: &quot;{filters.search}&quot;
            <button
              type="button"
              onClick={() => setField('search', '')}
              aria-label="Limpar busca"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                borderRadius: '50%',
              }}
            >
              <Ico name="x" size={10} color={T.primary} />
            </button>
          </span>
        )}

        <div style={{ flex: 1 }} />

        {!isLoading && (
          <Mono size={11}>
            {total} {total === 1 ? 'PACIENTE' : 'PACIENTES'}
            {isFetching && !isLoading && ' · ATUALIZANDO'}
          </Mono>
        )}
      </div>
    </div>
  );
}
