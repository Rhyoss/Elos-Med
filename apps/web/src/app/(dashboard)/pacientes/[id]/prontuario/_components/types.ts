/**
 * Shared types for the Prontuário workspace.
 *
 * The DB statuses today are limited to: rascunho, revisao, assinado, corrigido.
 * Spec asks for a richer set (draft, in_review, finalized, signed, amended,
 * voided, shared). We map the current backend states onto the spec vocabulary
 * and surface a `displayStatus` that the UI uses everywhere. `voided` and
 * `shared` are surfaced as derived flags (e.g. `isShared`) until the backend
 * persists them as proper states.
 */

export type RecordType =
  | "clinical"
  | "aesthetic"
  | "followup"
  | "emergency"
  | "telemedicine";

export type DbEncounterStatus =
  | "rascunho"
  | "revisao"
  | "assinado"
  | "corrigido";

export type DisplayStatus =
  | "draft"
  | "in_review"
  | "finalized"
  | "signed"
  | "amended"
  | "voided"
  | "shared";

export const STATUS_FROM_DB: Record<DbEncounterStatus, DisplayStatus> = {
  rascunho: "draft",
  revisao: "in_review",
  assinado: "signed",
  corrigido: "amended",
};

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  finalized: "Finalizado",
  signed: "Assinado",
  amended: "Com adendo",
  voided: "Invalidado",
  shared: "Compartilhado",
};

export const STATUS_VARIANT: Record<
  DisplayStatus,
  "default" | "success" | "warning" | "danger" | "info" | "ai"
> = {
  draft: "warning",
  in_review: "info",
  finalized: "success",
  signed: "success",
  amended: "default",
  voided: "danger",
  shared: "ai",
};

export const TYPE_LABEL: Record<RecordType, string> = {
  clinical: "Consulta clínica",
  aesthetic: "Procedimento estético",
  followup: "Retorno",
  emergency: "Emergência",
  telemedicine: "Teleconsulta",
};

/** Encounter list item (subset returned by getByPatient). */
export interface EncounterListItem {
  id: string;
  type: string;
  status: string;
  chiefComplaint: string | null;
  diagnoses: Array<{ code: string; description: string; isPrimary?: boolean }>;
  signedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** Full encounter (returned by getById). */
export interface EncounterFull extends EncounterListItem {
  patientId: string;
  providerId: string;
  appointmentId: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  internalNotes: string | null;
  vitalSigns: {
    id: string;
    bloodPressureSys: number | null;
    bloodPressureDia: number | null;
    heartRate: number | null;
    temperatureC: number | null;
    oxygenSaturation: number | null;
    weightKg: number | null;
    heightCm: number | null;
    bmi: number | null;
    notes: string | null;
    recordedAt: Date | string;
  } | null;
  attachments: Array<{ url: string; type: string; label?: string }>;
}

export function isFinalized(s: string): boolean {
  return s === "assinado" || s === "corrigido";
}

export function getDisplayStatus(s: string): DisplayStatus {
  if (s in STATUS_FROM_DB) return STATUS_FROM_DB[s as DbEncounterStatus];
  return "draft";
}
