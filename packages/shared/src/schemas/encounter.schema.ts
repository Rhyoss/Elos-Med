import { z } from 'zod';

export const encounterTypeSchema = z.enum([
  'clinical',
  'aesthetic',
  'followup',
  'emergency',
  'telemedicine',
]);

export const encounterStatusSchema = z.enum([
  'rascunho',
  'revisao',
  'assinado',
  'corrigido',
]);

/* ── Vital signs ─────────────────────────────────────────────────────────── */

export const vitalSignsSchema = z.object({
  bloodPressureSys: z.number().int().min(40).max(260).optional(),
  bloodPressureDia: z.number().int().min(20).max(180).optional(),
  heartRate:        z.number().int().min(20).max(250).optional(),
  temperatureC:     z.number().min(30).max(45).optional(),
  oxygenSaturation: z.number().int().min(50).max(100).optional(),
  weightKg:         z.number().min(0.5).max(500).optional(),
  heightCm:         z.number().min(20).max(260).optional(),
  notes:            z.string().max(500).optional(),
});

export type VitalSignsInput = z.infer<typeof vitalSignsSchema>;

/* ── Diagnoses ───────────────────────────────────────────────────────────── */

export const encounterDiagnosisSchema = z.object({
  code:        z.string().min(3).max(10),
  description: z.string().max(300),
  isPrimary:   z.boolean().default(false),
  // Quando a sugestão veio da IA, preservamos métrica para auditoria clínica
  aiGenerated: z.boolean().default(false),
  confidence:  z.number().min(0).max(1).optional(),
});

export type EncounterDiagnosisInput = z.infer<typeof encounterDiagnosisSchema>;

/* ── Next appointment hint ──────────────────────────────────────────────── */

export const nextAppointmentHintSchema = z.object({
  enabled:         z.boolean().default(false),
  intervalDays:    z.number().int().min(1).max(730).optional(),
  notes:           z.string().max(500).optional(),
});

/* ── Create ──────────────────────────────────────────────────────────────── */

export const createEncounterSchema = z.object({
  appointmentId: z.string().uuid(),
  type:          encounterTypeSchema.default('clinical'),
});

/* ── Update (full) ───────────────────────────────────────────────────────── */

export const updateEncounterSchema = z.object({
  chiefComplaint:    z.string().max(2000).optional(),
  subjective:        z.string().max(20000).optional(),
  objective:         z.string().max(20000).optional(),
  assessment:        z.string().max(20000).optional(),
  plan:              z.string().max(20000).optional(),
  internalNotes:     z.string().max(10000).optional(),
  diagnoses:         z.array(encounterDiagnosisSchema).max(30).optional(),
  vitalSigns:        vitalSignsSchema.optional(),
  structuredData:    z.record(z.string(), z.unknown()).optional(),
  nextAppointment:   nextAppointmentHintSchema.optional(),
});

/* ── Auto-save (partial, silent validation) ─────────────────────────────── */

export const autoSaveEncounterSchema = z.object({
  chiefComplaint: z.string().max(2000).optional(),
  subjective:     z.string().max(20000).optional(),
  objective:      z.string().max(20000).optional(),
  assessment:     z.string().max(20000).optional(),
  plan:           z.string().max(20000).optional(),
  internalNotes:  z.string().max(10000).optional(),
  diagnoses:      z.array(encounterDiagnosisSchema).max(30).optional(),
  vitalSigns:     vitalSignsSchema.optional(),
  structuredData: z.record(z.string(), z.unknown()).optional(),
});

/* ── Sign / correction ───────────────────────────────────────────────────── */

export const signEncounterSchema = z.object({
  id: z.string().uuid(),
});

export const correctEncounterSchema = z.object({
  id:            z.string().uuid(),
  correction:    z.object({
    chiefComplaint:  z.string().max(2000).optional(),
    subjective:      z.string().max(20000).optional(),
    objective:       z.string().max(20000).optional(),
    assessment:      z.string().max(20000).optional(),
    plan:            z.string().max(20000).optional(),
    internalNotes:   z.string().max(10000).optional(),
    diagnoses:       z.array(encounterDiagnosisSchema).max(30).optional(),
  }),
  justification: z.string().min(10, 'Justificativa deve ter ao menos 10 caracteres').max(2000),
});

/* ── Listing / fetching ──────────────────────────────────────────────────── */

export const encounterListByPatientSchema = z.object({
  patientId: z.string().uuid(),
  page:      z.coerce.number().int().positive().default(1),
  pageSize:  z.coerce.number().int().positive().max(100).default(20),
});

export const getEncounterByIdSchema = z.object({
  id: z.string().uuid(),
});

/* ── AI suggestions ──────────────────────────────────────────────────────── */

export const aiSuggestCidsSchema = z.object({
  soapText: z.string().min(10, 'Texto muito curto').max(20000),
});

export const aiSuggestSoapSchema = z.object({
  chiefComplaint:  z.string().min(2).max(1000),
  patientHistory:  z.string().max(5000).optional(),
});

export const aiCidSuggestionSchema = z.object({
  cid:         z.string(),
  description: z.string(),
  confidence:  z.number().min(0).max(1),
});

export type CreateEncounterInput       = z.infer<typeof createEncounterSchema>;
export type UpdateEncounterInput       = z.infer<typeof updateEncounterSchema>;
export type AutoSaveEncounterInput     = z.infer<typeof autoSaveEncounterSchema>;
export type CorrectEncounterInput      = z.infer<typeof correctEncounterSchema>;
export type EncounterListByPatientQuery = z.infer<typeof encounterListByPatientSchema>;
export type AiSuggestCidsInput         = z.infer<typeof aiSuggestCidsSchema>;
export type AiSuggestSoapInput         = z.infer<typeof aiSuggestSoapSchema>;
export type AiCidSuggestion            = z.infer<typeof aiCidSuggestionSchema>;
export type NextAppointmentHint        = z.infer<typeof nextAppointmentHintSchema>;
