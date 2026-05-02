'use client';

import * as React from 'react';
import { Glass, Ico, Mono, Badge, Skeleton, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { usePermission } from '@/lib/auth';
import { maskPhone, GENDER_LABELS } from '@/lib/adapters/patient-adapter';
import { maskEmail } from '@/lib/privacy';

interface PatientContextSidebarProps {
  patientId: string;
}

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <Mono size={9} spacing="1.1px" color={T.primary} style={{ marginBottom: 8 }}>
        {title}
      </Mono>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0' }}>
      <span style={{ fontSize: 12, color: T.textMuted, fontFamily: "'IBM Plex Sans', sans-serif" }}>
        {label}
      </span>
      <span style={{
        fontSize: 13, color: T.textPrimary, fontWeight: 500,
        fontFamily: mono ? "'IBM Plex Mono', monospace" : "'IBM Plex Sans', sans-serif",
        textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

export function PatientContextSidebar({ patientId }: PatientContextSidebarProps) {
  const canReadClinical = usePermission('clinical', 'read');

  const { data, isLoading } = trpc.patients.getById.useQuery(
    { id: patientId },
    { staleTime: 30_000, refetchOnWindowFocus: false },
  );

  const p = data?.patient;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={60} delay={i * 60} />
        ))}
      </div>
    );
  }

  if (!p) return null;

  return (
    <>
      {/* Dados Pessoais */}
      <SideSection title="DADOS PESSOAIS">
        <Glass style={{ padding: '12px 14px' }}>
          <InfoRow label="Gênero" value={p.gender ? GENDER_LABELS[p.gender] ?? p.gender : null} />
          <InfoRow label="Nascimento" value={formatDate(p.birthDate)} />
          <InfoRow label="Tipo sanguíneo" value={p.bloodType ?? null} />
          <InfoRow label="Total de visitas" value={p.totalVisits?.toString() ?? '0'} mono />
        </Glass>
      </SideSection>

      {/* Contato */}
      <SideSection title="CONTATO">
        <Glass style={{ padding: '12px 14px' }}>
          <InfoRow label="Telefone" value={maskPhone(p.phone)} mono />
          {p.phoneSecondary && (
            <InfoRow label="Secundário" value={maskPhone(p.phoneSecondary)} mono />
          )}
          <InfoRow label="Email" value={maskEmail(p.email) ?? null} />
        </Glass>
      </SideSection>

      {/* Alergias */}
      {p.allergies.length > 0 && (
        <SideSection title="ALERGIAS">
          <Glass style={{
            padding: '12px 14px',
            border: '1px solid #FECACA',
            background: '#FEF2F2',
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {p.allergies.map((a) => (
                <span
                  key={a}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: T.r.pill,
                    background: '#fff', border: '1px solid #FECACA',
                    color: '#991B1B', fontSize: 12, fontWeight: 600,
                  }}
                >
                  <Ico name="alert" size={11} color="#991B1B" />
                  {a}
                </span>
              ))}
            </div>
          </Glass>
        </SideSection>
      )}

      {/* Medicamentos em uso — requer acesso clínico */}
      {canReadClinical && p.activeMedications.length > 0 && (
        <SideSection title="MEDICAMENTOS EM USO">
          <Glass style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {p.activeMedications.map((m) => (
                <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: T.primary, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 13, color: T.textPrimary }}>{m}</span>
                </div>
              ))}
            </div>
          </Glass>
        </SideSection>
      )}

      {/* Condições crônicas — requer acesso clínico */}
      {canReadClinical && p.chronicConditions.length > 0 && (
        <SideSection title="CONDIÇÕES CRÔNICAS">
          <Glass style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {p.chronicConditions.map((c, i) => (
                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary }}>
                    {c}
                  </span>
                  {i === 0 && p.chronicConditions.length > 1 && (
                    <Badge variant="default" dot={false}>principal</Badge>
                  )}
                </div>
              ))}
            </div>
          </Glass>
        </SideSection>
      )}

      {/* Última e próxima consulta */}
      <SideSection title="CONSULTAS">
        <Glass style={{ padding: '12px 14px' }}>
          <InfoRow label="Última consulta" value={formatDate(p.lastVisitAt)} />
          {/* TODO: integrar próxima consulta quando scheduling expor listByPatient */}
          <InfoRow label="Total de visitas" value={p.totalVisits?.toString() ?? '0'} mono />
        </Glass>
      </SideSection>

      {/* Notas internas */}
      {p.internalNotes && (
        <SideSection title="NOTAS INTERNAS">
          <Glass style={{ padding: '12px 14px' }}>
            <p style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6 }}>
              {p.internalNotes}
            </p>
          </Glass>
        </SideSection>
      )}
    </>
  );
}
