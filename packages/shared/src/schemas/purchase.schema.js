"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPurchaseSettingsSchema = exports.listSuggestionsSchema = exports.parseNfeSchema = exports.getOrderSchema = exports.listOrdersSchema = exports.receiveOrderSchema = exports.sendOrderSchema = exports.returnOrderSchema = exports.rejectOrderSchema = exports.approveOrderSchema = exports.submitOrderSchema = exports.updatePurchaseOrderSchema = exports.createPurchaseOrderSchema = exports.EDITABLE_STATUSES = exports.VALID_TRANSITIONS = exports.ORDER_URGENCY_LABELS = exports.ORDER_URGENCIES = exports.ORDER_STATUS_LABELS = exports.ORDER_STATUSES = void 0;
const zod_1 = require("zod");
/* ── Status e urgência ───────────────────────────────────────────────────── */
exports.ORDER_STATUSES = [
    'rascunho',
    'pendente_aprovacao',
    'aprovado',
    'rejeitado',
    'devolvido',
    'enviado',
    'parcialmente_recebido',
    'recebido',
    'cancelado',
];
exports.ORDER_STATUS_LABELS = {
    rascunho: 'Rascunho',
    pendente_aprovacao: 'Aguardando aprovação',
    aprovado: 'Aprovado',
    rejeitado: 'Rejeitado',
    devolvido: 'Devolvido para correção',
    enviado: 'Enviado ao fornecedor',
    parcialmente_recebido: 'Parcialmente recebido',
    recebido: 'Recebido',
    cancelado: 'Cancelado',
};
exports.ORDER_URGENCIES = ['normal', 'urgente', 'emergencia'];
exports.ORDER_URGENCY_LABELS = {
    normal: 'Normal',
    urgente: 'Urgente',
    emergencia: 'Emergência',
};
/* ── Máquina de estados ───────────────────────────────────────────────────
 * Espelha a validação server-side; também usada no frontend para esconder
 * ações inválidas sem chamar a API.
 */
exports.VALID_TRANSITIONS = {
    rascunho: ['pendente_aprovacao', 'cancelado'],
    pendente_aprovacao: ['aprovado', 'rejeitado', 'devolvido'],
    aprovado: ['enviado'],
    rejeitado: ['cancelado'],
    devolvido: ['pendente_aprovacao', 'cancelado'],
    enviado: ['parcialmente_recebido', 'recebido'],
    parcialmente_recebido: ['parcialmente_recebido', 'recebido'],
    recebido: [],
    cancelado: [],
};
exports.EDITABLE_STATUSES = ['rascunho', 'devolvido'];
/* ── Schemas de input ────────────────────────────────────────────────────── */
const orderItemInputSchema = zod_1.z.object({
    id: zod_1.z.string().uuid().optional(), // se já existe (update)
    productId: zod_1.z.string().uuid('Produto inválido'),
    quantity: zod_1.z.number().positive('Quantidade deve ser > 0'),
    estimatedCost: zod_1.z.number().min(0, 'Preço estimado deve ser ≥ 0'),
    notes: zod_1.z.string().trim().max(500).nullable().optional(),
});
exports.createPurchaseOrderSchema = zod_1.z.object({
    supplierId: zod_1.z.string().uuid('Fornecedor obrigatório'),
    urgency: zod_1.z.enum(exports.ORDER_URGENCIES, { errorMap: () => ({ message: 'Urgência inválida' }) }),
    notes: zod_1.z.string().trim().max(1000).nullable().optional(),
    expectedDelivery: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida').nullable().optional(),
    items: zod_1.z.array(orderItemInputSchema)
        .min(1, 'Pelo menos 1 item é obrigatório')
        .max(100, 'Máximo de 100 itens por pedido'),
});
exports.updatePurchaseOrderSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid(),
    supplierId: zod_1.z.string().uuid().optional(),
    urgency: zod_1.z.enum(exports.ORDER_URGENCIES).optional(),
    notes: zod_1.z.string().trim().max(1000).nullable().optional(),
    expectedDelivery: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    items: zod_1.z.array(orderItemInputSchema).min(1).max(100).optional(),
});
exports.submitOrderSchema = zod_1.z.object({ orderId: zod_1.z.string().uuid() });
exports.approveOrderSchema = zod_1.z.object({ orderId: zod_1.z.string().uuid() });
exports.rejectOrderSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid(),
    reason: zod_1.z.string().trim()
        .min(10, 'Motivo deve ter no mínimo 10 caracteres')
        .max(500, 'Motivo muito longo'),
});
exports.returnOrderSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid(),
    reason: zod_1.z.string().trim()
        .min(10, 'Motivo deve ter no mínimo 10 caracteres')
        .max(500, 'Motivo muito longo'),
});
exports.sendOrderSchema = zod_1.z.object({ orderId: zod_1.z.string().uuid() });
const receiveItemSchema = zod_1.z.object({
    purchaseOrderItemId: zod_1.z.string().uuid(),
    quantityReceived: zod_1.z.number().min(0, 'Quantidade não pode ser negativa'),
    lotNumber: zod_1.z.string().trim().max(80),
    expiryDate: zod_1.z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no formato YYYY-MM-DD')
        .nullable()
        .optional(),
    temperatureCelsius: zod_1.z.number().nullable().optional(),
    storageLocationId: zod_1.z.string().uuid().nullable().optional(),
});
exports.receiveOrderSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid(),
    type: zod_1.z.enum(['confirmar_total', 'confirmar_parcial', 'recusar']),
    // Dados NF-e (opcional — aceita preenchimento manual se parse falhar)
    nfeXml: zod_1.z.string().max(5 * 1024 * 1024, 'XML excede 5MB').optional(),
    nfeNumber: zod_1.z.string().trim().max(20).optional(),
    nfeSeries: zod_1.z.string().trim().max(5).optional(),
    issuerCnpj: zod_1.z.string().trim().optional(),
    issueDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    divergenceJustification: zod_1.z.string().trim().min(10).max(500).optional(),
    supervisorApproved: zod_1.z.boolean().optional(),
    refusalReason: zod_1.z.string().trim()
        .min(10, 'Motivo de recusa deve ter no mínimo 10 caracteres')
        .max(500)
        .optional(),
    items: zod_1.z.array(receiveItemSchema).min(1, 'Pelo menos 1 item é obrigatório'),
}).superRefine((d, ctx) => {
    if (d.type === 'recusar' && !d.refusalReason) {
        ctx.addIssue({ code: 'custom', path: ['refusalReason'],
            message: 'Motivo obrigatório para recusa de recebimento' });
    }
    if (d.type !== 'recusar') {
        const hasReceived = d.items.some(i => i.quantityReceived > 0);
        if (!hasReceived) {
            ctx.addIssue({ code: 'custom', path: ['items'],
                message: 'Pelo menos 1 item deve ter quantidade recebida > 0' });
        }
        // Lote obrigatório para cada item recebido
        for (let idx = 0; idx < d.items.length; idx++) {
            const item = d.items[idx];
            if (item.quantityReceived > 0 && !item.lotNumber?.trim()) {
                ctx.addIssue({ code: 'custom', path: ['items', idx, 'lotNumber'],
                    message: 'Número de lote obrigatório para itens recebidos' });
            }
        }
    }
});
exports.listOrdersSchema = zod_1.z.object({
    status: zod_1.z.enum(exports.ORDER_STATUSES).optional(),
    urgency: zod_1.z.enum(exports.ORDER_URGENCIES).optional(),
    supplierId: zod_1.z.string().uuid().optional(),
    dateFrom: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateTo: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    search: zod_1.z.string().max(200).optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
exports.getOrderSchema = zod_1.z.object({ orderId: zod_1.z.string().uuid() });
exports.parseNfeSchema = zod_1.z.object({
    xml: zod_1.z.string().min(1, 'XML obrigatório').max(5 * 1024 * 1024, 'XML excede 5MB'),
});
exports.listSuggestionsSchema = zod_1.z.object({
    supplierId: zod_1.z.string().uuid().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(200).default(50),
});
exports.getPurchaseSettingsSchema = zod_1.z.object({});
//# sourceMappingURL=purchase.schema.js.map