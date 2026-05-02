'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Glass, Btn, Mono, Badge, Ico, Skeleton, T,
} from '@dermaos/ui/ds';
import {
  type PatientView,
  STATUS_LABELS,
  STATUS_BADGE_VARIANT,
  GENDER_LABELS,
} from '@/lib/adapters/patient-adapter';
import { maskEmail } from '@/lib/privacy';

/* ── Helpers ──────────────────────────────────────────────────────────── */

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }).format(date);
}

function formatRelative(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 7) return `${diff}d atrás`;
  if (diff < 30) return `${Math.floor(diff / 7)}sem atrás`;
  if (diff < 365) return `${Math.floor(diff / 30)}m atrás`;
  return formatDate(d);
}

function allergyBadges(allergies: string[]): React.ReactNode {
  if (allergies.length === 0) return <span style={{ color: T.textMuted, fontSize: 13 }}>—</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 200 }}>
      <Badge variant="danger" dot style={{ fontSize: 11, padding: '2px 8px' }}>
        {allergies[0]}
      </Badge>
      {allergies.length > 1 && (
        <Badge variant="danger" dot={false} style={{ fontSize: 10, padding: '2px 6px' }}>
          +{allergies.length - 1}
        </Badge>
      )}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/* ── Column defs ──────────────────────────────────────────────────────── */

const COLUMNS = [
  'Paciente',
  'Alertas clínicos',
  'Contato',
  'Última consulta',
  'Próx. agendamento',
  'Status',
  '',
] as const;

const COL_WIDTHS = ['1fr', '180px', '160px', '120px', '130px', '100px', '48px'];

/* ── Props ────────────────────────────────────────────────────────────── */

export interface PatientTableProps {
  patients: PatientView[];
  isLoading: boolean;
  selectedId: string | null;
  focusedIndex: number;
  onSelect: (patient: PatientView) => void;
  onOpenRecord: (patientId: string) => void;
  onFocusedIndexChange: (index: number) => void;
}

export function PatientTable({
  patients,
  isLoading,
  selectedId,
  focusedIndex,
  onSelect,
  onOpenRecord,
  onFocusedIndexChange,
}: PatientTableProps) {
  const tableRef = React.useRef<HTMLTableElement>(null);
  const router = useRouter();

  // Keyboard navigation
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (patients.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(focusedIndex + 1, patients.length - 1);
        onFocusedIndexChange(next);
        onSelect(patients[next]!);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(focusedIndex - 1, 0);
        onFocusedIndexChange(prev);
        onSelect(patients[prev]!);
      } else if (e.key === 'Enter' && focusedIndex >= 0 && patients[focusedIndex]) {
        e.preventDefault();
        onOpenRecord(patients[focusedIndex]!.id);
      }
    }

    const table = tableRef.current;
    table?.addEventListener('keydown', handleKeyDown);
    return () => table?.removeEventListener('keydown', handleKeyDown);
  }, [patients, focusedIndex, onFocusedIndexChange, onSelect, onOpenRecord]);

  const thStyle: React.CSSProperties = {
    padding: '10px 14px',
    textAlign: 'left',
    fontSize: 10,
    fontFamily: "'IBM Plex Mono', monospace",
    letterSpacing: '1.1px',
    color: T.textMuted,
    fontWeight: 500,
    borderBottom: `1px solid ${T.divider}`,
    background: T.metalGrad,
    position: 'sticky',
    top: 0,
    zIndex: 2,
    whiteSpace: 'nowrap',
  };

  return (
    <Glass style={{ padding: 0, overflow: 'hidden' }}>
      <table
        ref={tableRef}
        tabIndex={0}
        role="grid"
        aria-label="Lista de pacientes"
        style={{ width: '100%', borderCollapse: 'collapse' }}
      >
        <thead>
          <tr>
            {COLUMNS.map((h, i) => (
              <th key={h || `col-${i}`} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 10 }).map((_, i) => (
                <tr key={`skel-${i}`} style={{ borderBottom: `1px solid ${T.divider}` }}>
                  {Array.from({ length: COLUMNS.length }).map((__, j) => (
                    <td key={j} style={{ padding: '12px 14px' }}>
                      <Skeleton height={14} delay={i * 60} />
                    </td>
                  ))}
                </tr>
              ))
            : patients.map((p, i) => {
                const isSelected = selectedId === p.id;
                const isFocused = focusedIndex === i;
                return (
                  <tr
                    key={p.id}
                    role="row"
                    aria-selected={isSelected}
                    tabIndex={isFocused ? 0 : -1}
                    onClick={() => { onFocusedIndexChange(i); onSelect(p); }}
                    onDoubleClick={() => onOpenRecord(p.id)}
                    title="Clique para pré-visualizar · Duplo-clique para prontuário"
                    style={{
                      borderBottom: `1px solid ${T.divider}`,
                      background: isSelected
                        ? T.primaryBg
                        : isFocused
                          ? 'rgba(23,77,56,0.03)'
                          : i % 2 === 0
                            ? 'transparent'
                            : 'rgba(255,255,255,0.22)',
                      cursor: 'pointer',
                      outline: isFocused ? `2px solid ${T.primaryBorder}` : 'none',
                      outlineOffset: -2,
                      transition: 'background 0.12s',
                    }}
                  >
                    {/* Paciente — avatar + nome + idade + sexo */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: T.r.md,
                            background: T.clinical.bg,
                            border: `1px solid ${T.clinical.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontSize: 12,
                            fontWeight: 600,
                            color: T.clinical.color,
                            fontFamily: "'IBM Plex Sans', sans-serif",
                          }}
                        >
                          {initials(p.name)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: T.textPrimary,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {p.name}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                            {p.age != null && (
                              <Mono size={10}>{p.age} anos</Mono>
                            )}
                            {p.gender && p.age != null && (
                              <Mono size={10}>·</Mono>
                            )}
                            {p.gender && (
                              <Mono size={10}>{GENDER_LABELS[p.gender] ?? p.gender}</Mono>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Alertas clínicos */}
                    <td style={{ padding: '10px 14px' }}>
                      {allergyBadges(p.allergies)}
                    </td>

                    {/* Contato */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: 13, color: T.textSecondary }}>
                        {p.phoneMasked ?? '—'}
                      </div>
                      {p.email && (
                        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                          {maskEmail(p.email)}
                        </div>
                      )}
                    </td>

                    {/* Última consulta */}
                    <td style={{ padding: '10px 14px' }}>
                      <Mono size={11}>{formatRelative(p.lastVisitAt)}</Mono>
                    </td>

                    {/* Próximo agendamento — TODO: requer endpoint appointments.next */}
                    <td style={{ padding: '10px 14px' }}>
                      <Mono size={11} color={T.textMuted}>—</Mono>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '10px 14px' }}>
                      <Badge variant={STATUS_BADGE_VARIANT[p.status] ?? 'default'}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </td>

                    {/* Ação: abrir prontuário */}
                    <td style={{ padding: '10px 14px' }}>
                      <Link
                        href={`/pacientes/${p.id}/prontuario`}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Abrir prontuário de ${p.name}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          borderRadius: T.r.sm,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = T.primaryBg; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <Ico
                          name="arrowRight"
                          size={14}
                          color={isSelected ? T.primary : T.textMuted}
                        />
                      </Link>
                    </td>
                  </tr>
                );
              })}
        </tbody>
      </table>
    </Glass>
  );
}
