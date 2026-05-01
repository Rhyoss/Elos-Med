'use client';

import * as React from 'react';
import { Badge, Btn, Ico, Mono, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { buildDisplayId, GENDER_LABELS, STATUS_LABELS, STATUS_BADGE_VARIANT, maskCpf } from '@/lib/adapters/patient-adapter';

interface PatientHeaderProps {
  patientId: string;
  onNovaConsulta: () => void;
  onContinuarAtendimento?: () => void;
  hasOpenDraft: boolean;
  isStarting: boolean;
  onNovaPrescrição?: () => void;
  onUploadFotos?: () => void;
  onNovoDocumento?: () => void;
  onAgendarRetorno?: () => void;
}

export function PatientHeader({
  patientId,
  onNovaConsulta,
  onContinuarAtendimento,
  hasOpenDraft,
  isStarting,
  onNovaPrescrição,
  onUploadFotos,
  onNovoDocumento,
  onAgendarRetorno,
}: PatientHeaderProps) {
  const { data, isLoading } = trpc.patients.getById.useQuery(
    { id: patientId },
    { staleTime: 30_000, refetchOnWindowFocus: false },
  );

  const p = data?.patient;

  const initials = (p?.name ?? '')
    .trim().split(' ').filter(Boolean)
    .map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const details = [
    p?.age != null ? `${p.age} anos` : null,
    p?.gender ? GENDER_LABELS[p.gender] ?? p.gender : null,
  ].filter(Boolean).join(' · ');

  return (
    <div style={{
      background: '#fff',
      borderBottom: `1px solid ${T.divider}`,
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexShrink: 0,
    }}>
      {/* Avatar */}
      <div
        aria-hidden
        style={{
          width: 48, height: 48, borderRadius: '50%',
          background: T.clinical.bg, border: `2px solid ${T.clinical.color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: T.clinical.color, fontWeight: 700,
          fontSize: 16, fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        {initials || <Ico name="user" size={22} color={T.clinical.color} />}
      </div>

      {/* Identity */}
      <div style={{ minWidth: 0, flex: '0 1 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <p style={{
            fontSize: 17, fontWeight: 700, color: T.textPrimary,
            lineHeight: 1.2, fontFamily: "'IBM Plex Sans', sans-serif",
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {isLoading ? 'Carregando…' : p?.name ?? '—'}
          </p>
          {p && (
            <Badge variant={STATUS_BADGE_VARIANT[p.status] ?? 'default'} dot={false}>
              {STATUS_LABELS[p.status] ?? p.status}
            </Badge>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <Mono size={10} color={T.textMuted}>
            ID {buildDisplayId(patientId)}
          </Mono>
          {details && (
            <>
              <span style={{ color: T.textMuted, fontSize: 10 }}>·</span>
              <Mono size={10} color={T.textMuted}>{details}</Mono>
            </>
          )}
          {p?.cpf && (
            <>
              <span style={{ color: T.textMuted, fontSize: 10 }}>·</span>
              <Mono size={10} color={T.textMuted}>CPF {maskCpf(p.cpf)}</Mono>
            </>
          )}
        </div>
      </div>

      {/* Allergy alerts */}
      {p && p.allergies.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 4 }}>
          {p.allergies.map((a) => (
            <span
              key={a}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: T.r.pill,
                background: '#FEF2F2', border: '1px solid #FECACA',
                color: '#991B1B', fontSize: 12, fontWeight: 600,
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              <Ico name="alert" size={12} color="#991B1B" />
              {a}
            </span>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        {onNovaPrescrição && (
          <Btn variant="ghost" small icon="file" onClick={onNovaPrescrição}>
            Prescrição
          </Btn>
        )}
        {onUploadFotos && (
          <Btn variant="ghost" small icon="image" onClick={onUploadFotos}>
            Fotos
          </Btn>
        )}
        {onNovoDocumento && (
          <Btn variant="ghost" small icon="file" onClick={onNovoDocumento}>
            Documento
          </Btn>
        )}
        {onAgendarRetorno && (
          <Btn variant="ghost" small icon="calendar" onClick={onAgendarRetorno}>
            Retorno
          </Btn>
        )}

        <div style={{ width: 1, height: 28, background: T.divider, margin: '0 4px' }} />

        {hasOpenDraft ? (
          <Btn small icon="edit" onClick={onContinuarAtendimento}>
            Continuar Atendimento
          </Btn>
        ) : (
          <Btn small icon="edit" onClick={onNovaConsulta} disabled={isStarting}>
            {isStarting ? 'Abrindo…' : 'Nova Consulta'}
          </Btn>
        )}
      </div>
    </div>
  );
}
