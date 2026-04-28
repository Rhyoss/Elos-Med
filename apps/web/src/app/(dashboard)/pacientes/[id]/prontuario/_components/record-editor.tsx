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
  TYPE_LABEL,
  getDisplayStatus,
  type EncounterFull,
  type RecordType,
} from "./types";

export interface EditorFormState {
  type: RecordType;
  chiefComplaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  internalNotes: string;
  diagnoses: Array<{ code: string; description: string; isPrimary: boolean }>;
  vitals: {
    bloodPressureSys?: number;
    bloodPressureDia?: number;
    heartRate?: number;
    oxygenSaturation?: number;
    temperatureC?: number;
    weightKg?: number;
    heightCm?: number;
  };
}

export const TYPE_OPTIONS: Array<{
  id: RecordType;
  label: string;
  icon: IcoName;
}> = [
  { id: "clinical", label: "Consulta clínica", icon: "calendar" },
  { id: "aesthetic", label: "Procedimento", icon: "zap" },
  { id: "followup", label: "Retorno", icon: "clock" },
  { id: "emergency", label: "Emergência", icon: "alert" },
  { id: "telemedicine", label: "Teleconsulta", icon: "globe" },
];

export type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string };

export interface RecordEditorProps {
  encounter: EncounterFull;
  form: EditorFormState;
  onChange: (next: EditorFormState) => void;
  saveStatus: SaveStatus;
  onSaveDraft: () => void;
  onFinalize: () => void;
  onCancel?: () => void;
  onSuggestSoap?: () => void;
  onPlanAction?: (target: string) => void;
  isSuggesting?: boolean;
  isSaving?: boolean;
  isSubmitting?: boolean;
  /** Disable all editing (e.g. for finalized records that arrived here by mistake). */
  readOnly?: boolean;
}

export function RecordEditor({
  encounter,
  form,
  onChange,
  saveStatus,
  onSaveDraft,
  onFinalize,
  onCancel,
  onSuggestSoap,
  onPlanAction,
  isSuggesting,
  isSaving,
  isSubmitting,
  readOnly,
}: RecordEditorProps) {
  const ds = getDisplayStatus(encounter.status);

  function patch<K extends keyof EditorFormState>(
    key: K,
    value: EditorFormState[K],
  ) {
    onChange({ ...form, [key]: value });
  }
  function patchVital(k: keyof EditorFormState["vitals"], raw: string) {
    const num = raw === "" ? undefined : Number(raw);
    onChange({
      ...form,
      vitals: { ...form.vitals, [k]: Number.isFinite(num) ? num : undefined },
    });
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
          alignItems: "flex-start",
          justifyContent: "space-between",
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
              EDIÇÃO DE PRONTUÁRIO
            </Mono>
            <Badge variant={STATUS_VARIANT[ds]} dot={false}>
              {STATUS_LABEL[ds]}
            </Badge>
          </div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: T.textPrimary,
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            {form.chiefComplaint || "— Defina a queixa principal —"}
          </h2>
          <SaveStatusIndicator status={saveStatus} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {onCancel && (
            <Btn
              variant="ghost"
              small
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancelar
            </Btn>
          )}
          <Btn
            variant="glass"
            small
            icon="download"
            onClick={onSaveDraft}
            loading={isSaving}
            disabled={readOnly || isSubmitting}
          >
            Salvar rascunho
          </Btn>
          <Btn
            small
            icon="check"
            onClick={onFinalize}
            disabled={readOnly || isSubmitting || !canFinalize(form)}
            loading={isSubmitting}
          >
            Finalizar
          </Btn>
        </div>
      </div>

      {/* Tipo de registro */}
      <Glass style={{ padding: "14px 16px" }}>
        <Mono size={9} spacing="1px" color={T.primary}>
          TIPO DO REGISTRO
        </Mono>
        <div
          style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}
        >
          {TYPE_OPTIONS.map((opt) => {
            const active = form.type === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => patch("type", opt.id)}
                disabled={readOnly}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: T.r.pill,
                  border: `1px solid ${active ? T.primary : T.glassBorder}`,
                  background: active ? T.primaryBg : T.glass,
                  color: active ? T.primary : T.textSecondary,
                  fontSize: 11,
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontWeight: active ? 600 : 500,
                  cursor: readOnly ? "not-allowed" : "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                <Ico
                  name={opt.icon}
                  size={12}
                  color={active ? T.primary : T.textMuted}
                />
                {opt.label}
              </button>
            );
          })}
        </div>
      </Glass>

      {/* Queixa principal */}
      <SoapBox letter="C" label="QUEIXA PRINCIPAL">
        <input
          value={form.chiefComplaint}
          onChange={(e) => patch("chiefComplaint", e.target.value)}
          placeholder="Ex: Lesão na face em crescimento há 3 semanas"
          disabled={readOnly}
          maxLength={2000}
          style={inputStyle}
        />
      </SoapBox>

      {/* Diagnoses */}
      <Glass style={{ padding: "14px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <Mono size={9} spacing="1px" color={T.primary}>
            DIAGNÓSTICOS · CID-10
          </Mono>
          <DiagnosisAddButton
            onAdd={(d) =>
              patch("diagnoses", [
                ...form.diagnoses,
                { ...d, isPrimary: form.diagnoses.length === 0 },
              ])
            }
            disabled={readOnly}
          />
        </div>
        {form.diagnoses.length === 0 ? (
          <p
            style={{
              fontSize: 11,
              color: T.textMuted,
              margin: 0,
              fontStyle: "italic",
            }}
          >
            Nenhum CID adicionado. Use o campo acima para buscar.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {form.diagnoses.map((dx, i) => (
              <div
                key={`${dx.code}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: T.r.md,
                  background: dx.isPrimary ? T.primaryBg : T.glass,
                  border: `1px solid ${dx.isPrimary ? T.primaryBorder : T.glassBorder}`,
                }}
              >
                <Mono size={9} color={dx.isPrimary ? T.primary : T.textPrimary}>
                  {dx.code}
                </Mono>
                <span style={{ fontSize: 12, color: T.textPrimary, flex: 1 }}>
                  {dx.description}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = form.diagnoses.map((d, j) => ({
                      ...d,
                      isPrimary: j === i,
                    }));
                    patch("diagnoses", next);
                  }}
                  disabled={readOnly || dx.isPrimary}
                  style={{
                    padding: "2px 8px",
                    borderRadius: T.r.sm,
                    background: dx.isPrimary ? T.primary : "transparent",
                    border: `1px solid ${dx.isPrimary ? T.primary : T.divider}`,
                    color: dx.isPrimary ? "#fff" : T.textMuted,
                    fontSize: 9,
                    cursor: dx.isPrimary || readOnly ? "default" : "pointer",
                    fontFamily: "'IBM Plex Mono', monospace",
                    letterSpacing: "0.04em",
                  }}
                >
                  PRIMÁRIO
                </button>
                <button
                  type="button"
                  onClick={() =>
                    patch(
                      "diagnoses",
                      form.diagnoses.filter((_, j) => j !== i),
                    )
                  }
                  disabled={readOnly}
                  aria-label="Remover diagnóstico"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 2,
                  }}
                >
                  <Ico name="x" size={13} color={T.danger} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Glass>

      {/* SOAP */}
      <SoapBox
        letter="S"
        label="SUBJETIVO"
        action={
          onSuggestSoap && (
            <Btn
              variant="ghost"
              small
              icon="zap"
              onClick={onSuggestSoap}
              loading={isSuggesting}
              disabled={readOnly || !form.chiefComplaint.trim() || isSuggesting}
            >
              IA: Sugerir
            </Btn>
          )
        }
      >
        <textarea
          value={form.subjective}
          onChange={(e) => patch("subjective", e.target.value)}
          placeholder="História clínica, queixas, evolução, fatores de piora/melhora…"
          disabled={readOnly}
          style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
        />
      </SoapBox>

      <SoapBox letter="O" label="OBJETIVO — EXAME FÍSICO">
        <textarea
          value={form.objective}
          onChange={(e) => patch("objective", e.target.value)}
          placeholder="Inspeção, palpação, achados dermatológicos…"
          disabled={readOnly}
          style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
        />
        <div style={{ marginTop: 12 }}>
          <Mono size={8} color={T.primary}>
            SINAIS VITAIS
          </Mono>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 8,
              marginTop: 6,
            }}
          >
            <VitalInput
              label="PA SIS"
              unit="mmHg"
              value={form.vitals.bloodPressureSys}
              onChange={(v) => patchVital("bloodPressureSys", v)}
              disabled={readOnly}
            />
            <VitalInput
              label="PA DIA"
              unit="mmHg"
              value={form.vitals.bloodPressureDia}
              onChange={(v) => patchVital("bloodPressureDia", v)}
              disabled={readOnly}
            />
            <VitalInput
              label="FC"
              unit="bpm"
              value={form.vitals.heartRate}
              onChange={(v) => patchVital("heartRate", v)}
              disabled={readOnly}
            />
            <VitalInput
              label="SpO₂"
              unit="%"
              value={form.vitals.oxygenSaturation}
              onChange={(v) => patchVital("oxygenSaturation", v)}
              disabled={readOnly}
            />
            <VitalInput
              label="Temp"
              unit="°C"
              value={form.vitals.temperatureC}
              onChange={(v) => patchVital("temperatureC", v)}
              disabled={readOnly}
              step="0.1"
            />
          </div>
        </div>
      </SoapBox>

      <SoapBox letter="A" label="AVALIAÇÃO">
        <textarea
          value={form.assessment}
          onChange={(e) => patch("assessment", e.target.value)}
          placeholder="Hipóteses diagnósticas, raciocínio clínico…"
          disabled={readOnly}
          style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
        />
      </SoapBox>

      <SoapBox letter="P" label="PLANO — CONDUTA">
        <textarea
          value={form.plan}
          onChange={(e) => patch("plan", e.target.value)}
          placeholder="Tratamento, prescrição, exames, encaminhamentos, retorno sugerido…"
          disabled={readOnly}
          style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
        />
      </SoapBox>

      <ClinicalPlanActions onAction={onPlanAction} disabled={readOnly} />

      <Glass style={{ padding: "14px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div>
            <Mono size={9} spacing="1px" color={T.aiMod.color}>
              IA ASSISTIVA · REVISÁVEL
            </Mono>
            <p
              style={{
                fontSize: 11,
                color: T.textMuted,
                lineHeight: 1.5,
                margin: "5px 0 0",
              }}
            >
              Sugestões não finalizam o registro. O médico deve revisar, aceitar
              ou descartar cada conteúdo.
            </p>
          </div>
          {onSuggestSoap && (
            <Btn
              variant="glass"
              small
              icon="zap"
              onClick={onSuggestSoap}
              loading={isSuggesting}
              disabled={readOnly || !form.chiefComplaint.trim() || isSuggesting}
            >
              Organizar SOAP
            </Btn>
          )}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginTop: 12,
          }}
        >
          <AssistiveStub icon="file" label="Resumo histórico" />
          <AssistiveStub icon="hash" label="Sugerir CID" />
          <AssistiveStub icon="layers" label="Sugerir protocolo" />
          <AssistiveStub icon="alert" label="Pendências antes de finalizar" />
          <AssistiveStub icon="message" label="Orientação ao paciente" />
          <AssistiveStub icon="shield" label="Checar alergias/interações" />
        </div>
      </Glass>

      <Glass style={{ padding: "14px 16px" }}>
        <Mono size={9} spacing="1px" color={T.primary}>
          PRÉVIA DE DOCUMENTOS GERADOS
        </Mono>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8,
            marginTop: 10,
          }}
        >
          <DocumentPreview icon="file" label="Resumo pós-consulta" />
          <DocumentPreview icon="activity" label="Pedido de exame" />
          <DocumentPreview icon="shield" label="Atestado" />
          <DocumentPreview icon="download" label="PDF assinado" />
        </div>
      </Glass>

      {/* Internal notes */}
      <details
        style={{
          borderRadius: T.r.lg,
          background: T.glass,
          border: `1px solid ${T.glassBorder}`,
          overflow: "hidden",
        }}
      >
        <summary
          style={{
            cursor: "pointer",
            userSelect: "none",
            padding: "10px 14px",
            fontSize: 11,
            fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 500,
            letterSpacing: "1.1px",
            color: T.textMuted,
          }}
        >
          NOTAS INTERNAS — NÃO IMPRESSAS
        </summary>
        <div style={{ borderTop: `1px solid ${T.divider}`, padding: 12 }}>
          <textarea
            value={form.internalNotes}
            onChange={(e) => patch("internalNotes", e.target.value)}
            placeholder="Observações privadas do profissional…"
            disabled={readOnly}
            style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
          />
        </div>
      </details>

      {/* Compliance footer */}
      <Glass metal style={{ padding: "10px 14px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <Mono size={8} spacing="1px">
            RASCUNHO COM AUTOSAVE
          </Mono>
          <div style={{ display: "flex", gap: 4 }}>
            <MetalTag>LGPD</MetalTag>
            <MetalTag>PHI-SAFE</MetalTag>
            <MetalTag>AUDITORIA</MetalTag>
          </div>
        </div>
      </Glass>
    </div>
  );
}

function ClinicalPlanActions({
  onAction,
  disabled,
}: {
  onAction?: (target: string) => void;
  disabled?: boolean;
}) {
  const actions: Array<{
    id: string;
    label: string;
    icon: IcoName;
    color: string;
  }> = [
    { id: "prescription", label: "Prescrição", icon: "file", color: T.primary },
    { id: "exam", label: "Exame", icon: "activity", color: T.info },
    { id: "image", label: "Imagem", icon: "image", color: T.supply.color },
    {
      id: "protocol",
      label: "Protocolo",
      icon: "layers",
      color: T.aiMod.color,
    },
    {
      id: "appointment",
      label: "Retorno",
      icon: "calendar",
      color: T.clinical.color,
    },
    {
      id: "finance",
      label: "Financeiro",
      icon: "creditCard",
      color: T.financial.color,
    },
    {
      id: "communication",
      label: "Comunicação",
      icon: "message",
      color: T.aiMod.color,
    },
    { id: "supplies", label: "Insumos", icon: "box", color: T.supply.color },
  ];

  return (
    <Glass style={{ padding: "14px 16px" }}>
      <Mono size={9} spacing="1px" color={T.primary}>
        AÇÕES DA CONDUTA
      </Mono>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
          marginTop: 10,
        }}
      >
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction?.(action.id)}
            disabled={disabled}
            style={{
              minHeight: 58,
              padding: "9px 10px",
              borderRadius: T.r.md,
              background: T.inputBg,
              border: `1px solid ${T.inputBorder}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "space-between",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.55 : 1,
            }}
          >
            <Ico name={action.icon} size={15} color={action.color} />
            <span
              style={{ fontSize: 11, color: T.textPrimary, fontWeight: 600 }}
            >
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </Glass>
  );
}

function AssistiveStub({ icon, label }: { icon: IcoName; label: string }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: T.r.md,
        background: T.aiBg,
        border: `1px solid ${T.aiBorder}`,
        display: "flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
      }}
    >
      <Ico name={icon} size={13} color={T.ai} />
      <span
        style={{
          fontSize: 11,
          color: T.textPrimary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function DocumentPreview({ icon, label }: { icon: IcoName; label: string }) {
  return (
    <div
      style={{
        padding: "9px 10px",
        borderRadius: T.r.md,
        background: T.glass,
        border: `1px dashed ${T.glassBorder}`,
        display: "flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
      }}
    >
      <Ico name={icon} size={13} color={T.primary} />
      <span
        style={{
          fontSize: 11,
          color: T.textSecondary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: T.r.md,
  background: T.inputBg,
  border: `1px solid ${T.inputBorder}`,
  color: T.textPrimary,
  fontSize: 13,
  fontFamily: "'IBM Plex Sans', sans-serif",
  outline: "none",
  transition: "border 0.15s",
  lineHeight: 1.55,
};

function SoapBox({
  letter,
  label,
  action,
  children,
}: {
  letter: string;
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Glass style={{ padding: "14px 16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
        {action}
      </div>
      {children}
    </Glass>
  );
}

function VitalInput({
  label,
  unit,
  value,
  onChange,
  disabled,
  step,
}: {
  label: string;
  unit: string;
  value: number | undefined;
  onChange: (v: string) => void;
  disabled?: boolean;
  step?: string;
}) {
  return (
    <div>
      <Mono size={7}>
        {label.toUpperCase()} ({unit})
      </Mono>
      <input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: "100%",
          marginTop: 3,
          padding: "6px 10px",
          borderRadius: T.r.sm,
          background: T.inputBg,
          border: `1px solid ${T.inputBorder}`,
          color: T.textPrimary,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "'IBM Plex Mono', monospace",
          outline: "none",
          textAlign: "center",
        }}
      />
    </div>
  );
}

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status.kind === "idle") return null;
  if (status.kind === "saving") {
    return (
      <div
        style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: T.warning,
            animation: "ds-shimmer 1.4s ease-in-out infinite",
          }}
        />
        <Mono size={8} color={T.warning}>
          SALVANDO RASCUNHO…
        </Mono>
      </div>
    );
  }
  if (status.kind === "saved") {
    return (
      <div
        style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}
      >
        <Ico name="check" size={11} color={T.success} />
        <Mono size={8} color={T.success}>
          RASCUNHO SALVO{" "}
          {new Intl.DateTimeFormat("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }).format(status.at)}
        </Mono>
      </div>
    );
  }
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}
    >
      <Ico name="alert" size={11} color={T.danger} />
      <Mono size={8} color={T.danger}>
        FALHA: {status.message}
      </Mono>
    </div>
  );
}

function DiagnosisAddButton({
  onAdd,
  disabled,
}: {
  onAdd: (d: { code: string; description: string }) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [desc, setDesc] = React.useState("");

  if (!open) {
    return (
      <Btn
        variant="ghost"
        small
        icon="plus"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        Adicionar CID
      </Btn>
    );
  }

  function commit() {
    if (!code.trim() || !desc.trim()) {
      setOpen(false);
      return;
    }
    onAdd({ code: code.trim().toUpperCase(), description: desc.trim() });
    setCode("");
    setDesc("");
    setOpen(false);
  }

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="L20.0"
        style={{
          width: 70,
          padding: "4px 8px",
          borderRadius: T.r.sm,
          background: T.inputBg,
          border: `1px solid ${T.inputBorder}`,
          fontSize: 11,
          fontFamily: "'IBM Plex Mono', monospace",
          outline: "none",
        }}
      />
      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Descrição"
        style={{
          width: 180,
          padding: "4px 8px",
          borderRadius: T.r.sm,
          background: T.inputBg,
          border: `1px solid ${T.inputBorder}`,
          fontSize: 11,
          outline: "none",
        }}
      />
      <Btn small icon="check" iconOnly onClick={commit} aria-label="Adicionar">
        Add
      </Btn>
      <Btn
        variant="ghost"
        small
        icon="x"
        iconOnly
        onClick={() => setOpen(false)}
        aria-label="Cancelar"
      >
        Cancelar
      </Btn>
    </div>
  );
}

function canFinalize(form: EditorFormState): boolean {
  // mínimo: queixa principal + ao menos uma seção SOAP
  if (!form.chiefComplaint.trim()) return false;
  return Boolean(
    form.subjective.trim() ||
    form.objective.trim() ||
    form.assessment.trim() ||
    form.plan.trim(),
  );
}
