"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFinancialConfigSchema = exports.caixaQuerySchema = exports.installmentsSchema = exports.refundPaymentSchema = exports.registerPaymentSchema = exports.applyDiscountSchema = exports.cancelInvoiceSchema = exports.emitInvoiceSchema = exports.listInvoicesSchema = exports.updateInvoiceDraftSchema = exports.createInvoiceSchema = exports.discountSchema = exports.invoiceItemSchema = exports.listServicesSchema = exports.updateServiceSchema = exports.createServiceSchema = exports.DISCOUNT_REASON_LABELS = exports.DISCOUNT_REASONS = exports.SERVICE_CATEGORY_LABELS = exports.SERVICE_CATEGORIES = exports.PAYMENT_METHOD_LABELS = exports.PAYMENT_METHODS = exports.INVOICE_STATUS_LABELS = exports.INVOICE_STATUSES = void 0;
const zod_1 = require("zod");
// ─── Constantes de domínio ─────────────────────────────────────────────────
exports.INVOICE_STATUSES = [
    'rascunho',
    'emitida',
    'parcial',
    'paga',
    'vencida',
    'cancelada',
];
exports.INVOICE_STATUS_LABELS = {
    rascunho: 'Rascunho',
    emitida: 'Emitida',
    parcial: 'Parcial',
    paga: 'Paga',
    vencida: 'Vencida',
    cancelada: 'Cancelada',
};
exports.PAYMENT_METHODS = [
    'dinheiro',
    'pix',
    'cartao_credito',
    'cartao_debito',
    'boleto',
    'plano_saude',
];
exports.PAYMENT_METHOD_LABELS = {
    dinheiro: 'Dinheiro',
    pix: 'PIX',
    cartao_credito: 'Cartão de Crédito',
    cartao_debito: 'Cartão de Débito',
    boleto: 'Boleto',
    plano_saude: 'Convênio / Plano',
};
exports.SERVICE_CATEGORIES = [
    'consulta',
    'procedimento_estetico',
    'procedimento_cirurgico',
    'exame',
    'produto',
    'outro',
];
exports.SERVICE_CATEGORY_LABELS = {
    consulta: 'Consulta',
    procedimento_estetico: 'Procedimento Estético',
    procedimento_cirurgico: 'Procedimento Cirúrgico',
    exame: 'Exame',
    produto: 'Produto',
    outro: 'Outro',
};
exports.DISCOUNT_REASONS = [
    'cortesia',
    'pacote',
    'fidelidade',
    'negociacao',
    'outro',
];
exports.DISCOUNT_REASON_LABELS = {
    cortesia: 'Cortesia',
    pacote: 'Pacote',
    fidelidade: 'Fidelidade',
    negociacao: 'Negociação',
    outro: 'Outro',
};
// ─── Validadores internos ──────────────────────────────────────────────────
/** Preço em centavos: >= 0, inteiro */
const priceSchema = zod_1.z
    .number()
    .int('Valor deve ser inteiro (centavos).')
    .min(0, 'Valor não pode ser negativo.');
/** Preço em centavos: > 0, inteiro */
const positivePriceSchema = zod_1.z
    .number()
    .int('Valor deve ser inteiro (centavos).')
    .positive('Valor deve ser maior que zero.');
/** Código TUSS: 8 dígitos numéricos */
const tussCodeSchema = zod_1.z
    .string()
    .regex(/^\d{8}$/, 'Código TUSS deve ter exatamente 8 dígitos numéricos.')
    .optional();
// ─── Catálogo de Serviços ──────────────────────────────────────────────────
exports.createServiceSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Nome obrigatório.').max(200).trim(),
    description: zod_1.z.string().max(1000).trim().optional(),
    category: zod_1.z.enum(exports.SERVICE_CATEGORIES).default('consulta'),
    tussCode: tussCodeSchema,
    cbhpmCode: zod_1.z.string().max(20).optional(),
    price: priceSchema,
    durationMin: zod_1.z.number().int().positive('Duração deve ser maior que zero.').default(30),
});
exports.updateServiceSchema = exports.createServiceSchema
    .partial()
    .extend({
    id: zod_1.z.string().uuid(),
    isActive: zod_1.z.boolean().optional(),
});
exports.listServicesSchema = zod_1.z.object({
    search: zod_1.z.string().max(200).optional(),
    category: zod_1.z.enum(exports.SERVICE_CATEGORIES).optional(),
    isActive: zod_1.z.boolean().optional(),
    page: zod_1.z.number().int().positive().default(1),
    limit: zod_1.z.number().int().positive().max(100).default(25),
});
// ─── Itens de Fatura ───────────────────────────────────────────────────────
exports.invoiceItemSchema = zod_1.z.object({
    serviceId: zod_1.z.string().uuid('ID de serviço inválido.'),
    providerId: zod_1.z.string().uuid('ID de médico inválido.').optional(),
    description: zod_1.z.string().max(500).trim().optional(),
    quantity: zod_1.z.number().int().positive().default(1),
    unitPrice: priceSchema.optional(), // se omitido, usa preço atual do catálogo
});
// ─── Criação / Edição de Fatura (Rascunho) ────────────────────────────────
exports.discountSchema = zod_1.z.discriminatedUnion('discountType', [
    zod_1.z.object({
        discountType: zod_1.z.literal('absolute'),
        discountValue: positivePriceSchema,
        discountReason: zod_1.z.enum(exports.DISCOUNT_REASONS),
        discountNote: zod_1.z.string().min(5, 'Motivo mínimo 5 caracteres.').max(500).optional(),
    }),
    zod_1.z.object({
        discountType: zod_1.z.literal('percentage'),
        discountValue: zod_1.z.number().int().min(1).max(100, 'Desconto máximo 100%.'),
        discountReason: zod_1.z.enum(exports.DISCOUNT_REASONS),
        discountNote: zod_1.z.string().min(5, 'Motivo mínimo 5 caracteres.').max(500).optional(),
    }),
]);
exports.createInvoiceSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid('ID de paciente inválido.'),
    appointmentId: zod_1.z.string().uuid().optional(),
    providerId: zod_1.z.string().uuid().optional(),
    dueDate: zod_1.z.coerce.date().optional(),
    notes: zod_1.z.string().max(2000).trim().optional(),
    internalNotes: zod_1.z.string().max(2000).trim().optional(),
    items: zod_1.z.array(exports.invoiceItemSchema).min(1, 'Fatura deve ter ao menos 1 item.'),
    discount: exports.discountSchema.optional(),
});
exports.updateInvoiceDraftSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    dueDate: zod_1.z.coerce.date().optional(),
    notes: zod_1.z.string().max(2000).trim().optional(),
    internalNotes: zod_1.z.string().max(2000).trim().optional(),
    items: zod_1.z.array(exports.invoiceItemSchema).min(1).optional(),
    discount: exports.discountSchema.optional().nullable(),
});
exports.listInvoicesSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid().optional(),
    providerId: zod_1.z.string().uuid().optional(),
    status: zod_1.z.enum(exports.INVOICE_STATUSES).optional(),
    dateFrom: zod_1.z.coerce.date().optional(),
    dateTo: zod_1.z.coerce.date().optional(),
    search: zod_1.z.string().max(200).optional(),
    page: zod_1.z.number().int().positive().default(1),
    limit: zod_1.z.number().int().positive().max(100).default(25),
});
exports.emitInvoiceSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
exports.cancelInvoiceSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    reason: zod_1.z.string().min(5, 'Motivo de cancelamento obrigatório (mín. 5 chars).').max(500),
});
exports.applyDiscountSchema = zod_1.z.object({
    invoiceId: zod_1.z.string().uuid(),
    discount: exports.discountSchema,
});
// ─── Pagamentos ────────────────────────────────────────────────────────────
const basePaymentSchema = zod_1.z.object({
    invoiceId: zod_1.z.string().uuid('ID de fatura inválido.'),
    amount: positivePriceSchema,
    paidAt: zod_1.z.coerce.date().optional(),
    notes: zod_1.z.string().max(500).optional(),
});
exports.registerPaymentSchema = zod_1.z
    .discriminatedUnion('method', [
    basePaymentSchema.extend({
        method: zod_1.z.literal('dinheiro'),
    }),
    basePaymentSchema.extend({
        method: zod_1.z.literal('pix'),
        pixTxid: zod_1.z.string().max(100).optional(),
    }),
    basePaymentSchema.extend({
        method: zod_1.z.literal('cartao_credito'),
        cardBrand: zod_1.z.string().max(50).optional(),
        cardLast4: zod_1.z.string().length(4).regex(/^\d{4}$/).optional(),
        cardInstallments: zod_1.z.number().int().min(1).default(1),
    }),
    basePaymentSchema.extend({
        method: zod_1.z.literal('cartao_debito'),
        cardBrand: zod_1.z.string().max(50).optional(),
        cardLast4: zod_1.z.string().length(4).regex(/^\d{4}$/).optional(),
    }),
    basePaymentSchema.extend({
        method: zod_1.z.literal('boleto'),
        boletoBarcode: zod_1.z.string().max(200).optional(),
    }),
    basePaymentSchema.extend({
        method: zod_1.z.literal('plano_saude'),
        convenioName: zod_1.z.string().max(100),
        convenioGuide: zod_1.z.string().max(100).optional(),
    }),
])
    .describe('Registro de pagamento com campos específicos por método.');
exports.refundPaymentSchema = zod_1.z.object({
    paymentId: zod_1.z.string().uuid('ID de pagamento inválido.'),
    reason: zod_1.z.string().min(5, 'Motivo de estorno obrigatório (mín. 5 chars).').max(500),
});
exports.installmentsSchema = zod_1.z.object({
    invoiceId: zod_1.z.string().uuid(),
    method: zod_1.z.enum(exports.PAYMENT_METHODS),
    installments: zod_1.z.number().int().min(2, 'Parcelamento exige ao menos 2 parcelas.'),
    firstDueDate: zod_1.z.coerce.date(),
});
// ─── Caixa do Dia ──────────────────────────────────────────────────────────
exports.caixaQuerySchema = zod_1.z.object({
    date: zod_1.z.coerce.date().optional(), // se omitido, usa hoje no timezone da clínica
});
// ─── Configuração Financeira ───────────────────────────────────────────────
exports.updateFinancialConfigSchema = zod_1.z.object({
    timezone: zod_1.z.string().max(100).optional(),
    maxDiscountPct: zod_1.z.number().int().min(0).max(100).optional(),
    adminDiscountFloor: zod_1.z.number().int().min(0).max(100).optional(),
    maxInstallments: zod_1.z.number().int().min(1).max(60).optional(),
    invoicePrefix: zod_1.z.string().min(2).max(6).toUpperCase().optional(),
    dueDays: zod_1.z.number().int().min(0).max(365).optional(),
});
//# sourceMappingURL=financial.schema.js.map