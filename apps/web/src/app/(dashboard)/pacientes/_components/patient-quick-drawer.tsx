'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Glass, Btn, Mono, Badge, Ico, Skeleton, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import {
  adaptPatientPublic,
  STATUS_LABELS,
  STATUS_BADGE_VARIANT,
  GENDER_LABELS,
  type PatientView,
} from '@/lib/adapters/patient-adapter';

/* ── Helpers ──────────────────────────────────────────────────────────── */

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

/* ── Detail field component ───────────────────────────────────────────── */

function DetailField({ label, value, icon, danger }: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentProps<typeof Ico>['name'];
  danger?: boolean;
}) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: T.r.md,
        background: danger ? T.dangerBg : T.glass,
        border: `1px solid ${danger ? T.dangerBorder : T.glassBorder}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
        {icon && <Ico name={icon} size={10} color={danger ? T.danger : T.textMuted} />}
        <Mono size={9} color={danger ? T.danger : undefined}>
          {label.toUpperCase()}
        </Mono>
      </div>
      <div style={{ fontSize: 14, color: danger ? T.danger : T.textPrimary, fontWeight: danger ? 600 : 400 }}>
        {value}
      </div>
    </div>
  );
}

/* ── Props ────────────────────────────────────────────────────────────── */

export interface PatientQuickDrawerProps {
  /** Minimal patient data from the list row */
  listPatient: PatientView;
  onClose: () => void;
}

export function PatientQuickDrawer({ listPatient, onClose }: PatientQuickDrawerProps) {
  const router = useRouter();

  // Fetch full patient data for the drawer
  const { data, isLoading } = trpc.patients.getById.useQuery(
    { id: listPatient.id },
    { staleTime: 30_000, refetchOnWindowFocus: false },
  );

  const full = data?.patient ? adaptPatientPublic(data.patient as Parameters<typeof adaptPatientPublic>[0]) : null;
  const patient = full ?? listPatient;

  return (
    <div
      role="complementary"
      aria-label={`Ficha rápida de ${patient.name}`}
      style={{
        width: 340,
        borderLeft: `1px solid ${T.divider}`,
        background: 'rgba(255,255,255,0.38)',
        backdropFilter: 'blur(16px) saturate(170%)',
        WebkitBackdropFilter: 'blur(16px) saturate(170%)',
        overflowY: 'auto',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${T.divider}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Ico name="user" size={14} color={T.primary} />
          <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
            Ficha Rápida
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar ficha rápida"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 6,
            borderRadius: T.r.sm,
            display: 'flex',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = T.primaryBg; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <Ico name="x" size={15} color={T.textMuted} />
        </button>
      </div>

      {/* Patient identity */}
      <div style={{ padding: '18px 18px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: T.r.lg,
              background: T.clinical.bg,
              border: `1px solid ${T.clinical.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
              color: T.clinical.color,
              fontFamily: "'IBM Plex Sans', sans-serif",
              flexShrink: 0,
            }}
          >
            {initials(patient.name)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{
              fontSize: 18,
              fontWeight: 700,
              color: T.textPrimary,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {patient.name}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Mono size={10}>{patient.displayId}</Mono>
              {patient.age != null && (
                <>
                  <Mono size={10}>·</Mono>
                  <Mono size={10}>{patient.age} anos</Mono>
                </>
              )}
              {patient.gender && (
                <>
                  <Mono size={10}>·</Mono>
                  <Mono size={10}>{GENDER_LABELS[patient.gender] ?? patient.gender}</Mono>
                </>
              )}
            </div>
            <div style={{ marginTop: 6 }}>
              <Badge variant={STATUS_BADGE_VARIANT[patient.status] ?? 'default'}>
                {STATUS_LABELS[patient.status] ?? patient.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 18px' }}>
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={48} delay={i * 60} />
            ))}
          </div>
        )}

        {/* Alertas clínicos — alergias destacadas no topo */}
        {patient.allergies.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <DetailField
              label="Alergias"
              icon="alert"
              danger
              value={
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                  {patient.allergies.map((a) => (
                    <Badge key={a} variant="danger" style={{ fontSize: 11, padding: '2px 8px' }}>
                      {a}
                    </Badge>
                  ))}
                </div>
              }
            />
          </div>
        )}

        {/* Condições crônicas */}
        {patient.chronicConditions.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <DetailField
              label="Condições crônicas"
              icon="activity"
              value={
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                  {patient.chronicConditions.map((c) => (
                    <Badge key={c} variant="warning" dot={false} style={{ fontSize: 11, padding: '2px 8px' }}>
                      {c}
                    </Badge>
                  ))}
                </div>
              }
            />
          </div>
        )}

        {/* Medicamentos em uso */}
        {patient.activeMedications.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <DetailField
              label="Medicamentos em uso"
              icon="layers"
              value={
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                  {patient.activeMedications.map((m) => (
                    <Badge key={m} variant="info" dot={false} style={{ fontSize: 11, padding: '2px 8px' }}>
                      {m}
                    </Badge>
                  ))}
                </div>
              }
            />
          </div>
        )}

        {/* Info fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <DetailField
            label="CPF"
            icon="shield"
            value={patient.cpfMasked ?? '—'}
          />
          <DetailField
            label="Telefone"
            icon="phone"
            value={patient.phoneMasked ?? '—'}
          />
          {patient.email && (
            <DetailField
              label="E-mail"
              icon="mail"
              value={patient.email}
            />
          )}
          <DetailField
            label="Última consulta"
            icon="clock"
            value={formatDate(patient.lastVisitAt)}
          />
          {patient.totalVisits != null && (
            <DetailField
              label="Total de consultas"
              icon="calendar"
              value={`${patient.totalVisits} consulta${patient.totalVisits !== 1 ? 's' : ''}`}
            />
          )}
          {patient.sourceChannel && (
            <DetailField
              label="Origem"
              icon="globe"
              value={patient.sourceChannel}
            />
          )}
          {patient.bloodType && (
            <DetailField
              label="Tipo sanguíneo"
              icon="activity"
              value={patient.bloodType}
            />
          )}
        </div>

        {/* Internal notes */}
        {patient.internalNotes && (
          <div style={{ marginTop: 14 }}>
            <DetailField
              label="Observações internas"
              icon="file"
              value={
                <p style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: T.textSecondary,
                  whiteSpace: 'pre-wrap',
                  marginTop: 2,
                }}>
                  {patient.internalNotes}
                </p>
              }
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        style={{
          padding: '14px 18px',
          borderTop: `1px solid ${T.divider}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          flexShrink: 0,
          background: 'rgba(255,255,255,0.5)',
        }}
      >
        <Btn
          small
          icon="edit"
          onClick={() => router.push(`/pacientes/${patient.id}/prontuario`)}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Abrir prontuário
        </Btn>
        <div style={{ display: 'flex', gap: 6 }}>
          <Link
            href={`/agenda?paciente=${patient.id}`}
            style={{ textDecoration: 'none', flex: 1 }}
          >
            <Btn variant="glass" small icon="calendar" style={{ width: '100%', justifyContent: 'center' }}>
              Agendar
            </Btn>
          </Link>
          <Link
            href={`/pacientes/${patient.id}/prontuario`}
            style={{ textDecoration: 'none', flex: 1 }}
          >
            <Btn variant="ghost" small icon="edit" style={{ width: '100%', justifyContent: 'center' }}>
              Editar
            </Btn>
          </Link>
        </div>
        {/* TODO: "Enviar mensagem" — requer integration com messaging */}
        {/* TODO: "Adicionar alerta" — requer endpoint alerts.create */}
      </div>
    </div>
  );
}
