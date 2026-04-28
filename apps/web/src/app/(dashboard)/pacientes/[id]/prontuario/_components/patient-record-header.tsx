"use client";

import * as React from "react";
import {
  Badge,
  Btn,
  Glass,
  Ico,
  MetalTag,
  Mono,
  T,
  type IcoName,
} from "@dermaos/ui/ds";
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  getDisplayStatus,
  isFinalized,
  type EncounterFull,
} from "./types";

export interface PatientRecordHeaderProps {
  patientId: string;
  patient: {
    name: string;
    preferredName?: string | null;
    civilName?: string | null;
    age?: number | null;
    gender?: string | null;
    birthDate?: Date | string | null;
    photoUrl?: string | null;
    allergies: string[];
    activeMedications: string[];
    chronicConditions: string[];
  };
  selectedEncounter?: EncounterFull | null;
  /** legado — não renderizado mais (botão "Voltar para Perfil" foi removido,
   *  basta usar a aba Perfil). Mantido na interface por compatibilidade. */
  onBackProfile: () => void;
  onNewRecord: () => void;
  /** legado — Nova prescrição agora vive no header global via toolbar. */
  onNewPrescription: () => void;
  onRequestExam: () => void;
  onAttachImage: () => void;
  onShare: () => void;
  onExportPdf: () => void;
}

/**
 * Context bar enxuta — mostra apenas o estado do encontro selecionado,
 * tags clínicos relevantes e ações específicas do prontuário. A identidade
 * do paciente (avatar/nome/idade) já é exibida pelo header global do layout
 * `[id]/layout.tsx`, então não duplicamos aqui.
 */
export function PatientRecordHeader({
  patient,
  selectedEncounter,
  onNewRecord,
  onRequestExam,
  onAttachImage,
  onShare,
  onExportPdf,
}: PatientRecordHeaderProps) {
  const status = selectedEncounter
    ? getDisplayStatus(selectedEncounter.status)
    : "draft";
  const shareAllowed = selectedEncounter
    ? isFinalized(selectedEncounter.status)
    : false;
  const hasMeds = patient.activeMedications.length > 0;
  const hasConditions = patient.chronicConditions.length > 0;
  const hasNoAllergies = patient.allergies.length === 0;

  return (
    <Glass
      metal
      style={{
        flexShrink: 0,
        borderRadius: 0,
        borderLeft: "none",
        borderRight: "none",
        borderTop: "none",
        padding: "10px 22px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Eyebrow + tags clínicos */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: 1,
            minWidth: 0,
            flexWrap: "wrap",
          }}
        >
          <Mono size={9} spacing="1.2px" color={T.clinical.color}>
            ENCONTRO
          </Mono>
          <Badge variant={STATUS_VARIANT[status]} dot={false}>
            {selectedEncounter
              ? STATUS_LABEL[status]
              : "Nenhum selecionado"}
          </Badge>
          {selectedEncounter?.appointmentId && (
            <MetalTag>VINCULADO À AGENDA</MetalTag>
          )}
          <MetalTag>REGULATED SENSITIVE</MetalTag>
          {hasNoAllergies && (
            <Badge variant="success" dot={false}>
              Sem alergias registradas
            </Badge>
          )}
          {hasMeds && (
            <Badge variant="info" dot={false}>
              {patient.activeMedications.length} medicação(ões) ativa(s)
            </Badge>
          )}
          {hasConditions && (
            <Badge variant="warning" dot={false}>
              {patient.chronicConditions.length} risco(s) clínico(s)
            </Badge>
          )}
        </div>

        {/* Ações específicas do prontuário */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <Btn small icon="plus" onClick={onNewRecord}>
            Novo registro
          </Btn>
          <IconAction
            icon="activity"
            label="Solicitar exame"
            onClick={onRequestExam}
          />
          <IconAction
            icon="image"
            label="Anexar imagem"
            onClick={onAttachImage}
          />
          <IconAction
            icon="link"
            label="Compartilhar este encontro"
            onClick={onShare}
            disabled={!shareAllowed}
          />
          <IconAction
            icon="download"
            label="Exportar PDF deste encontro"
            onClick={onExportPdf}
            disabled={!selectedEncounter}
          />
        </div>
      </div>
    </Glass>
  );
}

function IconAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: IcoName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 30,
        height: 30,
        borderRadius: T.r.md,
        background: disabled ? T.glass : T.inputBg,
        border: `1px solid ${T.inputBorder}`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Ico
        name={icon}
        size={13}
        color={disabled ? T.textMuted : T.textPrimary}
      />
    </button>
  );
}
