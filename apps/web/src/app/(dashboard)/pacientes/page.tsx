'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Glass, Btn, Mono, Badge, Ico, Input, Select, Skeleton, EmptyState,
  PageHero, T,
} from '@dermaos/ui/ds';
import { keepPreviousData } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-provider';

/**
 * Pacientes & Leads — DS table inline + side detail panel.
 *
 * Phase-4 reskin: tabela DS própria (substitui legacy DataTable),
 * search/filtros DS, painel lateral DS quando uma linha é selecionada.
 * Mantém `trpc.patients.list` com todos os filtros (search debounced,
 * status, source, paginação server-side).
 */

interface PatientRow {
  id:          string;
  name:        string;
  cpfMasked:   string | null;
  age:         number | null;
  phone:       string | null;
  status:      string;
  lastVisitAt: Date | null;
  /** Stand-in for "Diagnóstico" column — usa primeira alergia até Phase 5
   *  ligar `encounters.latestDiagnosis`. */
  allergies:   string[];
}

const STATUS_LABELS: Record<string, string> = {
  active:      'Ativo',
  inactive:    'Inativo',
  blocked:     'Bloqueado',
  deceased:    'Falecido',
  transferred: 'Transferido',
};

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  active:      'success',
  inactive:    'default',
  blocked:     'danger',
  deceased:    'warning',
  transferred: 'default',
};

const SOURCE_OPTIONS = [
  { value: 'whatsapp',  label: 'WhatsApp'   },
  { value: 'google',    label: 'Google'     },
  { value: 'referral',  label: 'Indicação'  },
  { value: 'walk_in',   label: 'Presencial' },
  { value: 'instagram', label: 'Instagram'  },
  { value: 'facebook',  label: 'Facebook'   },
  { value: 'site',      label: 'Site'       },
];

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date);
}

/** Iniciais (2 letras) do nome para o tile de avatar. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '··';
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : parts[0]!.charAt(1) ?? '';
  return (first + last).toUpperCase();
}

const PAGE_SIZE = 20;

export default function PacientesPage() {
  const router = useRouter();

  const [search,         setSearch]         = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [status,         setStatus]         = React.useState('');
  const [source,         setSource]         = React.useState('');
  const [page,           setPage]           = React.useState(1);
  const [selected,       setSelected]       = React.useState<PatientRow | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => { setPage(1); }, [status, source]);

  const { data, isLoading, isFetching, isError, error, refetch } = trpc.patients.list.useQuery(
    {
      search:   debouncedSearch || undefined,
      status:   (status || undefined) as
        | 'active' | 'inactive' | 'blocked' | 'deceased' | 'transferred' | 'merged' | undefined,
      source:   source || undefined,
      page,
      pageSize: PAGE_SIZE,
      sortBy:   'name',
      sortDir:  'asc',
    },
    { placeholderData: keepPreviousData },
  );

  const patients: PatientRow[] = React.useMemo(
    () => (data?.data ?? []).map((p) => ({
      id:          p.id,
      name:        p.name,
      cpfMasked:   p.cpfMasked,
      age:         p.age,
      phone:       p.phone,
      status:      p.status,
      lastVisitAt: p.lastVisitAt ? new Date(p.lastVisitAt) : null,
      allergies:   p.allergies ?? [],
    })),
    [data],
  );

  /** Diagnóstico stand-in — primeira alergia, fallback "—". */
  function diagOf(p: PatientRow): string {
    return p.allergies.length > 0 ? p.allergies[0]! : '—';
  }

  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const hasFilters = !!(debouncedSearch || status || source);

  function clearFilters() {
    setSearch('');
    setStatus('');
    setSource('');
    setPage(1);
  }

  return (
    <div style={{ position: 'relative', display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Lista principal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '22px 26px 12px', flexShrink: 0 }}>
          <PageHero
            eyebrow="PRONTUÁRIO ELETRÔNICO"
            title="Pacientes & Leads"
            module="clinical"
            icon="user"
            actions={
              <Link href="/pacientes/novo" style={{ textDecoration: 'none' }}>
                <Btn small icon="plus">Novo Paciente</Btn>
              </Link>
            }
          />

          {/* Toolbar — todos os filtros em linha única */}
          <Glass style={{ padding: '8px 12px' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <div style={{ flex: '1 1 240px', minWidth: 200, maxWidth: 380 }}>
                <Input
                  leadingIcon="search"
                  type="search"
                  placeholder="Buscar nome, CPF ou telefone…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Buscar pacientes"
                />
              </div>

              <div style={{ flex: '0 0 150px' }}>
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  aria-label="Status"
                >
                  <option value="">Todos os status</option>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                  <option value="blocked">Bloqueado</option>
                  <option value="transferred">Transferido</option>
                </Select>
              </div>

              <div style={{ flex: '0 0 150px' }}>
                <Select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  aria-label="Origem"
                >
                  <option value="">Todas as origens</option>
                  {SOURCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>

              {hasFilters && (
                <Btn variant="ghost" small icon="x" onClick={clearFilters}>
                  Limpar
                </Btn>
              )}

              {!isLoading && (
                <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  <Mono size={9}>
                    {total} {total === 1 ? 'PACIENTE' : 'PACIENTES'}
                    {isFetching && !isLoading && ' · ATUALIZANDO'}
                  </Mono>
                </span>
              )}
            </div>
          </Glass>
        </div>

        {/* Tabela */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 26px 22px', minHeight: 0 }}>
          <Glass style={{ padding: 0, overflow: 'hidden' }}>
            {isError ? (
              <EmptyState
                icon="alert"
                title="Não foi possível carregar pacientes"
                description={error.message || 'Verifique sua conexão e tente novamente.'}
                action={<Btn small icon="activity" onClick={() => void refetch()}>Tentar novamente</Btn>}
              />
            ) : (
            <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Prontuário', 'Paciente', 'Idade', 'Diagnóstico', 'Última visita', 'Status', ''].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '9px 16px',
                        textAlign: 'left',
                        fontSize: 8,
                        fontFamily: "'IBM Plex Mono', monospace",
                        letterSpacing: '1.1px',
                        color: T.textMuted,
                        fontWeight: 500,
                        borderBottom: `1px solid ${T.divider}`,
                        background: T.metalGrad,
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.divider}` }}>
                        {Array.from({ length: 7 }).map((__, j) => (
                          <td key={j} style={{ padding: '11px 16px' }}>
                            <Skeleton height={12} delay={i * 80} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : patients.map((p, i) => (
                      <tr
                        key={p.id}
                        onClick={() => setSelected(p)}
                        onDoubleClick={() => router.push(`/pacientes/${p.id}/perfil`)}
                        title="Click: pré-visualização. Duplo-click: abrir prontuário."
                        style={{
                          borderBottom: `1px solid ${T.divider}`,
                          background: selected?.id === p.id
                            ? T.primaryBg
                            : i % 2 === 0
                              ? 'transparent'
                              : 'rgba(255,255,255,0.22)',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: '11px 16px' }}>
                          <Mono size={9}>{p.id.slice(0, 8).toUpperCase()}</Mono>
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: T.r.sm,
                                background: T.clinical.bg,
                                border: `1px solid ${T.clinical.color}1A`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 700,
                                fontFamily: "'IBM Plex Mono', monospace",
                                letterSpacing: '0.5px',
                                color: T.clinical.color,
                                flexShrink: 0,
                              }}
                              aria-hidden="true"
                            >
                              {initialsOf(p.name)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
                              <Mono size={8}>{p.cpfMasked ?? '—'}</Mono>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: 12, color: T.textSecondary }}>
                          {p.age != null ? `${p.age} anos` : '—'}
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: 11, color: T.textSecondary }}>
                          {diagOf(p)}
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <Mono size={9}>{formatDate(p.lastVisitAt)}</Mono>
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <Badge variant={STATUS_BADGE[p.status] ?? 'default'}>
                            {STATUS_LABELS[p.status] ?? p.status}
                          </Badge>
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <Link
                            href={`/pacientes/${p.id}/perfil`}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Abrir prontuário de ${p.name}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 4,
                              borderRadius: T.r.sm,
                            }}
                          >
                            <Ico
                              name="arrowRight"
                              size={13}
                              color={selected?.id === p.id ? T.primary : T.textMuted}
                            />
                          </Link>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>

            {!isLoading && patients.length === 0 && (
              <EmptyState
                icon="users"
                title={hasFilters ? 'Nenhum paciente corresponde aos filtros' : 'Nenhum paciente cadastrado'}
                description={hasFilters
                  ? 'Tente limpar os filtros ou ajustar a busca.'
                  : 'Cadastre o primeiro paciente da clínica.'}
                action={!hasFilters
                  ? <Link href="/pacientes/novo" style={{ textDecoration: 'none' }}><Btn small icon="plus">Novo Paciente</Btn></Link>
                  : <Btn variant="ghost" small onClick={clearFilters}>Limpar filtros</Btn>}
              />
            )}
            </>
            )}
          </Glass>

          {/* Paginação */}
          {!isLoading && total > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <Mono size={9}>PÁGINA {page} DE {totalPages}</Mono>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn variant="glass" small icon="arrowLeft" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  Anterior
                </Btn>
                <Btn variant="glass" small icon="arrowRight" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  Próxima
                </Btn>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Painel lateral de detalhes (overlay flutuante) */}
      {selected && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 296,
            borderLeft: `1px solid ${T.divider}`,
            background: 'rgba(255,255,255,0.62)',
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            overflowY: 'auto',
            flexShrink: 0,
            boxShadow: '-8px 0 24px rgba(0,0,0,0.05)',
            zIndex: 10,
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              borderBottom: `1px solid ${T.divider}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Mono size={9}>PRÉ-VISUALIZAÇÃO</Mono>
            <button
              onClick={() => setSelected(null)}
              aria-label="Fechar painel"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'inline-flex' }}
            >
              <Ico name="x" size={15} color={T.textMuted} />
            </button>
          </div>
          <div style={{ padding: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: T.r.lg,
                background: T.clinical.bg,
                border: `1px solid ${T.clinical.color}18`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
                fontSize: 16,
                fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace",
                letterSpacing: '0.5px',
                color: T.clinical.color,
              }}
              aria-hidden="true"
            >
              {initialsOf(selected.name)}
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, marginBottom: 2 }}>{selected.name}</p>
            <Mono size={9}>{selected.id.slice(0, 8).toUpperCase()}{selected.age != null ? ` · ${selected.age} anos` : ''}</Mono>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([
                ['CPF',             selected.cpfMasked ?? '—', null],
                ['Diagnóstico',     diagOf(selected),          null],
                ['Telefone',        selected.phone ?? '—',     null],
                ['Status',          null,                       'badge'],
                ['Última consulta', formatDate(selected.lastVisitAt), null],
              ] as const).map(([k, v, kind]) => (
                <div
                  key={k}
                  style={{
                    padding: '8px 10px',
                    borderRadius: T.r.md,
                    background: T.glass,
                    border: `1px solid ${T.glassBorder}`,
                  }}
                >
                  <Mono size={8}>{k.toUpperCase()}</Mono>
                  {kind === 'badge' ? (
                    <div style={{ marginTop: 4 }}>
                      <Badge variant={STATUS_BADGE[selected.status] ?? 'default'}>
                        {STATUS_LABELS[selected.status] ?? selected.status}
                      </Badge>
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: T.textPrimary, marginTop: 3 }}>{v}</p>
                  )}
                </div>
              ))}
            </div>
            <div
              style={{
                margin: '14px 0 12px',
                height: 1,
                background: `linear-gradient(90deg, transparent, ${T.divider}, transparent)`,
              }}
              aria-hidden="true"
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Btn small icon="edit" onClick={() => router.push(`/pacientes/${selected.id}/perfil`)}>
                Abrir prontuário
              </Btn>
              <Link href={`/agenda?paciente=${selected.id}`} style={{ textDecoration: 'none' }}>
                <Btn variant="glass" small icon="calendar" style={{ width: '100%' }}>Agendar</Btn>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
