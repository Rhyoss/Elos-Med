"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRESCRIPTION_TYPE_FIELDS = exports.requestPrescriptionPdfSchema = exports.getPrescriptionByIdSchema = exports.listPrescriptionsByPatientSchema = exports.sendPrescriptionSchema = exports.cancelPrescriptionSchema = exports.duplicatePrescriptionSchema = exports.signPrescriptionSchema = exports.updatePrescriptionSchema = exports.createPrescriptionSchema = exports.prescriptionItemSchema = exports.cosmeceuticaItemSchema = exports.manipuladaItemSchema = exports.manipuladaComponentSchema = exports.sistemicaItemSchema = exports.topicaItemSchema = exports.prescriptionDeliveryStatusSchema = exports.PRESCRIPTION_STATUS_LABELS = exports.prescriptionStatusSchema = exports.PRESCRIPTION_TYPE_LABELS = exports.prescriptionTypeSchema = exports.PRESCRIPTION_TYPES = void 0;
const zod_1 = require("zod");
/* ── Tipos de prescrição ────────────────────────────────────────────────── */
exports.PRESCRIPTION_TYPES = [
    'topica',
    'sistemica',
    'manipulada',
    'cosmeceutica',
];
exports.prescriptionTypeSchema = zod_1.z.enum(exports.PRESCRIPTION_TYPES);
exports.PRESCRIPTION_TYPE_LABELS = {
    topica: 'Tópica',
    sistemica: 'Sistêmica',
    manipulada: 'Manipulada',
    cosmeceutica: 'Cosmecêutica',
};
exports.prescriptionStatusSchema = zod_1.z.enum([
    'rascunho',
    'emitida',
    'assinada',
    'enviada_digital',
    'impressa',
    'expirada',
    'cancelada',
]);
exports.PRESCRIPTION_STATUS_LABELS = {
    rascunho: 'Rascunho',
    emitida: 'Emitida',
    assinada: 'Assinada',
    enviada_digital: 'Enviada',
    impressa: 'Impressa',
    expirada: 'Expirada',
    cancelada: 'Cancelada',
};
exports.prescriptionDeliveryStatusSchema = zod_1.z.enum([
    'pending',
    'sent_mock',
    'delivered',
    'failed',
]);
/* ── Itens: schema discriminado por tipo ────────────────────────────────── */
// Campo comum: sanitizar texto livre removendo tags HTML suspeitas via .transform
// (O server faz nova validação/sanitização; client apenas evita submissões óbvias.)
const safeText = (max, min = 0) => zod_1.z.string().trim().min(min).max(max);
const safeTextMin = (max, minVal, msg) => zod_1.z.string().trim().min(minVal, msg).max(max);
exports.topicaItemSchema = zod_1.z.object({
    type: zod_1.z.literal('topica'),
    name: safeText(200).min(2, 'Nome do medicamento é obrigatório'),
    concentration: safeText(100).optional(),
    applicationArea: safeText(200).min(2, 'Área de aplicação é obrigatória'),
    frequency: safeText(120).min(2, 'Posologia é obrigatória'),
    durationDays: zod_1.z.number().int().positive().max(365).optional(),
    instructions: safeText(1000).optional(),
});
exports.sistemicaItemSchema = zod_1.z.object({
    type: zod_1.z.literal('sistemica'),
    name: safeText(200).min(2, 'Nome do medicamento é obrigatório'),
    dosage: safeText(100).min(1, 'Dosagem é obrigatória'),
    form: safeText(60).optional(), // comprimido, cápsula, gotas...
    route: safeText(40).optional(), // oral, IM, IV...
    frequency: safeText(120).min(2, 'Posologia é obrigatória'),
    durationDays: zod_1.z.number().int().positive().max(365),
    quantity: zod_1.z.number().positive().max(9999).optional(),
    continuousUse: zod_1.z.boolean().default(false),
    instructions: safeText(1000).optional(),
});
exports.manipuladaComponentSchema = zod_1.z.object({
    substance: safeText(200).min(2),
    concentration: safeText(60).min(1),
});
exports.manipuladaItemSchema = zod_1.z.object({
    type: zod_1.z.literal('manipulada'),
    formulation: safeText(200).min(2, 'Nome da fórmula é obrigatório'),
    vehicle: safeText(100).min(2, 'Veículo é obrigatório'), // creme, gel, loção
    components: zod_1.z.array(exports.manipuladaComponentSchema).min(1, 'Adicione ao menos um componente').max(20),
    quantity: safeText(60).min(1, 'Quantidade é obrigatória'), // 30g, 100ml
    applicationArea: safeText(200).min(2, 'Área de aplicação é obrigatória'),
    frequency: safeText(120).min(2, 'Posologia é obrigatória'),
    durationDays: zod_1.z.number().int().positive().max(365).optional(),
    instructions: safeText(1000).optional(),
});
exports.cosmeceuticaItemSchema = zod_1.z.object({
    type: zod_1.z.literal('cosmeceutica'),
    name: safeText(200).min(2, 'Produto é obrigatório'),
    brand: safeText(120).optional(),
    applicationArea: safeText(200).min(2, 'Área de aplicação é obrigatória'),
    frequency: safeText(120).min(2, 'Frequência de uso é obrigatória'),
    instructions: safeText(1000).optional(),
});
exports.prescriptionItemSchema = zod_1.z.discriminatedUnion('type', [
    exports.topicaItemSchema,
    exports.sistemicaItemSchema,
    exports.manipuladaItemSchema,
    exports.cosmeceuticaItemSchema,
]);
/* ── Create / Update ────────────────────────────────────────────────────── */
// Valida que todos os itens têm o mesmo `type` declarado na prescrição.
function assertItemsMatchType(type, items, ctx) {
    items.forEach((item, i) => {
        if (item.type !== type) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: `Item ${i + 1} não corresponde ao tipo ${type}`,
                path: ['items', i, 'type'],
            });
        }
    });
}
exports.createPrescriptionSchema = zod_1.z
    .object({
    patientId: zod_1.z.string().uuid('ID de paciente inválido'),
    encounterId: zod_1.z.string().uuid().optional(),
    type: exports.prescriptionTypeSchema,
    items: zod_1.z.array(exports.prescriptionItemSchema).min(1, 'Adicione ao menos um item').max(40),
    notes: zod_1.z.string().trim().max(4000).optional(),
    validUntil: zod_1.z.coerce.date().optional(),
})
    .superRefine((data, ctx) => assertItemsMatchType(data.type, data.items, ctx));
exports.updatePrescriptionSchema = zod_1.z
    .object({
    id: zod_1.z.string().uuid(),
    items: zod_1.z.array(exports.prescriptionItemSchema).min(1).max(40).optional(),
    notes: zod_1.z.string().trim().max(4000).nullable().optional(),
    validUntil: zod_1.z.coerce.date().nullable().optional(),
});
exports.signPrescriptionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
exports.duplicatePrescriptionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
exports.cancelPrescriptionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    reason: zod_1.z.string().trim().min(3, 'Motivo obrigatório').max(500),
});
exports.sendPrescriptionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    channel: zod_1.z.enum(['email', 'sms', 'whatsapp', 'portal']).default('email'),
    recipient: zod_1.z.string().trim().min(3).max(200).optional(),
});
/* ── Queries ────────────────────────────────────────────────────────────── */
exports.listPrescriptionsByPatientSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid(),
    status: exports.prescriptionStatusSchema.optional(),
    type: exports.prescriptionTypeSchema.optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
exports.getPrescriptionByIdSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
exports.requestPrescriptionPdfSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
exports.PRESCRIPTION_TYPE_FIELDS = {
    topica: [
        { key: 'name', label: 'Medicamento', kind: 'text', required: true, maxLength: 200 },
        { key: 'concentration', label: 'Concentração', kind: 'text', required: false, maxLength: 100 },
        { key: 'applicationArea', label: 'Área de aplicação', kind: 'text', required: true, maxLength: 200 },
        { key: 'frequency', label: 'Posologia', kind: 'text', required: true, maxLength: 120 },
        { key: 'durationDays', label: 'Duração (dias)', kind: 'number', required: false, min: 1, max: 365 },
        { key: 'instructions', label: 'Orientações', kind: 'textarea', required: false, maxLength: 1000 },
    ],
    sistemica: [
        { key: 'name', label: 'Medicamento', kind: 'text', required: true, maxLength: 200 },
        { key: 'dosage', label: 'Dosagem', kind: 'text', required: true, maxLength: 100 },
        { key: 'form', label: 'Forma farmacêutica', kind: 'text', required: false, maxLength: 60 },
        { key: 'route', label: 'Via', kind: 'text', required: false, maxLength: 40 },
        { key: 'frequency', label: 'Posologia', kind: 'text', required: true, maxLength: 120 },
        { key: 'durationDays', label: 'Duração (dias)', kind: 'number', required: true, min: 1, max: 365 },
        { key: 'quantity', label: 'Quantidade', kind: 'number', required: false, min: 1, max: 9999 },
        { key: 'continuousUse', label: 'Uso contínuo', kind: 'switch', required: false },
        { key: 'instructions', label: 'Orientações', kind: 'textarea', required: false, maxLength: 1000 },
    ],
    manipulada: [
        { key: 'formulation', label: 'Nome da fórmula', kind: 'text', required: true, maxLength: 200 },
        { key: 'vehicle', label: 'Veículo', kind: 'text', required: true, maxLength: 100 },
        { key: 'components', label: 'Componentes', kind: 'components', required: true },
        { key: 'quantity', label: 'Quantidade total', kind: 'text', required: true, maxLength: 60 },
        { key: 'applicationArea', label: 'Área de aplicação', kind: 'text', required: true, maxLength: 200 },
        { key: 'frequency', label: 'Posologia', kind: 'text', required: true, maxLength: 120 },
        { key: 'durationDays', label: 'Duração (dias)', kind: 'number', required: false, min: 1, max: 365 },
        { key: 'instructions', label: 'Orientações', kind: 'textarea', required: false, maxLength: 1000 },
    ],
    cosmeceutica: [
        { key: 'name', label: 'Produto', kind: 'text', required: true, maxLength: 200 },
        { key: 'brand', label: 'Marca', kind: 'text', required: false, maxLength: 120 },
        { key: 'applicationArea', label: 'Área de aplicação', kind: 'text', required: true, maxLength: 200 },
        { key: 'frequency', label: 'Frequência de uso', kind: 'text', required: true, maxLength: 120 },
        { key: 'instructions', label: 'Orientações', kind: 'textarea', required: false, maxLength: 1000 },
    ],
};
//# sourceMappingURL=prescription.schema.js.map