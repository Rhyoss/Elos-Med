"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProtocolSessionByIdSchema = exports.listProtocolSessionsSchema = exports.getProtocolByIdSchema = exports.listProtocolsByPatientSchema = exports.suggestNextSessionSchema = exports.correctSessionSchema = exports.registerSessionSchema = exports.sessionProductConsumptionSchema = exports.adverseEventSchema = exports.resumeProtocolSchema = exports.pauseProtocolSchema = exports.cancelProtocolSchema = exports.updateProtocolSchema = exports.createProtocolSchema = exports.protocolProductLinkSchema = exports.ADVERSE_SEVERITY_LABELS = exports.adverseSeveritySchema = exports.PROTOCOL_STATUS_LABELS = exports.protocolStatusSchema = exports.PROTOCOL_TYPE_LABELS = exports.protocolTypeSchema = exports.PROTOCOL_TYPES = void 0;
const zod_1 = require("zod");
/* ── Tipos / status ─────────────────────────────────────────────────────── */
exports.PROTOCOL_TYPES = [
    'fototerapia',
    'laser_fracionado',
    'peeling',
    'injetavel',
    'microagulhamento',
    'outro',
];
exports.protocolTypeSchema = zod_1.z.enum(exports.PROTOCOL_TYPES);
exports.PROTOCOL_TYPE_LABELS = {
    fototerapia: 'Fototerapia',
    laser_fracionado: 'Laser fracionado',
    peeling: 'Peeling químico',
    injetavel: 'Injetáveis',
    microagulhamento: 'Microagulhamento',
    outro: 'Outro',
};
exports.protocolStatusSchema = zod_1.z.enum([
    'ativo', 'pausado', 'concluido', 'cancelado',
]);
exports.PROTOCOL_STATUS_LABELS = {
    ativo: 'Em andamento',
    pausado: 'Pausado',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
};
exports.adverseSeveritySchema = zod_1.z.enum(['none', 'leve', 'moderado', 'grave']);
exports.ADVERSE_SEVERITY_LABELS = {
    none: 'Nenhum',
    leve: 'Leve',
    moderado: 'Moderado',
    grave: 'Grave',
};
/* ── Links de produtos (vínculo com supply) ─────────────────────────────── */
exports.protocolProductLinkSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid(),
    quantityPerSession: zod_1.z.number().positive().max(9999),
    notes: zod_1.z.string().trim().max(200).optional(),
});
/* ── Create / Update protocolo ──────────────────────────────────────────── */
exports.createProtocolSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid('Paciente inválido'),
    providerId: zod_1.z.string().uuid('Profissional inválido'),
    type: exports.protocolTypeSchema,
    name: zod_1.z.string().trim().min(2, 'Nome do protocolo é obrigatório').max(200),
    description: zod_1.z.string().trim().max(2000).optional(),
    totalSessions: zod_1.z.number().int().positive('Total de sessões deve ser maior que zero').max(100),
    intervalDays: zod_1.z.number().int().positive('Intervalo deve ser maior que zero').max(365),
    startedAt: zod_1.z.coerce.date().optional(),
    parametersSchema: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    productLinks: zod_1.z.array(exports.protocolProductLinkSchema).max(50).optional(),
    notes: zod_1.z.string().trim().max(2000).optional(),
});
exports.updateProtocolSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    data: zod_1.z.object({
        name: zod_1.z.string().trim().min(2).max(200).optional(),
        description: zod_1.z.string().trim().max(2000).nullable().optional(),
        totalSessions: zod_1.z.number().int().positive().max(100).optional(),
        intervalDays: zod_1.z.number().int().positive().max(365).optional(),
        parametersSchema: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
        productLinks: zod_1.z.array(exports.protocolProductLinkSchema).max(50).optional(),
        notes: zod_1.z.string().trim().max(2000).nullable().optional(),
    }),
});
exports.cancelProtocolSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    reason: zod_1.z.string().trim().min(3, 'Motivo obrigatório').max(500),
});
exports.pauseProtocolSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    reason: zod_1.z.string().trim().min(3, 'Motivo obrigatório').max(500),
});
exports.resumeProtocolSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
/* ── Eventos adversos ───────────────────────────────────────────────────── */
exports.adverseEventSchema = zod_1.z.object({
    description: zod_1.z.string().trim().min(2, 'Descrição obrigatória').max(500),
    severity: exports.adverseSeveritySchema.exclude(['none']),
    action: zod_1.z.string().trim().max(500).optional(),
});
/* ── Consumo de produto por sessão ──────────────────────────────────────── */
exports.sessionProductConsumptionSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid(),
    quantity: zod_1.z.number().positive().max(9999),
    lotId: zod_1.z.string().uuid().optional(),
    notes: zod_1.z.string().trim().max(200).optional(),
});
/* ── Registrar sessão ──────────────────────────────────────────────────── */
exports.registerSessionSchema = zod_1.z.object({
    protocolId: zod_1.z.string().uuid(),
    appointmentId: zod_1.z.string().uuid().optional(),
    performedAt: zod_1.z.coerce.date().optional(),
    durationMin: zod_1.z.number().int().positive().max(600).optional(),
    parameters: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    patientResponse: zod_1.z.string().trim().max(2000).optional(),
    adverseEvents: zod_1.z.array(exports.adverseEventSchema).max(20).default([]),
    productsConsumed: zod_1.z.array(exports.sessionProductConsumptionSchema).max(40).default([]),
    preImageIds: zod_1.z.array(zod_1.z.string().uuid()).max(20).default([]),
    postImageIds: zod_1.z.array(zod_1.z.string().uuid()).max(20).default([]),
    outcome: zod_1.z.string().trim().max(1000).optional(),
    nextSessionNotes: zod_1.z.string().trim().max(1000).optional(),
    observations: zod_1.z.string().trim().max(2000).optional(),
});
exports.correctSessionSchema = zod_1.z.object({
    sessionId: zod_1.z.string().uuid(),
    justification: zod_1.z.string().trim().min(10, 'Justificativa deve ter ao menos 10 caracteres').max(1000),
    correction: exports.registerSessionSchema.omit({ protocolId: true }).partial(),
});
exports.suggestNextSessionSchema = zod_1.z.object({
    protocolId: zod_1.z.string().uuid(),
});
/* ── Queries ────────────────────────────────────────────────────────────── */
exports.listProtocolsByPatientSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid(),
    status: exports.protocolStatusSchema.optional(),
});
exports.getProtocolByIdSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
exports.listProtocolSessionsSchema = zod_1.z.object({
    protocolId: zod_1.z.string().uuid(),
});
exports.getProtocolSessionByIdSchema = zod_1.z.object({
    sessionId: zod_1.z.string().uuid(),
});
//# sourceMappingURL=protocol.schema.js.map