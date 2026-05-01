'use client';

import * as React from 'react';
import Link from 'next/link';
import { PatientSidebar, type PatientSidebarField } from '@dermaos/ui/ds';
import { Btn, Glass, Ico, Mono, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';

interface EncounterPatientSidebarProps {
  patientId: string;
  encounterId: string;
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(dt);
}

export function EncounterPatientSidebar({ patientId, encounterId }: EncounterPatientSidebarProps) {
  const patientQuery = trpc.patients.getById.useQuery(
    { id: patientId },
    { enabled: !!patientId, staleTime: 30_000 },
  );
  const encountersQuery = trpc.clinical.encounters.getByPatient.useQuery(
    { patientId, page: 1, pageSize: 5 },
    { enabled: !!patientId, staleTime: 30_000 },
  );
  const prescriptionsQuery = trpc.clinical.prescriptions.listByPatient.useQuery(
    { patientId, page: 1, pageSize: 3 },
    { enabled: !!patientId, staleTime: 30_000 },
  );

  const patient = patientQuery.data?.patient;

  if (patientQuery.isLoading) {
    return (
      <aside
        style={{
          width: 280,
          borderRight: `1px solid ${T.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Mono size={10} color={T.textMuted}>CARREGANDO…</Mono>
      </aside>
    );
  }

  if (!patient) {
    return (
      <aside
        style={{
          width: 280,
          borderRight: `1px solid ${T.divider}`,
          padding: 16,
          flexShrink: 0,
        }}
      >
        <Mono size={10} color={T.textMuted}>PACIENTE NÃO ENCONTRADO</Mono>
      </aside>
    );
  }

  const fields: PatientSidebarField[] = [];

  if (patient.chronicConditions?.length) {
    fields.push({
      label: 'Condições',
      value: patient.chronicConditions.join(', '),
    });
  }

  if (patient.activeMedications?.length) {
    fields.push({
      label: 'Medicamentos em uso',
      value: patient.activeMedications.join(', '),
    });
  }

  fields.push({
    label: 'Consultas',
    value: `${patient.totalVisits ?? 0} registradas`,
  });

  if (patient.lastVisitAt) {
    fields.push({
      label: 'Última consulta',
      value: formatDate(patient.lastVisitAt),
    });
  }

  if (patient.bloodType) {
    fields.push({
      label: 'Tipo sanguíneo',
      value: patient.bloodType,
    });
  }

  const recentEncounters = encountersQuery.data?.data ?? [];
  const otherEncounters = recentEncounters.filter((e) => e.id !== encounterId).slice(0, 3);

  const activePrescriptions = (prescriptionsQuery.data?.data ?? [])
    .filter((p) => p.status === 'emitida' || p.status === 'assinada')
    .slice(0, 2);

  return (
    <PatientSidebar
      name={patient.name}
      prontuarioId={patient.id.slice(0, 8).toUpperCase()}
      age={patient.age ?? undefined}
      status={{ label: 'Em atendimento', variant: 'success' }}
      module="clinical"
      fields={fields}
      allergies={patient.allergies}
      compact
      footer={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Recent encounters */}
          {otherEncounters.length > 0 && (
            <div
              style={{
                padding: '7px 10px',
                borderRadius: T.r.md,
                background: T.glass,
                border: `1px solid ${T.glassBorder}`,
              }}
            >
              <Mono size={7} spacing="0.8px">CONSULTAS RECENTES</Mono>
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {otherEncounters.map((enc) => (
                  <Link
                    key={enc.id}
                    href={`/pacientes/${patientId}/prontuario/consulta/${enc.id}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 11,
                      color: T.textSecondary,
                      textDecoration: 'none',
                      padding: '3px 0',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {enc.chiefComplaint?.slice(0, 30) || enc.type}
                    </span>
                    <Mono size={8} color={T.textMuted}>
                      {formatDate(enc.createdAt)}
                    </Mono>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Active prescriptions */}
          {activePrescriptions.length > 0 && (
            <div
              style={{
                padding: '7px 10px',
                borderRadius: T.r.md,
                background: T.glass,
                border: `1px solid ${T.glassBorder}`,
              }}
            >
              <Mono size={7} spacing="0.8px">PRESCRIÇÃO ATIVA</Mono>
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {activePrescriptions.map((rx) => (
                  <p key={rx.id} style={{ fontSize: 11, color: T.textSecondary, margin: 0 }}>
                    {rx.type} — {formatDate(rx.createdAt)}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Open full prontuário */}
          <Link
            href={`/pacientes/${patientId}/prontuario`}
            style={{ textDecoration: 'none' }}
          >
            <Btn variant="glass" small icon="file" style={{ width: '100%' }}>
              Abrir prontuário completo
            </Btn>
          </Link>
        </div>
      }
    />
  );
}
