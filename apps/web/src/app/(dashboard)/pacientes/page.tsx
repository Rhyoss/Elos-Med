'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { keepPreviousData } from '@tanstack/react-query';
import {
  Btn, Mono, PageHero, EmptyState, T,
} from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import {
  adaptPatientSummary,
  type PatientView,
} from '@/lib/adapters/patient-adapter';
import { PatientTable } from './_components/patient-table';
import { PatientQuickDrawer } from './_components/patient-quick-drawer';
import { PatientFiltersBar, type PatientFilters } from './_components/patient-filters';
import { QuickRegisterDialog } from './_components/quick-register-dialog';

/**
 * Pacientes — Redesigned patient list with:
 *   - Proper columns (Paciente, Alertas clínicos, Contato, Última consulta, Status)
 *   - Rich filter bar with chips
 *   - Quick drawer with full patient data (fetched via getById)
 *   - Keyboard navigation (↑/↓/Enter)
 *   - Double-click → prontuário
 *   - Quick registration dialog
 *
 * NOTA CLÍNICA: Alergias NUNCA aparecem como diagnóstico.
 * chronicConditions e activeMedications vêm do getById no drawer.
 */

const PAGE_SIZE = 20;

export default function PacientesPage() {
  const router = useRouter();

  // ── Filters ────────────────────────────────────────────────────────
  const [filters, setFilters] = React.useState<PatientFilters>({
    search: '',
    status: '',
    source: '',
    sortBy: 'name',
    sortDir: 'asc',
  });
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [page, setPage] = React.useState(1);

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  // Reset page on filter change
  React.useEffect(() => { setPage(1); }, [filters.status, filters.source]);

  // ── Data fetch ─────────────────────────────────────────────────────
  const { data, isLoading, isFetching } = trpc.patients.list.useQuery(
    {
      search:   debouncedSearch || undefined,
      status:   (filters.status || undefined) as
        | 'active' | 'inactive' | 'blocked' | 'deceased' | 'transferred' | 'merged' | undefined,
      source:   filters.source || undefined,
      page,
      pageSize: PAGE_SIZE,
      sortBy:   filters.sortBy,
      sortDir:  filters.sortDir,
    },
    { placeholderData: keepPreviousData },
  );

  const patients: PatientView[] = React.useMemo(
    () => (data?.data ?? []).map(adaptPatientSummary),
    [data],
  );

  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const hasFilters = !!(debouncedSearch || filters.status || filters.source);

  // ── Selection / focus ──────────────────────────────────────────────
  const [selected, setSelected] = React.useState<PatientView | null>(null);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);

  // Reset selection on data change
  React.useEffect(() => {
    if (selected && !patients.find((p) => p.id === selected.id)) {
      setSelected(null);
      setFocusedIndex(-1);
    }
  }, [patients, selected]);

  // ── Quick register dialog ──────────────────────────────────────────
  const [quickRegisterOpen, setQuickRegisterOpen] = React.useState(false);

  function handleSelect(patient: PatientView) {
    setSelected(patient);
  }

  function handleOpenRecord(patientId: string) {
    router.push(`/pacientes/${patientId}/prontuario`);
  }

  return (
    <>
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* Main column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Header */}
          <div style={{ padding: '20px 26px 8px', flexShrink: 0 }}>
            <PageHero
              eyebrow="PRONTUÁRIO ELETRÔNICO"
              title="Pacientes"
              module="clinical"
              icon="users"
            />

            <PatientFiltersBar
              filters={filters}
              onChange={setFilters}
              total={total}
              isLoading={isLoading}
              isFetching={isFetching}
              onNewPatient={() => router.push('/pacientes/novo')}
              onQuickRegister={() => setQuickRegisterOpen(true)}
            />
          </div>

          {/* Table area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 26px 22px', minHeight: 0 }}>
            {!isLoading && patients.length === 0 ? (
              <EmptyState
                icon="users"
                title={hasFilters ? 'Nenhum paciente corresponde aos filtros' : 'Nenhum paciente cadastrado'}
                description={
                  hasFilters
                    ? 'Tente limpar os filtros ou ajustar a busca.'
                    : 'Cadastre o primeiro paciente da clínica.'
                }
                action={
                  hasFilters ? (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <Btn
                        variant="ghost"
                        small
                        icon="x"
                        onClick={() => setFilters({ ...filters, search: '', status: '', source: '' })}
                      >
                        Limpar filtros
                      </Btn>
                      <Btn small icon="plus" onClick={() => setQuickRegisterOpen(true)}>
                        Cadastrar paciente
                      </Btn>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <Btn small icon="zap" onClick={() => setQuickRegisterOpen(true)}>
                        Cadastro rápido
                      </Btn>
                      <Link href="/pacientes/novo" style={{ textDecoration: 'none' }}>
                        <Btn variant="glass" small icon="plus">Cadastro completo</Btn>
                      </Link>
                    </div>
                  )
                }
              />
            ) : (
              <PatientTable
                patients={patients}
                isLoading={isLoading}
                selectedId={selected?.id ?? null}
                focusedIndex={focusedIndex}
                onSelect={handleSelect}
                onOpenRecord={handleOpenRecord}
                onFocusedIndexChange={setFocusedIndex}
              />
            )}

            {/* Pagination */}
            {!isLoading && total > PAGE_SIZE && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 12,
                }}
              >
                <Mono size={11}>
                  PÁGINA {page} DE {totalPages} · {total} PACIENTES
                </Mono>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Btn
                    variant="ghost"
                    small
                    icon="arrowLeft"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Anterior
                  </Btn>
                  <Btn
                    variant="ghost"
                    small
                    icon="arrowRight"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Próxima
                  </Btn>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick drawer — opens on single click */}
        {selected && (
          <PatientQuickDrawer
            listPatient={selected}
            onClose={() => {
              setSelected(null);
              setFocusedIndex(-1);
            }}
          />
        )}
      </div>

      {/* Quick register dialog */}
      <QuickRegisterDialog
        open={quickRegisterOpen}
        onClose={() => setQuickRegisterOpen(false)}
        onCreated={() => {
          // Table will auto-refresh via cache invalidation
        }}
      />
    </>
  );
}
