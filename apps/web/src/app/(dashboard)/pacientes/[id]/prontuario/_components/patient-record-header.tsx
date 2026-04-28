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

const GENDER_LABELS: Record<string, string> = {
  female: "Feminino",
  male: "Masculino",
  non_binary: "Não-binário",
  prefer_not_to_say: "Prefere não informar",
  other: "Outro",
};

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "Nascimento não informado";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "Nascimento não informado";
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

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
  onBackProfile: () => void;
  onNewRecord: () => void;
  onNewPrescription: () => void;
  onRequestExam: () => void;
  onAttachImage: () => void;
  onShare: () => void;
  onExportPdf: () => void;
}

export function PatientRecordHeader({
  patientId,
  patient,
  selectedEncounter,
  onBackProfile,
  onNewRecord,
  onNewPrescription,
  onRequestExam,
  onAttachImage,
  onShare,
  onExportPdf,
}: PatientRecordHeaderProps) {
  const displayName = patient.preferredName?.trim() || patient.name;
  const civilName =
    patient.civilName?.trim() && patient.civilName !== displayName
      ? patient.civilName
      : patient.name !== displayName
        ? patient.name
        : null;
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const status = selectedEncounter
    ? getDisplayStatus(selectedEncounter.status)
    : "draft";
  const shareAllowed = selectedEncounter
    ? isFinalized(selectedEncounter.status)
    : false;
  const meta = [
    patient.age != null ? `${patient.age} anos` : null,
    patient.gender ? (GENDER_LABELS[patient.gender] ?? patient.gender) : null,
    fmtDate(patient.birthDate),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Glass
      metal
      style={{
        flexShrink: 0,
        borderRadius: 0,
        borderLeft: "none",
        borderRight: "none",
        borderTop: "none",
        padding: "12px 18px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 1fr) minmax(220px, 0.9fr) auto",
          gap: 14,
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            minWidth: 0,
          }}
        >
          {patient.photoUrl ? (
            <img
              src={patient.photoUrl}
              alt=""
              aria-hidden
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                objectFit: "cover",
                border: `2px solid ${T.clinical.color}30`,
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              aria-hidden
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: T.clinical.bg,
                border: `2px solid ${T.clinical.color}30`,
                color: T.clinical.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initials || "P"}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <Mono size={8} spacing="1.2px" color={T.clinical.color}>
              PRONTUÁRIO · {patientId.slice(0, 8).toUpperCase()}
            </Mono>
            <h1
              style={{
                fontSize: 18,
                lineHeight: 1.15,
                color: T.textPrimary,
                fontWeight: 700,
                margin: "3px 0 2px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayName}
            </h1>
            <p style={{ margin: 0, fontSize: 11, color: T.textSecondary }}>
              {civilName ? `Nome civil: ${civilName} · ` : ""}
              {meta}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <Badge variant={STATUS_VARIANT[status]} dot={false}>
              {selectedEncounter
                ? STATUS_LABEL[status]
                : "Sem registro selecionado"}
            </Badge>
            {selectedEncounter?.appointmentId && (
              <MetalTag>ENCOUNTER VINCULADO</MetalTag>
            )}
            <MetalTag>REGULATED SENSITIVE</MetalTag>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              flexWrap: "wrap",
            }}
          >
            {patient.allergies.length > 0 ? (
              patient.allergies.slice(0, 3).map((a) => (
                <Badge key={a} variant="danger" dot={false}>
                  {a}
                </Badge>
              ))
            ) : (
              <Badge variant="success" dot={false}>
                Sem alergias registradas
              </Badge>
            )}
            {patient.activeMedications.length > 0 && (
              <Badge variant="info" dot={false}>
                {patient.activeMedications.length} medicação(ões) ativa(s)
              </Badge>
            )}
            {patient.chronicConditions.length > 0 && (
              <Badge variant="warning" dot={false}>
                {patient.chronicConditions.length} risco(s) clínico(s)
              </Badge>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <Btn variant="ghost" small icon="arrowLeft" onClick={onBackProfile}>
            Perfil
          </Btn>
          <Btn small icon="plus" onClick={onNewRecord}>
            Novo prontuário
          </Btn>
          <IconAction
            icon="file"
            label="Nova prescrição"
            onClick={onNewPrescription}
          />
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
            label="Compartilhar"
            onClick={onShare}
            disabled={!shareAllowed}
          />
          <IconAction
            icon="download"
            label="Exportar PDF"
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
        width: 32,
        height: 32,
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
        size={14}
        color={disabled ? T.textMuted : T.textPrimary}
      />
    </button>
  );
}
