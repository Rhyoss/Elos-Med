"use client";

import * as React from "react";
import { Badge, Btn, Glass, Ico, MetalTag, Mono, T } from "@dermaos/ui/ds";
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  TYPE_LABEL,
  getDisplayStatus,
  type EncounterFull,
  type RecordType,
} from "./types";

function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export interface RecordViewerProps {
  encounter: EncounterFull;
  isLoading?: boolean;
  onEdit?: () => void;
  onShare?: () => void;
  onExportPdf?: () => void;
  onAmend?: () => void;
}

/**
 * Read-only viewer for a finalized/signed encounter.
 * Drafts use the editor instead.
 */
export function RecordViewer({
  encounter,
  isLoading,
  onEdit,
  onShare,
  onExportPdf,
  onAmend,
}: RecordViewerProps) {
  const ds = getDisplayStatus(encounter.status);
  const isDraft = ds === "draft" || ds === "in_review";

  if (isLoading) {
    return (
      <div style={{ padding: 32 }}>
        <Mono size={9}>CARREGANDO PRONTUÁRIO…</Mono>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px 26px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Mono size={9} spacing="1.2px" color={T.clinical.color}>
              {(
                TYPE_LABEL[encounter.type as RecordType] ?? encounter.type
              ).toUpperCase()}
            </Mono>
            <Badge variant={STATUS_VARIANT[ds]} dot={false}>
              {STATUS_LABEL[ds]}
            </Badge>
          </div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: T.textPrimary,
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            {encounter.chiefComplaint ?? "— Sem queixa principal —"}
          </h2>
          <Mono size={9}>
            CRIADO {fmtDateTime(encounter.createdAt).toUpperCase()}
            {encounter.signedAt &&
              ` · ASSINADO ${fmtDateTime(encounter.signedAt).toUpperCase()}`}
          </Mono>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {isDraft && onEdit && (
            <Btn small icon="edit" onClick={onEdit}>
              Editar rascunho
            </Btn>
          )}
          {!isDraft && onAmend && (
            <Btn variant="glass" small icon="edit" onClick={onAmend}>
              Adicionar adendo
            </Btn>
          )}
          {!isDraft && onShare && (
            <Btn variant="glass" small icon="link" onClick={onShare}>
              Compartilhar
            </Btn>
          )}
          {onExportPdf && (
            <Btn variant="ghost" small icon="download" onClick={onExportPdf}>
              PDF
            </Btn>
          )}
        </div>
      </div>

      {/* CIDs */}
      {encounter.diagnoses.length > 0 && (
        <Glass style={{ padding: "14px 16px" }}>
          <Mono size={9} spacing="1px" color={T.primary}>
            DIAGNÓSTICOS · CID-10
          </Mono>
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}
          >
            {encounter.diagnoses.map((dx) => (
              <div
                key={`${dx.code}-${dx.description}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: T.r.pill,
                  background: dx.isPrimary ? T.primaryBg : T.glass,
                  border: `1px solid ${dx.isPrimary ? T.primaryBorder : T.glassBorder}`,
                }}
              >
                <Mono size={9} color={dx.isPrimary ? T.primary : T.textPrimary}>
                  {dx.code}
                </Mono>
                <span
                  style={{
                    fontSize: 11,
                    color: T.textPrimary,
                    fontFamily: "'IBM Plex Sans', sans-serif",
                  }}
                >
                  {dx.description}
                </span>
                {dx.isPrimary && <MetalTag>PRIMÁRIO</MetalTag>}
              </div>
            ))}
          </div>
        </Glass>
      )}

      {/* Vitals snapshot */}
      {encounter.vitalSigns && (
        <Glass style={{ padding: "14px 16px" }}>
          <Mono size={9} spacing="1px" color={T.primary}>
            SINAIS VITAIS
          </Mono>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 12,
              marginTop: 10,
            }}
          >
            <ViewerVital
              label="PA"
              value={
                encounter.vitalSigns.bloodPressureSys &&
                encounter.vitalSigns.bloodPressureDia
                  ? `${encounter.vitalSigns.bloodPressureSys}/${encounter.vitalSigns.bloodPressureDia}`
                  : "—"
              }
              unit="mmHg"
            />
            <ViewerVital
              label="FC"
              value={
                encounter.vitalSigns.heartRate
                  ? String(encounter.vitalSigns.heartRate)
                  : "—"
              }
              unit="bpm"
            />
            <ViewerVital
              label="SpO₂"
              value={
                encounter.vitalSigns.oxygenSaturation
                  ? String(encounter.vitalSigns.oxygenSaturation)
                  : "—"
              }
              unit="%"
            />
            <ViewerVital
              label="Temp"
              value={
                encounter.vitalSigns.temperatureC
                  ? encounter.vitalSigns.temperatureC.toFixed(1)
                  : "—"
              }
              unit="°C"
            />
            <ViewerVital
              label="IMC"
              value={
                encounter.vitalSigns.bmi
                  ? encounter.vitalSigns.bmi.toFixed(1)
                  : "—"
              }
              unit="kg/m²"
            />
          </div>
        </Glass>
      )}

      {/* SOAP sections */}
      <SOAPSection
        letter="S"
        label="SUBJETIVO"
        content={encounter.subjective}
      />
      <SOAPSection
        letter="O"
        label="OBJETIVO — EXAME FÍSICO"
        content={encounter.objective}
      />
      <SOAPSection
        letter="A"
        label="AVALIAÇÃO"
        content={encounter.assessment}
      />
      <SOAPSection letter="P" label="PLANO" content={encounter.plan} />

      {/* Internal notes (only visible to staff) */}
      {encounter.internalNotes && (
        <Glass style={{ padding: "14px 16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
            }}
          >
            <Ico name="lock" size={13} color={T.textMuted} />
            <Mono size={9} spacing="1px" color={T.textMuted}>
              NOTAS INTERNAS — NÃO IMPRESSAS
            </Mono>
          </div>
          <p
            style={{
              fontSize: 12,
              color: T.textSecondary,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              margin: 0,
            }}
          >
            {encounter.internalNotes}
          </p>
        </Glass>
      )}

      {/* Audit footer */}
      <Glass metal style={{ padding: "12px 16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div>
            <Mono size={9} spacing="1px" color={T.primary}>
              AUDITORIA & ASSINATURA
            </Mono>
            <p
              style={{
                fontSize: 11,
                color: T.textSecondary,
                margin: "4px 0 0",
              }}
            >
              Atualizado {fmtDateTime(encounter.updatedAt)}
              {encounter.signedAt &&
                ` · Assinado em ${fmtDateTime(encounter.signedAt)}`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <MetalTag>LGPD</MetalTag>
            <MetalTag>CFM 1821/2007</MetalTag>
            {!isDraft && <MetalTag>NGS-2</MetalTag>}
          </div>
        </div>
      </Glass>
    </div>
  );
}

function SOAPSection({
  letter,
  label,
  content,
}: {
  letter: string;
  label: string;
  content: string | null;
}) {
  const isEmpty = !content?.trim();
  return (
    <Glass style={{ padding: "14px 16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: T.r.sm,
            background: T.primaryBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: T.primary,
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          >
            {letter}
          </span>
        </div>
        <Mono size={9} spacing="1px" color={T.primary}>
          {label}
        </Mono>
      </div>
      {isEmpty ? (
        <p
          style={{
            fontSize: 11,
            color: T.textMuted,
            fontStyle: "italic",
            margin: 0,
          }}
        >
          Não preenchido.
        </p>
      ) : (
        <div
          style={{
            fontSize: 13,
            color: T.textPrimary,
            lineHeight: 1.6,
          }}
          dangerouslySetInnerHTML={{ __html: content ?? "" }}
        />
      )}
    </Glass>
  );
}

function ViewerVital({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <Mono size={7}>{label.toUpperCase()}</Mono>
      <p
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: T.textPrimary,
          margin: "4px 0 2px",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </p>
      <Mono size={7} color={T.textMuted}>
        {unit}
      </Mono>
    </div>
  );
}
