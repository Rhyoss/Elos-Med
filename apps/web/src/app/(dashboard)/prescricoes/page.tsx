'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Badge,
  Btn,
  EmptyState,
  Field,
  Glass,
  Ico,
  Input,
  Mono,
  PageHero,
  Select,
  Skeleton,
  T,
} from '@dermaos/ui/ds';
import {
  PRESCRIPTION_STATUS_LABELS,
  PRESCRIPTION_TYPE_LABELS,
  PRESCRIPTION_TYPES,
  type PrescriptionStatus,
  type PrescriptionType,
} from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { useDebounce } from '@/lib/utils';
import {
  PRESCRIPTION_STATUS_VARIANT,
  usePrescriptionsByPatient,
} from '@/lib/hooks/use-prescriptions';

/* ── Constants ──────────────────────────────────────────────────────── */

const STATUSES: readonly PrescriptionStatus[] = [
  'rascunho',
  'emitida',
  'assinada',
  'enviada_digital',
  'impressa',
  'expirada',
  'cancelada',
];

/* ── Patient picker (combobox simples) ──────────────────────────────── */

function PatientPicker({
  value,
  onSelect,
  selectedName,
}: {
  value: string;
  onSelect: (patient: { id: string; name: string } | null) => void;
  selectedName?: string | null;
}) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen]   = React.useState(false);
  const debouncedQuery    = useDebounce(query, 250);
  const containerRef      = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener('mousedown', onClickOutside);
    return () => window.removeEventListener('mousedown', onClickOutside);
  }, []);

  const searchQ = trpc.patients.search.useQuery(
    {
      query:   debouncedQuery,
      page:    1,
      limit:   12,
      sort:    'name',
      sortDir: 'asc',
    },
    { enabled: debouncedQuery.length >= 2 },
  );

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <Field label="Paciente">
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            leadingIcon="search"
            placeholder={value && selectedName ? selectedName : 'Buscar paciente por nome…'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            aria-label="Buscar paciente"
          />
          {value && (
            <Btn
              variant="ghost"
              small
              icon="x"
              type="button"
              onClick={() => {
                onSelect(null);
                setQuery('');
              }}
              aria-label="Limpar paciente"
            />
          )}
        </div>
      </Field>

      {open && debouncedQuery.length >= 2 && (
        <Glass
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            zIndex: 50,
            maxHeight: 280,
            overflowY: 'auto',
            padding: 4,
          }}
        >
          {searchQ.isLoading ? (
            <div style={{ padding: 12, color: T.textMuted, fontSize: 13 }}>Buscando…</div>
          ) : (searchQ.data?.data ?? []).length === 0 ? (
            <div style={{ padding: 12, color: T.textMuted, fontSize: 13 }}>
              Nenhum paciente encontrado.
            </div>
          ) : (
            (searchQ.data!.data).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelect({ id: p.id, name: p.name });
                  setOpen(false);
                  setQuery('');
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: T.r.sm,
                  cursor: 'pointer',
                  color: T.textPrimary,
                  fontSize: 13,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = T.glass; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                {p.phone && (
                  <Mono size={10}>{p.phone}</Mono>
                )}
              </button>
            ))
          )}
        </Glass>
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function PrescricoesListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialPatient = searchParams.get('patientId') ?? '';
  const initialPatientName = searchParams.get('patientName') ?? '';

  const [patientId, setPatientId]     = React.useState<string>(initialPatient);
  const [patientName, setPatientName] = React.useState<string>(initialPatientName);
  const [statusFilter, setStatusFilter] = React.useState<PrescriptionStatus | ''>('');
  const [typeFilter, setTypeFilter]     = React.useState<PrescriptionType | ''>('');

  const listQ = usePrescriptionsByPatient(
    patientId,
    {
      status: (statusFilter || undefined) as PrescriptionStatus | undefined,
      type:   (typeFilter   || undefined) as PrescriptionType   | undefined,
      page:    1,
      pageSize: 100,
    },
    { enabled: !!patientId },
  );

  return (
    <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
      <PageHero
        eyebrow="Clínico"
        icon="file"
        module="clinical"
        title="Prescrições"
        description="Visão consolidada das prescrições por paciente"
        actions={(
          <Btn
            variant="primary"
            small
            icon="plus"
            type="button"
            disabled={!patientId}
            onClick={() => router.push(`/prescricoes/nova?patientId=${patientId}`)}
          >
            Nova prescrição
          </Btn>
        )}
      />

      {/* Filters bar */}
      <Glass style={{ padding: 16, marginBottom: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 1fr) 200px 200px',
            gap: 12,
            alignItems: 'end',
          }}
        >
          <PatientPicker
            value={patientId}
            selectedName={patientName}
            onSelect={(p) => {
              setPatientId(p?.id ?? '');
              setPatientName(p?.name ?? '');
            }}
          />
          <Field label="Status">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PrescriptionStatus | '')}
              disabled={!patientId}
              aria-label="Filtrar por status"
            >
              <option value="">Todos</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{PRESCRIPTION_STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as PrescriptionType | '')}
              disabled={!patientId}
              aria-label="Filtrar por tipo"
            >
              <option value="">Todos</option>
              {PRESCRIPTION_TYPES.map((t) => (
                <option key={t} value={t}>{PRESCRIPTION_TYPE_LABELS[t]}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Glass>

      {/* List */}
      {!patientId ? (
        <EmptyState
          label="PRESCRIÇÕES"
          icon="users"
          title="Selecione um paciente para ver as prescrições"
          description="A listagem é organizada por paciente, alinhada à RLS clínica do backend. Use a busca acima ou abra um prontuário diretamente."
          action={(
            <Link href="/pacientes">
              <Btn variant="primary" small icon="users">Ir para pacientes</Btn>
            </Link>
          )}
        />
      ) : listQ.isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={84} delay={i * 60} />
          ))}
        </div>
      ) : (listQ.data?.data ?? []).length === 0 ? (
        <EmptyState
          label="PRESCRIÇÕES"
          icon="file"
          title="Nenhuma prescrição com esses filtros"
          description="Crie a primeira prescrição deste paciente ou ajuste os filtros."
          action={(
            <Btn
              variant="primary"
              small
              icon="plus"
              type="button"
              onClick={() => router.push(`/prescricoes/nova?patientId=${patientId}`)}
            >
              Nova prescrição
            </Btn>
          )}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {listQ.data!.data.map((rx) => (
            <Glass
              key={rx.id}
              hover
              style={{ padding: '14px 16px', cursor: 'pointer' }}
              onClick={() => router.push(`/prescricoes/${rx.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  router.push(`/prescricoes/${rx.id}`);
                }
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, margin: 0 }}>
                      {rx.prescriptionNumber ?? rx.id.slice(0, 8).toUpperCase()}
                    </p>
                    <Badge variant={PRESCRIPTION_STATUS_VARIANT[rx.status] ?? 'default'} dot={false}>
                      {PRESCRIPTION_STATUS_LABELS[rx.status] ?? rx.status}
                    </Badge>
                  </div>
                  <Mono size={11}>
                    {PRESCRIPTION_TYPE_LABELS[rx.type] ?? rx.type}
                    {' · '}
                    {rx.itemCount} {rx.itemCount === 1 ? 'item' : 'itens'}
                    {' · '}
                    {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(rx.signedAt ?? rx.createdAt)}
                  </Mono>
                </div>
                <Ico name="arrowRight" size={16} color={T.textMuted} />
              </div>
            </Glass>
          ))}
        </div>
      )}
    </div>
  );
}
