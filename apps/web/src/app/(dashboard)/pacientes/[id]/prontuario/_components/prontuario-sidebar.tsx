'use client';

import * as React from 'react';
import { Btn, Ico, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { buildDisplayId, GENDER_LABELS as GENDER_LABELS_MAP } from '@/lib/adapters/patient-adapter';

interface ProntuarioHeaderProps {
  patientId: string;
  onNovaPrescrição?: () => void;
  onNovaConsulta?: () => void;
  onVerImagens?: () => void;
  onContinuarAtendimento?: () => void;
  hasOpenDraft?: boolean;
  isStarting?: boolean;
}

const GENDER_LABELS = GENDER_LABELS_MAP;

const PATIENT_STATUS_LABEL: Record<string, string> = {
  active:      'Ativa',
  inactive:    'Inativa',
  archived:    'Arquivada',
  blocked:     'Bloqueada',
  deceased:    'Falecida',
  transferred: 'Transferida',
};

const pillBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 10px',
  borderRadius: T.r.pill,
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "'IBM Plex Sans', sans-serif",
  whiteSpace: 'nowrap',
};

const actionBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 12px',
  borderRadius: T.r.sm,
  background: '#fff',
  border: '1px solid #CED4DA',
  color: T.textPrimary,
  fontSize: 12,
  fontWeight: 500,
  fontFamily: "'IBM Plex Sans', sans-serif",
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export function ProntuarioSidebar({
  patientId,
  onNovaPrescrição,
  onNovaConsulta,
  onVerImagens,
  onContinuarAtendimento,
  hasOpenDraft,
  isStarting,
}: ProntuarioHeaderProps) {
  const { data, isLoading } = trpc.patients.getById.useQuery(
    { id: patientId },
    { staleTime: 30_000, refetchOnWindowFocus: false },
  );

  const p = data?.patient;

  const initials = (p?.name ?? '')
    .trim().split(' ').filter(Boolean)
    .map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const details = [
    `ID: ${buildDisplayId(patientId)}`,
    p?.age != null ? `${p.age} anos` : null,
    p?.gender ? GENDER_LABELS[p.gender] ?? p.gender : null,
  ].filter(Boolean).join(' · ');

  return (
    <div style={{
      background: '#F5F5F5',
      borderBottom: `1px solid ${T.divider}`,
      padding: '8px 20px',
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
    }}>
      {/* ── Group 1: Identity + Status pills ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, justifyContent: 'flex-start' }}>
        <div
          aria-hidden
          style={{
            width: 42, height: 42, borderRadius: '50%',
            background: T.clinical.bg, border: `2px solid ${T.divider}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: T.clinical.color, fontWeight: 700,
            fontSize: 15, fontFamily: "'IBM Plex Sans', sans-serif",
          }}
        >
          {initials || <Ico name="user" size={20} color={T.clinical.color} />}
        </div>
        <div style={{ flexShrink: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, lineHeight: 1.2, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {isLoading ? 'Carregando…' : p?.name ?? '—'}
          </p>
          <p style={{ fontSize: 11, color: T.textMuted, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {details}
          </p>
        </div>
        {p && (
          <span style={{ ...pillBase, background: '#D4EDDA', color: '#155724' }}>
            + {PATIENT_STATUS_LABEL[p.status] ?? p.status}
          </span>
        )}
        {p && p.allergies.map((a) => (
          <span key={a} style={{ ...pillBase, background: '#F8D7DA', color: '#721C24' }}>
            Alergia: {a.charAt(0).toUpperCase() + a.slice(1)}
          </span>
        ))}
      </div>

      {/* ── Group 2: Action buttons (centered) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, justifyContent: 'center' }}>
        <button type="button" onClick={onNovaPrescrição} style={actionBtn}>
          <Ico name="file" size={14} color={T.textSecondary} />+ Nova Prescrição
        </button>
        <button type="button" onClick={onNovaConsulta} disabled={isStarting}
          style={{ ...actionBtn, opacity: isStarting ? 0.5 : 1 }}>
          <Ico name="calendar" size={14} color={T.textSecondary} />{isStarting ? 'Abrindo…' : '+ Nova Consulta'}
        </button>
        <button type="button" onClick={onVerImagens} style={actionBtn}>
          <Ico name="image" size={14} color={T.textSecondary} />Ver Imagens
        </button>
      </div>

      {/* ── Group 3: CTA ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
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
