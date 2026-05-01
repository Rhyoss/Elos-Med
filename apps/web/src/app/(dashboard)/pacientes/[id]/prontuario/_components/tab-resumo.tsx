'use client';

import * as React from 'react';
import { Badge, Bar, Btn, Glass, Ico, Mono, Skeleton, T } from '@dermaos/ui/ds';
import { PROTOCOL_STATUS_LABELS, PRESCRIPTION_STATUS_LABELS } from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';

interface TabResumoProps {
  patientId: string;
  onOpenEncounter?: (encounterId: string) => void;
  onNovaConsulta?: () => void;
}

const ENCOUNTER_TYPE_LABEL: Record<string, string> = {
  clinical:     'Consulta clínica',
  aesthetic:    'Procedimento estético',
  followup:     'Retorno',
  emergency:    'Urgência',
  telemedicine: 'Telemedicina',
};

const ENCOUNTER_STATUS_LABEL: Record<string, string> = {
  rascunho:  'Rascunho',
  revisao:   'Em revisão',
  assinado:  'Assinada',
  corrigido: 'Corrigida',
};

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TabResumo({ patientId, onOpenEncounter, onNovaConsulta }: TabResumoProps) {
  const patientQ = trpc.patients.getById.useQuery(
    { id: patientId },
    { staleTime: 30_000, refetchOnWindowFocus: false },
  );
  const patient = patientQ.data?.patient;

  const encountersQ = trpc.clinical.encounters.getByPatient.useQuery({
    patientId, page: 1, pageSize: 5,
  });

  const prescriptionsQ = trpc.clinical.prescriptions.listByPatient.useQuery({
    patientId, page: 1, pageSize: 5,
  });

  const protocolsQ = trpc.clinical.protocols.listByPatient.useQuery({ patientId });

  const imagesQ = trpc.clinical.lesions.listPatientImages.useQuery({
    patientId, page: 1, pageSize: 4,
  });

  const lastEncounter = encountersQ.data?.data?.[0];
  const lastEncounterFullQ = trpc.clinical.encounters.getById.useQuery(
    { id: lastEncounter?.id ?? '' },
    { enabled: !!lastEncounter?.id, staleTime: 30_000 },
  );
  const lastEncounterFull = lastEncounterFullQ.data?.encounter;
  const vitals = lastEncounterFull?.vitalSigns;

  const ACTIVE_RX_STATUSES = ['emitida', 'assinada', 'enviada_digital', 'impressa'];
  const activePrescription = prescriptionsQ.data?.data.find((rx) => ACTIVE_RX_STATUSES.includes(rx.status));
  const activeProtocol = protocolsQ.data?.protocols?.find(
    (p) => p.status === 'ativo' || p.status === 'pausado',
  );

  const recentImages = imagesQ.data?.data ?? [];
  const draftEncounters = encountersQ.data?.data.filter((e) => e.status === 'rascunho' || e.status === 'revisao') ?? [];

  const isLoading = patientQ.isLoading || encountersQ.isLoading;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={80} delay={i * 60} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={120} delay={i * 80} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Alertas / Pendências */}
      {(draftEncounters.length > 0 || (patient?.allergies.length ?? 0) > 0) && (
        <section style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {draftEncounters.map((d) => (
            <Glass
              key={d.id}
              hover
              style={{
                padding: '10px 14px', cursor: 'pointer',
                border: '1px solid #FDE68A', background: '#FFFBEB',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onClick={() => onOpenEncounter?.(d.id)}
            >
              <Ico name="edit" size={14} color="#D97706" />
              <span style={{ fontSize: 13, color: '#92400E', fontWeight: 500 }}>
                {ENCOUNTER_TYPE_LABEL[d.type] ?? d.type} em rascunho
              </span>
              <Badge variant="warning" dot={false}>Pendente</Badge>
            </Glass>
          ))}
        </section>
      )}

      {/* Vitals */}
      <section>
        <Mono size={9} spacing="1.2px" color={T.primary}>
          {vitals
            ? `SINAIS VITAIS — ÚLTIMA AFERIÇÃO (${formatDate(vitals.recordedAt)})`
            : 'SINAIS VITAIS — SEM AFERIÇÕES'}
        </Mono>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginTop: 10 }}>
          {[
            {
              label: 'PRESSÃO',
              value: vitals?.bloodPressureSys && vitals?.bloodPressureDia
                ? `${vitals.bloodPressureSys}/${vitals.bloodPressureDia}` : '—',
              unit: 'mmHg',
            },
            { label: 'FC',    value: vitals?.heartRate?.toString()        ?? '—', unit: 'bpm'   },
            { label: 'SpO₂',  value: vitals?.oxygenSaturation?.toString() ?? '—', unit: '%'     },
            { label: 'TEMP.', value: vitals?.temperatureC?.toString()     ?? '—', unit: '°C'    },
            { label: 'IMC',   value: vitals?.bmi?.toFixed(1)              ?? '—', unit: 'kg/m²' },
          ].map((v) => (
            <Glass key={v.label} style={{ padding: '12px 14px', textAlign: 'center' }}>
              <Mono size={9}>{v.label}</Mono>
              <p style={{
                fontSize: 22, fontWeight: 700, color: T.textPrimary,
                margin: '6px 0 2px', letterSpacing: '-0.02em',
              }}>
                {v.value}
              </p>
              <Mono size={9} color={T.textMuted}>{v.unit}</Mono>
            </Glass>
          ))}
        </div>
      </section>

      {/* Diagnósticos + Medicamentos */}
      {patient && (patient.chronicConditions.length > 0 || patient.activeMedications.length > 0) && (
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {patient.chronicConditions.length > 0 && (
            <Glass style={{ padding: '14px 18px' }}>
              <Mono size={9} spacing="1px" color={T.primary}>DIAGNÓSTICOS ATIVOS</Mono>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {patient.chronicConditions.map((c, i) => (
                  <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </span>
                    <Badge variant="default" dot={false}>
                      {i === 0 ? 'principal' : 'secundária'}
                    </Badge>
                  </div>
                ))}
              </div>
            </Glass>
          )}
          {patient.activeMedications.length > 0 && (
            <Glass style={{ padding: '14px 18px' }}>
              <Mono size={9} spacing="1px" color={T.primary}>MEDICAMENTOS ATIVOS</Mono>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {patient.activeMedications.map((m) => (
                  <p key={m} style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary }}>{m}</p>
                ))}
              </div>
            </Glass>
          )}
        </section>
      )}

      {/* Last encounter + Active prescription */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Glass style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <Mono size={9} spacing="1px" color={T.primary}>ÚLTIMA CONSULTA</Mono>
            {lastEncounter && (
              <Badge variant={lastEncounter.signedAt ? 'success' : 'default'} dot={false}>
                {ENCOUNTER_STATUS_LABEL[lastEncounter.status] ?? lastEncounter.status}
              </Badge>
            )}
          </div>
          {lastEncounter ? (
            <button
              type="button"
              onClick={() => onOpenEncounter?.(lastEncounter.id)}
              style={{
                background: 'none', border: 'none', padding: 0,
                textAlign: 'left', width: '100%',
                cursor: onOpenEncounter ? 'pointer' : 'default',
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, marginBottom: 3 }}>
                {ENCOUNTER_TYPE_LABEL[lastEncounter.type] ?? lastEncounter.type}
              </p>
              <Mono size={10}>{formatDate(lastEncounter.createdAt)}</Mono>
              {lastEncounter.chiefComplaint && (
                <div style={{
                  marginTop: 10, padding: '8px 10px', borderRadius: T.r.md,
                  background: T.primaryBg, border: `1px solid ${T.primaryBorder}`,
                }}>
                  <Mono size={8} color={T.primary}>QUEIXA PRINCIPAL</Mono>
                  <p style={{ fontSize: 12, color: T.textPrimary, marginTop: 3 }}>
                    {lastEncounter.chiefComplaint}
                  </p>
                </div>
              )}
              {lastEncounter.diagnoses.length > 0 && (
                <div style={{
                  marginTop: 8, padding: '8px 10px', borderRadius: T.r.md,
                  background: T.glass, border: `1px solid ${T.glassBorder}`,
                }}>
                  <Mono size={8}>DIAGNÓSTICO</Mono>
                  <p style={{ fontSize: 12, color: T.textPrimary, marginTop: 3 }}>
                    {lastEncounter.diagnoses.map((d) => `${d.code} — ${d.description}`).join('; ')}
                  </p>
                </div>
              )}
            </button>
          ) : (
            <div style={{ padding: '12px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>
                Nenhuma consulta registrada.
              </p>
              {onNovaConsulta && (
                <Btn variant="glass" small icon="edit" onClick={onNovaConsulta}>Nova consulta</Btn>
              )}
            </div>
          )}
        </Glass>

        <Glass metal style={{ padding: '16px 18px' }}>
          <Mono size={9} spacing="1px" color={T.primary}>PRESCRIÇÃO ATIVA</Mono>
          {activePrescription ? (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>
                {activePrescription.itemCount} {activePrescription.itemCount === 1 ? 'medicamento' : 'medicamentos'}
              </p>
              <Mono size={10}>
                {formatDate(activePrescription.signedAt ?? activePrescription.createdAt)}
                {activePrescription.prescriptionNumber && ` · ${activePrescription.prescriptionNumber}`}
              </Mono>
              <div style={{ marginTop: 8 }}>
                <Badge variant="success" dot={false}>
                  {PRESCRIPTION_STATUS_LABELS[activePrescription.status] ?? activePrescription.status}
                </Badge>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: T.textMuted, marginTop: 10 }}>
              {prescriptionsQ.isLoading ? 'Carregando…' : 'Nenhuma prescrição ativa.'}
            </p>
          )}
        </Glass>
      </section>

      {/* Active Protocol */}
      {activeProtocol && (
        <Glass style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Mono size={9} spacing="1px" color={T.primary}>PROTOCOLO EM ANDAMENTO</Mono>
            <Badge variant={activeProtocol.status === 'ativo' ? 'success' : 'warning'}>
              {PROTOCOL_STATUS_LABELS[activeProtocol.status] ?? activeProtocol.status}
            </Badge>
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>
            {activeProtocol.name}
          </p>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
            <div>
              <Mono size={8}>SESSÕES</Mono>
              <p style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginTop: 2 }}>
                {activeProtocol.sessionsDone}/{activeProtocol.totalSessions}
              </p>
            </div>
            <div>
              <Mono size={8}>INÍCIO</Mono>
              <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
                {formatDate(activeProtocol.startedAt)}
              </p>
            </div>
            {activeProtocol.expectedEndDate && (
              <div>
                <Mono size={8}>PREVISÃO</Mono>
                <p style={{ fontSize: 12, color: T.primary, fontWeight: 600, marginTop: 2 }}>
                  {formatDate(activeProtocol.expectedEndDate)}
                </p>
              </div>
            )}
          </div>
          <Bar
            pct={(activeProtocol.sessionsDone / Math.max(1, activeProtocol.totalSessions)) * 100}
            color={T.clinical.color}
            height={5}
          />
        </Glass>
      )}

      {/* Fotos recentes */}
      {recentImages.length > 0 && (
        <section>
          <Mono size={9} spacing="1.2px" color={T.primary} style={{ marginBottom: 10 }}>
            FOTOS RECENTES
          </Mono>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {recentImages.map((img) => (
              <Glass key={img.id} style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{
                  height: 100,
                  background: img.thumbnailUrl
                    ? `center / cover url(${img.thumbnailUrl})`
                    : `linear-gradient(145deg, ${T.clinical.bg}, ${T.glass})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {!img.thumbnailUrl && <Ico name="image" size={24} color={T.textMuted} />}
                </div>
                <div style={{ padding: '8px 10px' }}>
                  <Mono size={9}>{formatDate(img.capturedAt)}</Mono>
                </div>
              </Glass>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
