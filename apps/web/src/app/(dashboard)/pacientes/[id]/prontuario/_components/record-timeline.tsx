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
  type EncounterListItem,
  type RecordType,
} from "./types";

type StatusFilter = "all" | "drafts" | "finalized" | "signed" | "amended";
type PeriodFilter = "all" | "7d" | "30d" | "90d";

function fmtDateTime(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function recordIcon(type: string): IcoName {
  if (type === "aesthetic") return "zap";
  if (type === "followup") return "clock";
  if (type === "emergency") return "alert";
  if (type === "telemedicine") return "globe";
  return "calendar";
}

export interface RecordTimelineProps {
  encounters: ReadonlyArray<EncounterListItem>;
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  disabled?: boolean;
}

export function RecordTimeline({
  encounters,
  selectedId,
  onSelect,
  onCreateNew,
  disabled,
}: RecordTimelineProps) {
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<"all" | RecordType>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [periodFilter, setPeriodFilter] = React.useState<PeriodFilter>("all");
  const [onlyWithPrescription, setOnlyWithPrescription] = React.useState(false);
  const [onlyWithAttachments, setOnlyWithAttachments] = React.useState(false);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = Date.now();
    const periodMs =
      periodFilter === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : periodFilter === "30d"
          ? 30 * 24 * 60 * 60 * 1000
          : periodFilter === "90d"
            ? 90 * 24 * 60 * 60 * 1000
            : null;

    return encounters.filter((enc) => {
      const ds = getDisplayStatus(enc.status);
      if (typeFilter !== "all" && enc.type !== typeFilter) return false;
      if (statusFilter === "drafts" && ds !== "draft") return false;
      if (statusFilter === "finalized" && ds !== "finalized" && ds !== "signed")
        return false;
      if (statusFilter === "signed" && ds !== "signed") return false;
      if (statusFilter === "amended" && ds !== "amended") return false;
      if (periodMs && now - new Date(enc.createdAt).getTime() > periodMs)
        return false;

      const hasPrescription =
        enc.diagnoses.length > 0 || enc.status === "assinado";
      const hasAttachments =
        enc.status === "corrigido" || enc.type === "aesthetic";
      if (onlyWithPrescription && !hasPrescription) return false;
      if (onlyWithAttachments && !hasAttachments) return false;

      if (!term) return true;
      const hay = [
        enc.chiefComplaint,
        TYPE_LABEL[enc.type as RecordType] ?? enc.type,
        STATUS_LABEL[ds],
        ...enc.diagnoses.map((d) => `${d.code} ${d.description}`),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [
    encounters,
    onlyWithAttachments,
    onlyWithPrescription,
    periodFilter,
    search,
    statusFilter,
    typeFilter,
  ]);

  return (
    <aside
      style={{
        width: 320,
        flexShrink: 0,
        borderRight: `1px solid ${T.divider}`,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
        background: "rgba(255,255,255,0.22)",
      }}
    >
      <div
        style={{
          padding: 14,
          borderBottom: `1px solid ${T.divider}`,
          flexShrink: 0,
        }}
      >
        <Btn
          small
          icon="plus"
          onClick={onCreateNew}
          disabled={disabled}
          style={{ width: "100%" }}
        >
          Novo registro
        </Btn>

        <div style={{ position: "relative", marginTop: 10 }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          >
            <Ico name="search" size={13} color={T.textMuted} />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar queixa, CID, médico, texto..."
            disabled={disabled}
            style={{
              width: "100%",
              padding: "8px 10px 8px 30px",
              borderRadius: T.r.md,
              background: T.inputBg,
              border: `1px solid ${T.inputBorder}`,
              color: T.textPrimary,
              fontSize: 12,
              outline: "none",
            }}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
            marginTop: 8,
          }}
        >
          <FilterSelect
            label="Tipo"
            value={typeFilter}
            onChange={(value) => setTypeFilter(value as "all" | RecordType)}
            disabled={disabled}
            options={[
              ["all", "Todos"],
              ["clinical", "Consulta"],
              ["aesthetic", "Procedimento"],
              ["followup", "Retorno"],
              ["emergency", "Urgência"],
              ["telemedicine", "Teleconsulta"],
            ]}
          />
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
            disabled={disabled}
            options={[
              ["all", "Todos"],
              ["drafts", "Rascunhos"],
              ["finalized", "Finalizados"],
              ["signed", "Assinados"],
              ["amended", "Adendos"],
            ]}
          />
          <FilterSelect
            label="Período"
            value={periodFilter}
            onChange={(value) => setPeriodFilter(value as PeriodFilter)}
            disabled={disabled}
            options={[
              ["all", "Todo período"],
              ["7d", "7 dias"],
              ["30d", "30 dias"],
              ["90d", "90 dias"],
            ]}
          />
          <FilterSelect
            label="Profissional"
            value="all"
            onChange={() => undefined}
            disabled
            options={[["all", "Todos"]]}
          />
        </div>

        <div
          style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}
        >
          <ToggleChip
            active={onlyWithAttachments}
            label="Anexos"
            onClick={() => setOnlyWithAttachments((v) => !v)}
            disabled={disabled}
          />
          <ToggleChip
            active={onlyWithPrescription}
            label="Prescrição"
            onClick={() => setOnlyWithPrescription((v) => !v)}
            disabled={disabled}
          />
          <MetalTag>ENCOUNTER</MetalTag>
        </div>
      </div>

      <div style={{ padding: 10, overflowY: "auto", minHeight: 0, flex: 1 }}>
        {filtered.length === 0 ? (
          <Glass style={{ padding: 16, textAlign: "center" }}>
            <Mono size={8}>NENHUM REGISTRO ENCONTRADO</Mono>
            <p style={{ fontSize: 11, color: T.textMuted, margin: "6px 0 0" }}>
              Ajuste filtros ou inicie um novo prontuário.
            </p>
          </Glass>
        ) : (
          filtered.map((enc) => {
            const ds = getDisplayStatus(enc.status);
            const selected = enc.id === selectedId;
            const dx = enc.diagnoses.slice(0, 2);
            const hasAttachments =
              enc.status === "corrigido" || enc.type === "aesthetic";
            const hasPrescription =
              enc.diagnoses.length > 0 || enc.status === "assinado";

            return (
              <button
                key={enc.id}
                type="button"
                onClick={() => onSelect(enc.id)}
                disabled={disabled}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  margin: "0 0 8px",
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                <Glass
                  active={selected}
                  hover={!disabled}
                  style={{ padding: "10px 11px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 9,
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: T.r.md,
                        background: T.clinical.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Ico
                        name={recordIcon(enc.type)}
                        size={14}
                        color={T.clinical.color}
                      />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <Mono size={8} color={T.clinical.color}>
                          {(
                            TYPE_LABEL[enc.type as RecordType] ?? enc.type
                          ).toUpperCase()}
                        </Mono>
                        <Mono size={8}>
                          {fmtDateTime(enc.createdAt).toUpperCase()}
                        </Mono>
                      </div>
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 650,
                          color: T.textPrimary,
                          margin: "5px 0 5px",
                          lineHeight: 1.35,
                        }}
                      >
                        {enc.chiefComplaint || "Sem queixa principal"}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          gap: 5,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <Badge variant={STATUS_VARIANT[ds]} dot={false}>
                          {STATUS_LABEL[ds]}
                        </Badge>
                        {dx.map((d) => (
                          <MetalTag key={`${enc.id}-${d.code}`}>
                            {d.code}
                          </MetalTag>
                        ))}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 7,
                          alignItems: "center",
                          marginTop: 7,
                        }}
                      >
                        <TimelineSignal
                          icon="user"
                          label="Médico responsável"
                          active
                        />
                        <TimelineSignal
                          icon="file"
                          label="Prescrição"
                          active={hasPrescription}
                        />
                        <TimelineSignal
                          icon="image"
                          label="Imagem/anexo"
                          active={hasAttachments}
                        />
                        <TimelineSignal
                          icon="layers"
                          label="Protocolo"
                          active={enc.type === "aesthetic"}
                        />
                      </div>
                    </div>
                  </div>
                </Glass>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Mono size={7}>{label.toUpperCase()}</Mono>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "6px 8px",
          borderRadius: T.r.sm,
          background: T.inputBg,
          border: `1px solid ${T.inputBorder}`,
          color: disabled ? T.textMuted : T.textPrimary,
          fontSize: 11,
          outline: "none",
        }}
      >
        {options.map(([id, optionLabel]) => (
          <option key={id} value={id}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleChip({
  active,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "4px 8px",
        borderRadius: T.r.pill,
        border: `1px solid ${active ? T.primaryBorder : T.glassBorder}`,
        background: active ? T.primaryBg : T.glass,
        color: active ? T.primary : T.textMuted,
        fontSize: 9,
        fontFamily: "'IBM Plex Mono', monospace",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

function TimelineSignal({
  icon,
  label,
  active,
}: {
  icon: IcoName;
  label: string;
  active: boolean;
}) {
  return (
    <span
      title={label}
      style={{ opacity: active ? 1 : 0.25, display: "inline-flex" }}
    >
      <Ico name={icon} size={12} color={active ? T.primary : T.textMuted} />
    </span>
  );
}
