"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Bar,
  Btn,
  Glass,
  Ico,
  MetalTag,
  Mono,
  T,
  type IcoName,
} from "@dermaos/ui/ds";

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function fmtBRL(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

interface VitalSigns {
  bloodPressureSys: number | null;
  bloodPressureDia: number | null;
  heartRate: number | null;
  oxygenSaturation: number | null;
  temperatureC: number | null;
  bmi: number | null;
}

export interface RecordContextPanelProps {
  patientId: string;
  encounter?: {
    id: string;
    status: string;
    appointmentId: string | null;
  } | null;
  patient: {
    allergies: string[];
    chronicConditions: string[];
    activeMedications: string[];
  };
  vitals?: VitalSigns | null;
  vitalsRecordedAt?: Date | string | null;
  recentPrescriptions: Array<{
    id: string;
    prescriptionNumber: string | null;
    status: string;
    createdAt: Date | string;
    items: ReadonlyArray<unknown>;
  }>;
  recentLesions: Array<{
    id: string;
    bodyRegion: string;
    imageCount: number;
    createdAt: Date | string;
  }>;
  activeProtocol?: {
    id: string;
    name: string;
    sessionsDone: number;
    totalSessions: number;
    expectedEndDate: Date | string | null;
  } | null;
  financialSummary?: {
    balance: number;
    pendingCount: number;
  } | null;
}

export function RecordContextPanel({
  patientId,
  encounter,
  patient,
  vitals,
  vitalsRecordedAt,
  recentPrescriptions,
  recentLesions,
  activeProtocol,
  financialSummary,
}: RecordContextPanelProps) {
  const router = useRouter();
  const hasVitals =
    vitals &&
    (vitals.bloodPressureSys ||
      vitals.heartRate ||
      vitals.oxygenSaturation ||
      vitals.temperatureC ||
      vitals.bmi);

  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        borderLeft: `1px solid ${T.divider}`,
        overflowY: "auto",
        height: "100%",
        padding: "14px 14px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Sinais vitais */}
      <CardHeader
        icon="activity"
        label="SINAIS VITAIS"
        color={T.clinical.color}
      >
        {vitalsRecordedAt && (
          <Mono size={7}>{fmtDate(vitalsRecordedAt).toUpperCase()}</Mono>
        )}
      </CardHeader>
      {hasVitals ? (
        <Glass style={{ padding: "10px 12px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 8,
            }}
          >
            {vitals?.bloodPressureSys && vitals?.bloodPressureDia && (
              <Vital
                label="Pressão"
                value={`${vitals.bloodPressureSys}/${vitals.bloodPressureDia}`}
                unit="mmHg"
              />
            )}
            {vitals?.heartRate && (
              <Vital label="FC" value={String(vitals.heartRate)} unit="bpm" />
            )}
            {vitals?.oxygenSaturation && (
              <Vital
                label="SpO₂"
                value={String(vitals.oxygenSaturation)}
                unit="%"
              />
            )}
            {vitals?.temperatureC && (
              <Vital
                label="Temp"
                value={vitals.temperatureC.toFixed(1)}
                unit="°C"
              />
            )}
            {vitals?.bmi && (
              <Vital label="IMC" value={vitals.bmi.toFixed(1)} unit="kg/m²" />
            )}
          </div>
        </Glass>
      ) : (
        <EmptyMini icon="activity" text="Sem aferições registradas" />
      )}

      {/* Encounter vinculado */}
      <CardHeader
        icon="calendar"
        label="ATENDIMENTO ATUAL"
        color={T.clinical.color}
      />
      {encounter ? (
        <Glass style={{ padding: "10px 12px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 5,
            }}
          >
            <Mono size={8} color={T.clinical.color}>
              ENCOUNTER
            </Mono>
            <Mono size={8}>{encounter.id.slice(0, 8).toUpperCase()}</Mono>
          </div>
          <p
            style={{
              fontSize: 11,
              color: T.textSecondary,
              margin: 0,
              lineHeight: 1.45,
            }}
          >
            {encounter.appointmentId
              ? "Vinculado a agendamento/atendimento."
              : "Registro clínico sem agendamento associado."}
          </p>
        </Glass>
      ) : (
        <EmptyMini icon="calendar" text="Nenhum atendimento selecionado" />
      )}

      {/* Alergias */}
      <CardHeader icon="alert" label="ALERGIAS" color={T.danger} />
      {patient.allergies.length > 0 ? (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: T.r.md,
            background: T.dangerBg,
            border: `1px solid ${T.dangerBorder}`,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {patient.allergies.map((a) => (
              <Badge key={a} variant="danger" dot={false}>
                {a}
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <EmptyMini icon="check" text="Nenhuma alergia registrada" />
      )}

      {/* Medicações ativas */}
      <CardHeader icon="file" label="MEDICAÇÕES ATIVAS" color={T.info} />
      {patient.activeMedications.length > 0 ? (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: T.r.md,
            background: T.glass,
            border: `1px solid ${T.glassBorder}`,
          }}
        >
          {patient.activeMedications.map((med) => (
            <div
              key={med}
              style={{
                fontSize: 11,
                color: T.textSecondary,
                padding: "2px 0",
                lineHeight: 1.4,
              }}
            >
              • {med}
            </div>
          ))}
        </div>
      ) : (
        <EmptyMini icon="file" text="Sem medicações registradas" />
      )}

      {/* Condições crônicas */}
      {patient.chronicConditions.length > 0 && (
        <>
          <CardHeader
            icon="shield"
            label="CONDIÇÕES CRÔNICAS"
            color={T.warning}
          />
          <div
            style={{
              padding: "8px 10px",
              borderRadius: T.r.md,
              background: T.warningBg,
              border: `1px solid ${T.warningBorder}`,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {patient.chronicConditions.map((c) => (
                <Badge key={c} variant="warning" dot={false}>
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Últimas prescrições */}
      <CardHeader icon="file" label="ÚLTIMAS PRESCRIÇÕES" color={T.primary}>
        <button
          type="button"
          onClick={() => router.push(`/pacientes/${patientId}/prescricoes`)}
          style={{
            background: "transparent",
            border: "none",
            color: T.primary,
            fontSize: 9,
            fontFamily: "'IBM Plex Mono', monospace",
            cursor: "pointer",
            padding: 0,
          }}
        >
          VER TODAS
        </button>
      </CardHeader>
      {recentPrescriptions.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {recentPrescriptions.slice(0, 3).map((rx) => {
            const items = rx.items as Array<{ name?: string }>;
            return (
              <div
                key={rx.id}
                style={{
                  padding: "8px 10px",
                  borderRadius: T.r.md,
                  background: T.glass,
                  border: `1px solid ${T.glassBorder}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 3,
                  }}
                >
                  <Mono size={8} color={T.primary}>
                    {rx.prescriptionNumber ??
                      `RX-${rx.id.slice(0, 6).toUpperCase()}`}
                  </Mono>
                  <Mono size={8}>{fmtDate(rx.createdAt)}</Mono>
                </div>
                <p
                  style={{
                    fontSize: 11,
                    color: T.textPrimary,
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {items
                    .map((i) => i.name)
                    .filter(Boolean)
                    .slice(0, 2)
                    .join(", ") || `${items.length} item(ns)`}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyMini icon="file" text="Sem prescrições registradas" />
      )}

      <CardHeader icon="activity" label="ORDENS PENDENTES" color={T.warning} />
      <OperationalStub
        icon="activity"
        title="Exames e procedimentos"
        text="Pedidos gerados pelo plano aparecerão aqui."
      />

      {/* Últimas imagens/lesões */}
      <CardHeader icon="image" label="IMAGENS RECENTES" color={T.supply.color}>
        <button
          type="button"
          onClick={() => router.push(`/pacientes/${patientId}/imagens`)}
          style={{
            background: "transparent",
            border: "none",
            color: T.supply.color,
            fontSize: 9,
            fontFamily: "'IBM Plex Mono', monospace",
            cursor: "pointer",
            padding: 0,
          }}
        >
          VER TODAS
        </button>
      </CardHeader>
      {recentLesions.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {recentLesions.slice(0, 3).map((l) => (
            <div
              key={l.id}
              style={{
                padding: "8px 10px",
                borderRadius: T.r.md,
                background: T.glass,
                border: `1px solid ${T.glassBorder}`,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: T.r.sm,
                  background: T.supply.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Ico name="image" size={13} color={T.supply.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: T.textPrimary,
                    margin: 0,
                  }}
                >
                  {l.bodyRegion}
                </p>
                <Mono size={8}>
                  {l.imageCount} {l.imageCount === 1 ? "imagem" : "imagens"} ·{" "}
                  {fmtDate(l.createdAt)}
                </Mono>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyMini icon="image" text="Sem imagens registradas" />
      )}

      {/* Protocolo ativo */}
      {activeProtocol && (
        <>
          <CardHeader
            icon="layers"
            label="PROTOCOLO ATIVO"
            color={T.aiMod.color}
          />
          <Glass style={{ padding: "10px 12px" }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: T.textPrimary,
                margin: "0 0 4px",
              }}
            >
              {activeProtocol.name}
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <Mono size={8}>
                SESSÕES {activeProtocol.sessionsDone}/
                {activeProtocol.totalSessions}
              </Mono>
              <Mono size={8} color={T.aiMod.color}>
                {activeProtocol.totalSessions > 0
                  ? Math.round(
                      (activeProtocol.sessionsDone /
                        activeProtocol.totalSessions) *
                        100,
                    )
                  : 0}
                %
              </Mono>
            </div>
            <Bar
              pct={
                activeProtocol.totalSessions > 0
                  ? (activeProtocol.sessionsDone /
                      activeProtocol.totalSessions) *
                    100
                  : 0
              }
              color={T.aiMod.color}
              height={4}
            />
            {activeProtocol.expectedEndDate && (
              <Mono size={7} color={T.textMuted}>
                PREVISÃO {fmtDate(activeProtocol.expectedEndDate).toUpperCase()}
              </Mono>
            )}
          </Glass>
        </>
      )}

      <CardHeader
        icon="box"
        label="INSUMOS E PROCEDIMENTOS"
        color={T.supply.color}
      />
      <OperationalStub
        icon="box"
        title="Sem consumo vinculado"
        text="Reservas, baixa de materiais e custos serão ligados ao registro."
      />

      {/* Pendência financeira */}
      {financialSummary && financialSummary.balance > 0 && (
        <>
          <CardHeader
            icon="creditCard"
            label="FINANCEIRO"
            color={T.financial.color}
          />
          <button
            type="button"
            onClick={() => router.push(`/pacientes/${patientId}/financeiro`)}
            style={{
              padding: "10px 12px",
              borderRadius: T.r.md,
              background: T.dangerBg,
              border: `1px solid ${T.dangerBorder}`,
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Ico name="alert" size={15} color={T.danger} />
            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: T.danger,
                  margin: 0,
                }}
              >
                {fmtBRL(financialSummary.balance)} em aberto
              </p>
              <Mono size={8}>
                {financialSummary.pendingCount} fatura
                {financialSummary.pendingCount > 1 ? "s" : ""} pendente
                {financialSummary.pendingCount > 1 ? "s" : ""}
              </Mono>
            </div>
          </button>
        </>
      )}

      <CardHeader
        icon="message"
        label="COMUNICAÇÕES RECENTES"
        color={T.aiMod.color}
      />
      <OperationalStub
        icon="message"
        title="Continuidade do cuidado"
        text="Orientações, follow-ups e envios ao paciente serão auditados aqui."
      />

      {/* Compliance footer */}
      <div style={{ marginTop: "auto", paddingTop: 8 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          <MetalTag>LGPD</MetalTag>
          <MetalTag>AES-256</MetalTag>
          <MetalTag>RLS</MetalTag>
        </div>
      </div>
    </aside>
  );
}

function CardHeader({
  icon,
  label,
  color,
  children,
}: {
  icon: IcoName;
  label: string;
  color: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Ico name={icon} size={13} color={color} />
        <Mono size={9} spacing="1.1px" color={color}>
          {label}
        </Mono>
      </div>
      {children}
    </div>
  );
}

function Vital({
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
          fontSize: 16,
          fontWeight: 700,
          color: T.textPrimary,
          margin: "3px 0 0",
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

function EmptyMini({ icon, text }: { icon: IcoName; text: string }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: T.r.md,
        background: T.glass,
        border: `1px dashed ${T.glassBorder}`,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Ico name={icon} size={13} color={T.textMuted} />
      <span style={{ fontSize: 11, color: T.textMuted }}>{text}</span>
    </div>
  );
}

function OperationalStub({
  icon,
  title,
  text,
}: {
  icon: IcoName;
  title: string;
  text: string;
}) {
  return (
    <div
      style={{
        padding: "9px 10px",
        borderRadius: T.r.md,
        background: T.glass,
        border: `1px dashed ${T.glassBorder}`,
        display: "flex",
        gap: 8,
      }}
    >
      <Ico name={icon} size={13} color={T.textMuted} />
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: T.textPrimary,
            margin: 0,
          }}
        >
          {title}
        </p>
        <p
          style={{
            fontSize: 10,
            color: T.textMuted,
            lineHeight: 1.4,
            margin: "2px 0 0",
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
