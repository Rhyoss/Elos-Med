'use client';

import * as React from 'react';
import Link from 'next/link';
import { Glass, Ico, Mono, T, Badge } from '@dermaos/ui/ds';
import { SaveStatusIndicator, type SaveStatus } from './save-status';
import { TemplatePanel, type TemplateSection } from './template-panel';

/* ── Action card ───────────────────────────────────────────────────── */

interface ActionCardProps {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  sub: string;
  onClick?: () => void;
  disabled?: boolean;
  badge?: string;
}

function ActionCard({ icon, iconBg, iconColor, label, sub, onClick, disabled, badge }: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '9px 11px',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        background: T.glass,
        border: `1px solid ${T.glassBorder}`,
        borderRadius: T.r.md,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.12s',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'rgba(0,0,0,0.02)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = T.glass; }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: T.r.md,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 14,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, margin: 0 }}>
            {label}
          </p>
          {badge && (
            <Badge variant="info" dot={false}>{badge}</Badge>
          )}
        </div>
        <p style={{ fontSize: 10, color: T.textMuted, margin: '1px 0 0' }}>
          {sub}
        </p>
      </div>
    </button>
  );
}

/* ── Main panel ────────────────────────────────────────────────────── */

interface EncounterActionsPanelProps {
  encounterId: string;
  patientId: string;
  isSigned: boolean;
  saveStatus: SaveStatus;
  onPersist: () => void;
  onOpenPrescription: () => void;
  onOpenFinalization: () => void;
  onOpenAddendum: () => void;
  onApplyTemplate: (sections: TemplateSection[]) => void;
  prescriptionCount?: number;
  imageCount?: number;
}

export function EncounterActionsPanel({
  encounterId,
  patientId,
  isSigned,
  saveStatus,
  onPersist,
  onOpenPrescription,
  onOpenFinalization,
  onOpenAddendum,
  onApplyTemplate,
  prescriptionCount = 0,
  imageCount = 0,
}: EncounterActionsPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Save status */}
      <Glass
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <SaveStatusIndicator
          status={saveStatus}
          onRetry={saveStatus.kind === 'error' ? onPersist : undefined}
        />
      </Glass>

      {/* Templates */}
      {!isSigned && (
        <TemplatePanel
          onApplyTemplate={onApplyTemplate}
          disabled={isSigned}
        />
      )}

      {/* Section header */}
      <Mono size={8} spacing="1px" color={T.textMuted} style={{ padding: '4px 0 0' }}>
        AÇÕES DO ATENDIMENTO
      </Mono>

      {/* Prescription */}
      <ActionCard
        icon="📋"
        iconBg={T.clinical.bg}
        iconColor={T.clinical.color}
        label="Prescrição"
        sub={prescriptionCount > 0 ? `${prescriptionCount} emitida${prescriptionCount > 1 ? 's' : ''}` : 'Criar prescrição'}
        onClick={onOpenPrescription}
        disabled={isSigned}
        badge={prescriptionCount > 0 ? String(prescriptionCount) : undefined}
      />

      {/* Images / Photos */}
      <ActionCard
        icon="📷"
        iconBg="rgba(59,130,246,0.08)"
        iconColor="#3B82F6"
        label="Fotos clínicas"
        sub={imageCount > 0 ? `${imageCount} imagem(ns)` : 'Upload / captura'}
        onClick={() => {
          // TODO: Integrate with lesion upload flow when image upload is connected
        }}
        disabled={isSigned}
        badge={imageCount > 0 ? String(imageCount) : undefined}
      />

      {/* Procedures */}
      <Link
        href={`/pacientes/${patientId}/prontuario?tab=protocolos`}
        style={{ textDecoration: 'none' }}
      >
        <ActionCard
          icon="⚡"
          iconBg="rgba(168,85,247,0.08)"
          iconColor="#A855F7"
          label="Procedimento"
          sub="Registrar via protocolo"
        />
      </Link>

      {/* Documents */}
      <ActionCard
        icon="📄"
        iconBg="rgba(107,114,128,0.08)"
        iconColor="#6B7280"
        label="Documento / Termo"
        sub="Gerar PDF"
        onClick={() => {
          // TODO: Integrate with document generation when available
        }}
        disabled={isSigned}
      />

      {/* Follow-up */}
      <Link
        href={`/agenda?paciente=${patientId}`}
        style={{ textDecoration: 'none' }}
      >
        <ActionCard
          icon="📅"
          iconBg={T.primaryBg}
          iconColor={T.primary}
          label="Agendar retorno"
          sub="Abrir agenda pré-preenchida"
        />
      </Link>

      {/* Divider */}
      <div style={{ height: 1, background: T.divider, margin: '2px 0' }} />

      {/* Finalize or Addendum */}
      {isSigned ? (
        <>
          <Glass
            style={{
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(34,139,34,0.04)',
              border: `1px solid rgba(34,139,34,0.15)`,
            }}
          >
            <Ico name="shield" size={16} color={T.success} />
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: T.success, margin: 0 }}>
                Prontuário assinado
              </p>
              <p style={{ fontSize: 10, color: T.textMuted, margin: '1px 0 0' }}>
                Edição direta não é permitida
              </p>
            </div>
          </Glass>
          <ActionCard
            icon="✏️"
            iconBg="rgba(234,179,8,0.08)"
            iconColor="#EAB308"
            label="Adicionar adendo"
            sub="Correção com justificativa"
            onClick={onOpenAddendum}
          />
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onPersist}
            style={{
              width: '100%',
              padding: '9px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: T.glass,
              border: `1px solid ${T.glassBorder}`,
              borderRadius: T.r.md,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              color: T.textSecondary,
              fontFamily: "'IBM Plex Sans', sans-serif",
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.02)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = T.glass; }}
          >
            <Ico name="download" size={14} color={T.textMuted} />
            Salvar rascunho
          </button>

          <button
            type="button"
            onClick={onOpenFinalization}
            style={{
              width: '100%',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: T.primary,
              border: 'none',
              borderRadius: T.r.md,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              fontFamily: "'IBM Plex Sans', sans-serif",
              transition: 'opacity 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            <Ico name="shield" size={15} color="#fff" />
            Finalizar atendimento
          </button>
        </>
      )}
    </div>
  );
}
