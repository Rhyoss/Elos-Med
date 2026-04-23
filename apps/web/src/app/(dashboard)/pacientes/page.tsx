'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Phone,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Badge,
  DataTable,
  type ColumnDef,
  LoadingSkeleton,
  EmptyState,
} from '@dermaos/ui';
import { keepPreviousData } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-provider';

/* ── Tipos ──────────────────────────────────────────────────────────────── */

interface PatientRow {
  id:          string;
  name:        string;
  cpfMasked:   string | null;
  age:         number | null;
  gender:      string | null;
  phone:       string | null;
  status:      string;
  lastVisitAt: Date | null;
  allergies:   string[];
  createdAt:   Date;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const STATUS_LABELS: Record<string, string> = {
  active:      'Ativo',
  inactive:    'Inativo',
  blocked:     'Bloqueado',
  deceased:    'Falecido',
  transferred: 'Transferido',
};

const STATUS_VARIANTS: Record<string, 'success' | 'neutral' | 'danger' | 'warning'> = {
  active:      'success',
  inactive:    'neutral',
  blocked:     'danger',
  deceased:    'warning',
  transferred: 'neutral',
};

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ');
  const text  = [parts[0]?.[0], parts[parts.length - 1]?.[0]].filter(Boolean).join('').toUpperCase();
  return (
    <span
      className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-semibold shrink-0"
      aria-hidden="true"
    >
      {text}
    </span>
  );
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

/* ── Colunas da tabela ───────────────────────────────────────────────────── */

function buildColumns(onView: (id: string) => void): ColumnDef<PatientRow>[] {
  return [
    {
      id:     'patient',
      header: 'Paciente',
      cell:   ({ row }) => (
        <div className="flex items-center gap-3">
          <Initials name={row.original.name} />
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-foreground truncate">{row.original.name}</span>
            <span className="text-xs text-muted-foreground">{row.original.cpfMasked ?? '—'}</span>
          </div>
        </div>
      ),
      size: 260,
    },
    {
      id:     'age',
      header: 'Idade',
      cell:   ({ row }) => (
        <span className="text-sm text-foreground">
          {row.original.age != null ? `${row.original.age} anos` : '—'}
        </span>
      ),
      size: 90,
    },
    {
      id:     'phone',
      header: 'Telefone',
      cell:   ({ row }) => (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {row.original.phone ? (
            <>
              <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {row.original.phone}
            </>
          ) : '—'}
        </span>
      ),
      size: 160,
    },
    {
      id:     'lastVisit',
      header: 'Última visita',
      cell:   ({ row }) => (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {row.original.lastVisitAt ? (
            <>
              <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {formatDate(row.original.lastVisitAt)}
            </>
          ) : '—'}
        </span>
      ),
      size: 160,
    },
    {
      id:     'status',
      header: 'Status',
      cell:   ({ row }) => (
        <Badge
          variant={STATUS_VARIANTS[row.original.status] ?? 'neutral'}
          dot
          size="sm"
        >
          {STATUS_LABELS[row.original.status] ?? row.original.status}
        </Badge>
      ),
      size: 110,
    },
    {
      id:     'actions',
      header: '',
      cell:   ({ row }) => (
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onView(row.original.id); }}
            aria-label={`Ver perfil de ${row.original.name}`}
          >
            Ver Perfil
          </Button>
          <Link href={`/agenda?paciente=${row.original.id}`} onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm">Agendar</Button>
          </Link>
        </div>
      ),
      size: 180,
    },
  ];
}

/* ── Filtros ─────────────────────────────────────────────────────────────── */

const SOURCE_OPTIONS = [
  { value: 'whatsapp',  label: 'WhatsApp'    },
  { value: 'google',    label: 'Google'       },
  { value: 'referral',  label: 'Indicação'    },
  { value: 'walk_in',   label: 'Presencial'   },
  { value: 'instagram', label: 'Instagram'    },
  { value: 'facebook',  label: 'Facebook'     },
  { value: 'site',      label: 'Site'         },
];

/* ── Página principal ────────────────────────────────────────────────────── */

export default function PacientesPage() {
  const router = useRouter();

  const [search,    setSearch]    = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [status,    setStatus]    = React.useState('');
  const [source,    setSource]    = React.useState('');
  const [page,      setPage]      = React.useState(1);
  const PAGE_SIZE = 20;

  // Debounce search input
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  React.useEffect(() => { setPage(1); }, [status, source]);

  const { data, isLoading, isFetching } = trpc.patients.list.useQuery(
    {
      search:   debouncedSearch || undefined,
      status:   (status || undefined) as 'active' | 'inactive' | 'blocked' | 'deceased' | 'transferred' | 'merged' | undefined,
      source:   source || undefined,
      page,
      pageSize: PAGE_SIZE,
      sortBy:   'name',
      sortDir:  'asc',
    },
    { placeholderData: keepPreviousData },
  );

  const patients: PatientRow[] = React.useMemo(
    () =>
      (data?.data ?? []).map((p) => ({
        ...p,
        lastVisitAt: p.lastVisitAt ? new Date(p.lastVisitAt) : null,
        createdAt:   p.createdAt   ? new Date(p.createdAt)   : new Date(),
      })),
    [data],
  );

  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const columns = React.useMemo(
    () => buildColumns((id) => router.push(`/pacientes/${id}/perfil`)),
    [router],
  );

  const hasActiveFilters = debouncedSearch || status || source;

  function clearFilters() {
    setSearch('');
    setStatus('');
    setSource('');
    setPage(1);
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Pacientes"
        description="Gerencie o cadastro e histórico de todos os pacientes"
        actions={
          <Link href="/pacientes/novo">
            <Button size="sm" aria-label="Cadastrar novo paciente">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Novo Paciente
            </Button>
          </Link>
        }
      />

      <div className="flex flex-col gap-4 p-6 flex-1 min-h-0">
        {/* Barra de busca e filtros */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Busca */}
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Buscar por nome, CPF ou telefone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background
                         placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Buscar pacientes"
            />
          </div>

          {/* Filtro Status */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filtrar por status"
          >
            <option value="">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="blocked">Bloqueado</option>
            <option value="transferred">Transferido</option>
          </select>

          {/* Filtro Origem */}
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filtrar por origem"
          >
            <option value="">Todas as origens</option>
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Limpar filtros */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} aria-label="Limpar filtros">
              <X className="h-4 w-4" aria-hidden="true" />
              Limpar
            </Button>
          )}

          {/* Contador */}
          {!isLoading && (
            <span className="ml-auto text-sm text-muted-foreground" aria-live="polite">
              {total} {total === 1 ? 'paciente' : 'pacientes'}
              {isFetching && !isLoading && ' · Atualizando…'}
            </span>
          )}
        </div>

        {/* Tabela */}
        <div
          className="cursor-pointer"
          onClick={(e) => {
            const row = (e.target as HTMLElement).closest('tr[aria-selected]') as HTMLElement | null;
            if (!row) return;
            const idx = row.closest('tbody')?.children
              ? Array.from(row.closest('tbody')!.children).indexOf(row)
              : -1;
            if (idx >= 0 && patients[idx]) {
              router.push(`/pacientes/${patients[idx]!.id}/perfil`);
            }
          }}
        >
          <DataTable<PatientRow>
            data={patients}
            columns={columns}
            isLoading={isLoading}
            emptyTitle="Nenhum paciente encontrado"
            emptyDescription={
              hasActiveFilters
                ? 'Tente ajustar os filtros ou limpar a busca.'
                : 'Cadastre o primeiro paciente da clínica.'
            }
            emptyAction={
              !hasActiveFilters
                ? { label: 'Novo Paciente', onClick: () => router.push('/pacientes/novo') }
                : undefined
            }
            exportFilename="pacientes"
            stickyHeader
          />
        </div>

        {/* Paginação externa (server-side) */}
        {!isLoading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <div className="flex items-center gap-1" role="navigation" aria-label="Paginação de pacientes">
              <Button variant="ghost" size="icon" onClick={() => setPage(1)} disabled={page <= 1} aria-label="Primeira página">
                <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setPage((p) => p - 1)} disabled={page <= 1} aria-label="Página anterior">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} aria-label="Próxima página">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setPage(totalPages)} disabled={page >= totalPages} aria-label="Última página">
                <ChevronsRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
