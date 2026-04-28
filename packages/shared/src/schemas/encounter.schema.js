"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiCidSuggestionSchema = exports.aiSuggestSoapSchema = exports.aiSuggestCidsSchema = exports.getEncounterByIdSchema = exports.encounterListByPatientSchema = exports.correctEncounterSchema = exports.signEncounterSchema = exports.autoSaveEncounterSchema = exports.updateEncounterSchema = exports.createEncounterSchema = exports.nextAppointmentHintSchema = exports.encounterDiagnosisSchema = exports.vitalSignsSchema = exports.encounterStatusSchema = exports.encounterTypeSchema = void 0;
const zod_1 = require("zod");
exports.encounterTypeSchema = zod_1.z.enum([
    'clinical',
    'aesthetic',
    'followup',
    'emergency',
    'telemedicine',
]);
exports.encounterStatusSchema = zod_1.z.enum([
    'rascunho',
    'revisao',
    'assinado',
    'corrigido',
]);
/* ── Vital signs ─────────────────────────────────────────────────────────── */
exports.vitalSignsSchema = zod_1.z.object({
    bloodPressureSys: zod_1.z.number().int().min(40).max(260).optional(),
    bloodPressureDia: zod_1.z.number().int().min(20).max(180).optional(),
    heartRate: zod_1.z.number().int().min(20).max(250).optional(),
    temperatureC: zod_1.z.number().min(30).max(45).optional(),
    oxygenSaturation: zod_1.z.number().int().min(50).max(100).optional(),
    weightKg: zod_1.z.number().min(0.5).max(500).optional(),
    heightCm: zod_1.z.number().min(20).max(260).optional(),
    notes: zod_1.z.string().max(500).optional(),
});
/* ── Diagnoses ───────────────────────────────────────────────────────────── */
exports.encounterDiagnosisSchema = zod_1.z.object({
    code: zod_1.z.string().min(3).max(10),
    description: zod_1.z.string().max(300),
    isPrimary: zod_1.z.boolean().default(false),
    // Quando a sugestão veio da IA, preservamos métrica para auditoria clínica
    aiGenerated: zod_1.z.boolean().default(false),
    confidence: zod_1.z.number().min(0).max(1).optional(),
});
/* ── Next appointment hint ──────────────────────────────────────────────── */
exports.nextAppointmentHintSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(false),
    intervalDays: zod_1.z.number().int().min(1).max(730).optional(),
    notes: zod_1.z.string().max(500).optional(),
});
/* ── Create ──────────────────────────────────────────────────────────────── */
exports.createEncounterSchema = zod_1.z.object({
    appointmentId: zod_1.z.string().uuid(),
    type: exports.encounterTypeSchema.default('clinical'),
});
/* ── Update (full) ───────────────────────────────────────────────────────── */
exports.updateEncounterSchema = zod_1.z.object({
    chiefComplaint: zod_1.z.string().max(2000).optional(),
    subjective: zod_1.z.string().max(20000).optional(),
    objective: zod_1.z.string().max(20000).optional(),
    assessment: zod_1.z.string().max(20000).optional(),
    plan: zod_1.z.string().max(20000).optional(),
    internalNotes: zod_1.z.string().max(10000).optional(),
    diagnoses: zod_1.z.array(exports.encounterDiagnosisSchema).max(30).optional(),
    vitalSigns: exports.vitalSignsSchema.optional(),
    structuredData: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    nextAppointment: exports.nextAppointmentHintSchema.optional(),
});
/* ── Auto-save (partial, silent validation) ─────────────────────────────── */
exports.autoSaveEncounterSchema = zod_1.z.object({
    chiefComplaint: zod_1.z.string().max(2000).optional(),
    subjective: zod_1.z.string().max(20000).optional(),
    objective: zod_1.z.string().max(20000).optional(),
    assessment: zod_1.z.string().max(20000).optional(),
    plan: zod_1.z.string().max(20000).optional(),
    internalNotes: zod_1.z.string().max(10000).optional(),
    diagnoses: zod_1.z.array(exports.encounterDiagnosisSchema).max(30).optional(),
    vitalSigns: exports.vitalSignsSchema.optional(),
    structuredData: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/* ── Sign / correction ───────────────────────────────────────────────────── */
exports.signEncounterSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
exports.correctEncounterSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    correction: zod_1.z.object({
        chiefComplaint: zod_1.z.string().max(2000).optional(),
        subjective: zod_1.z.string().max(20000).optional(),
        objective: zod_1.z.string().max(20000).optional(),
        assessment: zod_1.z.string().max(20000).optional(),
        plan: zod_1.z.string().max(20000).optional(),
        internalNotes: zod_1.z.string().max(10000).optional(),
        diagnoses: zod_1.z.array(exports.encounterDiagnosisSchema).max(30).optional(),
    }),
    justification: zod_1.z.string().min(10, 'Justificativa deve ter ao menos 10 caracteres').max(2000),
});
/* ── Listing / fetching ──────────────────────────────────────────────────── */
exports.encounterListByPatientSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
exports.getEncounterByIdSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
/* ── AI suggestions ──────────────────────────────────────────────────────── */
exports.aiSuggestCidsSchema = zod_1.z.object({
    soapText: zod_1.z.string().min(10, 'Texto muito curto').max(20000),
});
exports.aiSuggestSoapSchema = zod_1.z.object({
    chiefComplaint: zod_1.z.string().min(2).max(1000),
    patientHistory: zod_1.z.string().max(5000).optional(),
});
exports.aiCidSuggestionSchema = zod_1.z.object({
    cid: zod_1.z.string(),
    description: zod_1.z.string(),
    confidence: zod_1.z.number().min(0).max(1),
});
//# sourceMappingURL=encounter.schema.js.map