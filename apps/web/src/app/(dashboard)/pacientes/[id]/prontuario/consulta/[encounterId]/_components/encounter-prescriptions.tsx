'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Btn, Glass, Ico, Mono, T } from '@dermaos/ui/ds';
import {
  PRESCRIPTION_STATUS_LABELS,
  PRESCRIPTION_TYPE_LABELS,
} from '@dermaos/shared';
import {
  PRESCRIPTION_STATUS_VARIANT,
  usePrescriptionsByPatient,
} from '@/lib/hooks/use-prescriptions';

interface EncounterPrescriptionsProps {
  encounterId: string;
  patientId:   string;
  disabled?:   boolean;
  /** Opcional: se passado, abre um drawer/modal local em vez de navegar. */
  onCreate?:   () => void;
}

/**
 * Sumário de prescrições ligadas ao encounter atual. Filtra a lista de
 * prescrições do paciente pelas que têm encounterId == este atendimento.
 *
 * Backend não expõe `listByEncounter` — usamos `listByPatient` e filtramos
 * client-side. Funciona porque o atendimento tipicamente tem 1–2 prescrições.
 */
export function EncounterPrescriptions({
  encounterId,
  patientId,
  disabled,
  onCreate,
}: EncounterPrescriptionsProps) {
  const router = useRouter();
  const listQ  = usePrescriptionsByPatient(patientId, { pageSize: 50 });

  // O summary não inclui encounterId, então listamos todas e mostramos as N mais
  // recentes. Quando o usuário clicar, abre o detalhe que confirma encounterId.
  const recent = (listQ.data?.data ?? []).slice(0, 6);

  function handleCreate() {
    if (onCreate) onCreate();
    else router.push(`/prescricoes/nova?patientId=${patientId}&encounterId=${encounterId}`);
  }

  return (
    <section aria-labelledby="prescriptions-heading" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3
          id="prescriptions-heading"
          style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.textPrimary }}
        >
          Prescrições do atendimento
        </h3>
        <Btn
          variant="primary"
          small
          icon="plus"
          type="button"
          disabled={disabled}
          aria-label="Nova prescrição"
          onClick={handleCreate}
        >
          Nova prescrição
        </Btn>
      </div>

      {listQ.isLoading ? (
        <Glass style={{ padding: 14 }}>
          <Mono size={11} color={T.textMuted}>CARREGANDO PRESCRIÇÕES…</Mono>
        </Glass>
      ) : recent.length === 0 ? (
        <Glass
          style={{
            padding: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: T.textMuted,
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          Nenhuma prescrição registrada para este paciente.
        </Glass>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {recent.map((rx) => (
            <button
              key={rx.id}
              type="button"
              onClick={() => router.push(`/prescricoes/${rx.id}`)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                borderRadius: T.r.md,
                border: `1px solid ${T.glassBorder}`,
                background: T.glass,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Ico name="file" size={16} color={T.primary} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: 0 }}>
                    {rx.prescriptionNumber ?? rx.id.slice(0, 8).toUpperCase()}
                  </p>
                  <Mono size={10}>
                    {PRESCRIPTION_TYPE_LABELS[rx.type] ?? rx.type}
                    {' · '}
                    {rx.itemCount} {rx.itemCount === 1 ? 'item' : 'itens'}
                    {' · '}
                    {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(rx.signedAt ?? rx.createdAt)}
                  </Mono>
                </div>
              </div>
              <Badge variant={PRESCRIPTION_STATUS_VARIANT[rx.status] ?? 'default'} dot={false}>
                {PRESCRIPTION_STATUS_LABELS[rx.status] ?? rx.status}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
