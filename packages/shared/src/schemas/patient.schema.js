"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergePatientSchema = exports.searchPatientSchema = exports.patientListQuerySchema = exports.updatePatientSchema = exports.createPatientSchema = exports.patientStatusSchema = exports.genderSchema = void 0;
const zod_1 = require("zod");
exports.genderSchema = zod_1.z.enum([
    'male',
    'female',
    'non_binary',
    'prefer_not_to_say',
    'other',
]);
exports.patientStatusSchema = zod_1.z.enum([
    'active',
    'inactive',
    'blocked',
    'deceased',
    'transferred',
    'merged',
]);
const cpfRegex = /^\d{11}$/;
const phoneRegex = /^\d{10,11}$/;
exports.createPatientSchema = zod_1.z.object({
    name: zod_1.z
        .string({ required_error: 'Nome é obrigatório' })
        .min(2, 'Nome deve ter no mínimo 2 caracteres')
        .max(200, 'Nome muito longo')
        .trim(),
    cpf: zod_1.z
        .string()
        .regex(cpfRegex, 'CPF deve conter 11 dígitos sem formatação')
        .optional(),
    birthDate: zod_1.z.coerce
        .date()
        .max(new Date(), 'Data de nascimento não pode ser no futuro')
        .optional(),
    gender: exports.genderSchema.optional(),
    email: zod_1.z.string().email('Email inválido').toLowerCase().trim().optional(),
    phone: zod_1.z
        .string()
        .regex(phoneRegex, 'Telefone deve conter 10 ou 11 dígitos')
        .optional(),
    phoneSecondary: zod_1.z
        .string()
        .regex(phoneRegex, 'Telefone deve conter 10 ou 11 dígitos')
        .optional(),
    bloodType: zod_1.z
        .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
        .optional(),
    allergies: zod_1.z.array(zod_1.z.string().max(200)).default([]),
    chronicConditions: zod_1.z.array(zod_1.z.string().max(200)).default([]),
    activeMedications: zod_1.z.array(zod_1.z.string().max(200)).default([]),
    address: zod_1.z
        .object({
        street: zod_1.z.string().optional(),
        number: zod_1.z.string().optional(),
        complement: zod_1.z.string().optional(),
        district: zod_1.z.string().optional(),
        city: zod_1.z.string().optional(),
        state: zod_1.z.string().length(2).optional(),
        zip: zod_1.z.string().optional(),
    })
        .optional(),
    sourceChannel: zod_1.z.string().optional(),
    sourceCampaign: zod_1.z.string().optional(),
    referredBy: zod_1.z.string().uuid().optional(),
    portalEnabled: zod_1.z.boolean().default(false),
    portalEmail: zod_1.z.string().email().optional(),
    internalNotes: zod_1.z.string().max(5000).optional(),
});
exports.updatePatientSchema = exports.createPatientSchema.partial();
exports.patientListQuerySchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    status: exports.patientStatusSchema.optional(),
    source: zod_1.z.string().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
    sortBy: zod_1.z.enum(['name', 'createdAt', 'lastVisitAt']).default('name'),
    sortDir: zod_1.z.enum(['asc', 'desc']).default('asc'),
});
exports.searchPatientSchema = zod_1.z.object({
    query: zod_1.z.string().optional(),
    status: exports.patientStatusSchema.optional(),
    source: zod_1.z.string().optional(),
    dateRange: zod_1.z
        .object({
        from: zod_1.z.coerce.date().optional(),
        to: zod_1.z.coerce.date().optional(),
    })
        .optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
    sort: zod_1.z.enum(['name', 'createdAt', 'lastVisitAt']).default('name'),
    sortDir: zod_1.z.enum(['asc', 'desc']).default('asc'),
});
exports.mergePatientSchema = zod_1.z.object({
    primaryId: zod_1.z.string().uuid('ID primário inválido'),
    secondaryId: zod_1.z.string().uuid('ID secundário inválido'),
    fieldsToKeep: zod_1.z.record(zod_1.z.string(), zod_1.z.enum(['primary', 'secondary'])).optional(),
}).refine((d) => d.primaryId !== d.secondaryId, { message: 'Paciente primário e secundário devem ser diferentes' });
//# sourceMappingURL=patient.schema.js.map