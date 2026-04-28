"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadRecallReportSchema = exports.generateRecallReportSchema = exports.tracebackByPatientSchema = exports.tracebackByLotSchema = exports.todayAppointmentsWithKitsSchema = exports.listConsumptionsSchema = exports.consumeKitSchema = exports.consumptionItemOverrideSchema = exports.CONSUMPTION_STATUSES = exports.CONSUMPTION_SOURCES = exports.kitAvailabilitySchema = exports.archiveKitSchema = exports.listKitsSchema = exports.updateKitSchema = exports.createKitSchema = exports.kitItemInputSchema = exports.KIT_ITEM_STATUSES = exports.KIT_AVAILABILITY_LABELS = exports.KIT_AVAILABILITY_STATUSES = exports.KIT_STATUS_LABELS = exports.KIT_STATUSES = void 0;
const zod_1 = require("zod");
/* ══════════════════════════════════════════════════════════════════════════
 * Kits de procedimento — CRUD, disponibilidade, consumo, rastreabilidade
 * ══════════════════════════════════════════════════════════════════════════ */
exports.KIT_STATUSES = ['active', 'superseded', 'archived'];
exports.KIT_STATUS_LABELS = {
    active: 'Ativo',
    superseded: 'Substituído',
    archived: 'Arquivado',
};
exports.KIT_AVAILABILITY_STATUSES = ['completo', 'parcial', 'indisponivel'];
exports.KIT_AVAILABILITY_LABELS = {
    completo: 'Disponível',
    parcial: 'Parcial',
    indisponivel: 'Indisponível',
};
exports.KIT_ITEM_STATUSES = ['disponivel', 'insuficiente', 'indisponivel'];
/* ── Kit item (body) ─────────────────────────────────────────────────────── */
exports.kitItemInputSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid('Produto inválido'),
    quantity: zod_1.z.number().positive('Quantidade deve ser > 0'),
    isOptional: zod_1.z.boolean().default(false),
    displayOrder: zod_1.z.number().int().nonnegative().default(0),
    notes: zod_1.z.string().trim().max(500).nullable().optional(),
});
/* ── Create/Update kit ───────────────────────────────────────────────────── */
const kitItemsArraySchema = zod_1.z.array(exports.kitItemInputSchema)
    .min(1, 'Kit deve conter ao menos 1 item')
    .superRefine((items, ctx) => {
    const seen = new Set();
    for (let i = 0; i < items.length; i++) {
        const id = items[i].productId;
        if (seen.has(id)) {
            ctx.addIssue({
                code: 'custom',
                path: [i, 'productId'],
                message: 'Produto duplicado no kit — use apenas um registro por produto',
            });
        }
        seen.add(id);
    }
});
exports.createKitSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(3, 'Nome muito curto').max(120, 'Nome muito longo'),
    description: zod_1.z.string().trim().max(500).nullable().optional(),
    procedureTypeId: zod_1.z.string().uuid('Tipo de procedimento obrigatório'),
    items: kitItemsArraySchema,
});
exports.updateKitSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().trim().min(3).max(120).optional(),
    description: zod_1.z.string().trim().max(500).nullable().optional(),
    procedureTypeId: zod_1.z.string().uuid().optional(),
    items: kitItemsArraySchema.optional(),
    acknowledgeVersioning: zod_1.z.boolean().optional(),
});
/* ── List kits ───────────────────────────────────────────────────────────── */
exports.listKitsSchema = zod_1.z.object({
    search: zod_1.z.string().trim().max(120).optional(),
    procedureTypeId: zod_1.z.string().uuid().optional(),
    availability: zod_1.z.enum(exports.KIT_AVAILABILITY_STATUSES).optional(),
    includeArchived: zod_1.z.boolean().default(false),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(50),
});
exports.archiveKitSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
/* ── Availability check ──────────────────────────────────────────────────── */
exports.kitAvailabilitySchema = zod_1.z.object({
    kitId: zod_1.z.string().uuid(),
});
/* ══════════════════════════════════════════════════════════════════════════
 * Consumo por procedimento
 * ══════════════════════════════════════════════════════════════════════════ */
exports.CONSUMPTION_SOURCES = ['encounter', 'protocol_session', 'manual', 'offline_sync'];
exports.CONSUMPTION_STATUSES = ['completed', 'partial', 'skipped', 'failed'];
/* ── Consumption item override (usuário troca de lote ou marca não-usado) ─ */
exports.consumptionItemOverrideSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid(),
    // Lote específico escolhido (sobrescreve sugestão FEFO). Null = usa FEFO.
    lotId: zod_1.z.string().uuid().nullable().optional(),
    // Marca item opcional como não usado neste procedimento.
    skipped: zod_1.z.boolean().default(false),
    // Quantidade efetivamente usada (default = quantity do kit_item).
    quantity: zod_1.z.number().positive().optional(),
});
/* ── Consume kit (request) ───────────────────────────────────────────────── */
exports.consumeKitSchema = zod_1.z.object({
    kitId: zod_1.z.string().uuid(),
    patientId: zod_1.z.string().uuid('Paciente obrigatório'),
    encounterId: zod_1.z.string().uuid().nullable().optional(),
    protocolSessionId: zod_1.z.string().uuid().nullable().optional(),
    source: zod_1.z.enum(exports.CONSUMPTION_SOURCES).default('manual'),
    idempotencyKey: zod_1.z.string().trim().min(6).max(200),
    confirmed: zod_1.z.literal(true, {
        errorMap: () => ({ message: 'Confirmação obrigatória para registrar consumo' }),
    }),
    overrides: zod_1.z.array(exports.consumptionItemOverrideSchema).default([]),
    notes: zod_1.z.string().trim().max(500).nullable().optional(),
    // Permite finalizar o consumo mesmo com itens faltantes (gera pending_items).
    allowPartial: zod_1.z.boolean().default(true),
    // Timestamp do consumo na origem (útil para offline). Default: NOW no servidor.
    occurredAt: zod_1.z.string().datetime().optional(),
})
    .superRefine((d, ctx) => {
    if (!d.encounterId && !d.protocolSessionId && d.source !== 'manual' && d.source !== 'offline_sync') {
        ctx.addIssue({
            code: 'custom',
            path: ['encounterId'],
            message: 'Consumo exige encounterId ou protocolSessionId',
        });
    }
});
/* ── List consumptions (histórico) ───────────────────────────────────────── */
exports.listConsumptionsSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid().optional(),
    kitId: zod_1.z.string().uuid().optional(),
    status: zod_1.z.enum(exports.CONSUMPTION_STATUSES).optional(),
    encounterId: zod_1.z.string().uuid().optional(),
    from: zod_1.z.string().datetime().optional(),
    to: zod_1.z.string().datetime().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(50),
});
/* ── Agenda-do-dia (step 1) ──────────────────────────────────────────────── */
exports.todayAppointmentsWithKitsSchema = zod_1.z.object({
    providerId: zod_1.z.string().uuid().optional(),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
/* ══════════════════════════════════════════════════════════════════════════
 * Rastreabilidade ANVISA
 * ══════════════════════════════════════════════════════════════════════════ */
exports.tracebackByLotSchema = zod_1.z.object({
    lotId: zod_1.z.string().uuid().optional(),
    lotNumber: zod_1.z.string().trim().min(1).max(80).optional(),
    productId: zod_1.z.string().uuid().optional(),
    cursor: zod_1.z.string().datetime().optional(),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(50),
})
    .superRefine((d, ctx) => {
    if (!d.lotId && !d.lotNumber) {
        ctx.addIssue({
            code: 'custom',
            path: ['lotId'],
            message: 'Informe lotId ou lotNumber',
        });
    }
});
exports.tracebackByPatientSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid(),
    from: zod_1.z.string().datetime().optional(),
    to: zod_1.z.string().datetime().optional(),
    cursor: zod_1.z.string().datetime().optional(),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(50),
});
/* ── PDF report (recall) ─────────────────────────────────────────────────── */
exports.generateRecallReportSchema = zod_1.z.object({
    scope: zod_1.z.enum(['by_lot', 'by_patient']),
    lotId: zod_1.z.string().uuid().optional(),
    patientId: zod_1.z.string().uuid().optional(),
})
    .superRefine((d, ctx) => {
    if (d.scope === 'by_lot' && !d.lotId) {
        ctx.addIssue({ code: 'custom', path: ['lotId'], message: 'lotId obrigatório para escopo by_lot' });
    }
    if (d.scope === 'by_patient' && !d.patientId) {
        ctx.addIssue({ code: 'custom', path: ['patientId'], message: 'patientId obrigatório para escopo by_patient' });
    }
});
exports.downloadRecallReportSchema = zod_1.z.object({
    reportId: zod_1.z.string().uuid(),
});
//# sourceMappingURL=kits.schema.js.map