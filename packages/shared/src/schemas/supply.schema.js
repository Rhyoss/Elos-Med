"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMovementSchema = exports.transferMovementSchema = exports.adjustMovementSchema = exports.exitMovementSchema = exports.entryMovementSchema = exports.ALERT_TYPE_LABELS = exports.ALERT_TYPES = exports.ENTRADA_REASONS = exports.AJUSTE_REASONS = exports.SAIDA_REASONS = exports.MOVEMENT_REASON_LABELS = exports.MOVEMENT_REASONS = exports.MOVEMENT_TYPE_LABELS = exports.MOVEMENT_TYPES = exports.EXPIRY_ALERT_LEVEL_LABELS = exports.EXPIRY_ALERT_LEVELS = exports.LOT_STATUS_LABELS = exports.LOT_STATUSES = exports.MAX_LOT_NUMBER_LENGTH = exports.MIN_LOT_NUMBER_LENGTH = exports.MAX_JUSTIFICATION_LENGTH = exports.MIN_JUSTIFICATION_LENGTH = exports.EXPIRY_CRITICAL_DAYS = exports.EXPIRY_WARNING_DAYS = exports.listProductMovementsSchema = exports.listProductLotsSchema = exports.adjustStockSchema = exports.listStockPositionSchema = exports.checkSkuSchema = exports.listProductsSchema = exports.updateProductSchema = exports.createProductSchema = exports.listStorageLocationsSchema = exports.updateStorageLocationSchema = exports.createStorageLocationSchema = exports.listSuppliersSchema = exports.updateSupplierSchema = exports.createSupplierSchema = exports.listCategoriesSchema = exports.updateCategorySchema = exports.createCategorySchema = exports.ADJUSTMENT_REASON_LABELS = exports.ADJUSTMENT_REASONS = exports.STOCK_STATUS_LABELS = exports.STOCK_STATUSES = exports.STORAGE_TYPE_LABELS = exports.REFRIGERATED_STORAGE_TYPES = exports.STORAGE_TYPES = exports.ANVISA_CONTROL_CLASSES = exports.PRODUCT_UNITS = void 0;
exports.listAlertsSchema = exports.fefoSuggestionSchema = exports.quarantineLotSchema = exports.changeLotStatusSchema = exports.listLotsSchema = void 0;
exports.isValidBarcode = isValidBarcode;
exports.isValidBrazilianPhone = isValidBrazilianPhone;
exports.isValidAnvisaRegistration = isValidAnvisaRegistration;
exports.buildAlertEmissionKey = buildAlertEmissionKey;
const zod_1 = require("zod");
const validators_1 = require("../utils/validators");
/* ── Constantes de domínio ────────────────────────────────────────────────── */
exports.PRODUCT_UNITS = [
    'unidade', 'ml', 'mg', 'mcg', 'ampola', 'frasco',
    'caixa', 'par', 'kit', 'pacote', 'rolo', 'litro', 'grama',
];
exports.ANVISA_CONTROL_CLASSES = [
    'A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'C2', 'C3', 'C4', 'C5',
    'D1', 'D2', 'E', 'F1', 'F2', 'F3',
];
exports.STORAGE_TYPES = [
    'geladeira', 'freezer', 'temperatura_ambiente', 'controlado', 'descartavel',
];
exports.REFRIGERATED_STORAGE_TYPES = ['geladeira', 'freezer'];
exports.STORAGE_TYPE_LABELS = {
    geladeira: 'Geladeira (2°C – 8°C)',
    freezer: 'Freezer (≤ −18°C)',
    temperatura_ambiente: 'Temperatura Ambiente',
    controlado: 'Armário Controlado',
    descartavel: 'Área de Descartáveis',
};
exports.STOCK_STATUSES = [
    'OK', 'ATENCAO', 'CRITICO', 'RUPTURA', 'VENCIMENTO_PROXIMO',
];
exports.STOCK_STATUS_LABELS = {
    OK: 'OK',
    ATENCAO: 'Atenção',
    CRITICO: 'Crítico',
    RUPTURA: 'Ruptura',
    VENCIMENTO_PROXIMO: 'Venc. Próximo',
};
exports.ADJUSTMENT_REASONS = ['contagem', 'perda', 'correcao'];
exports.ADJUSTMENT_REASON_LABELS = {
    contagem: 'Contagem de inventário',
    perda: 'Perda / Extravio',
    correcao: 'Correção manual',
};
/* ── Validadores ──────────────────────────────────────────────────────────── */
function validateBarcodeCheckDigit(digits) {
    if (![8, 12, 13].includes(digits.length))
        return false;
    const nums = digits.split('').map(Number);
    const checkDigit = nums[nums.length - 1];
    const sum = nums.slice(0, -1).reduce((acc, d, i) => {
        // UPC-A (12): posições pares (0-based) recebem peso 3
        // EAN-8/EAN-13: posições ímpares (0-based) recebem peso 3
        const weight = digits.length === 12
            ? (i % 2 === 0 ? 3 : 1)
            : (i % 2 === 0 ? 1 : 3);
        return acc + d * weight;
    }, 0);
    return checkDigit === (10 - (sum % 10)) % 10;
}
function isValidBarcode(code) {
    return validateBarcodeCheckDigit(code.replace(/\D/g, ''));
}
function isValidBrazilianPhone(phone) {
    const d = phone.replace(/\D/g, '');
    // DDD (2 dígitos) + número (8 ou 9 dígitos) = 10 ou 11 dígitos
    if (d.length !== 10 && d.length !== 11)
        return false;
    // DDD deve iniciar com dígito 1-9
    return /^[1-9]/.test(d);
}
function isValidAnvisaRegistration(reg) {
    const normalized = reg.replace(/[\s.\-/]/g, '');
    return /^\d{5,15}$/.test(normalized);
}
/* ── Schemas: categorias ─────────────────────────────────────────────────── */
exports.createCategorySchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, 'Nome obrigatório').max(100, 'Nome muito longo'),
    parentId: zod_1.z.string().uuid('ID de categoria pai inválido').nullable().optional(),
    description: zod_1.z.string().trim().max(500, 'Descrição muito longa').nullable().optional(),
});
exports.updateCategorySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().trim().min(1).max(100).optional(),
    parentId: zod_1.z.string().uuid().nullable().optional(),
    description: zod_1.z.string().trim().max(500).nullable().optional(),
});
exports.listCategoriesSchema = zod_1.z.object({
    parentId: zod_1.z.string().uuid().nullable().optional(),
});
/* ── Schemas: fornecedores ───────────────────────────────────────────────── */
exports.createSupplierSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, 'Razão social obrigatória').max(200),
    cnpj: zod_1.z.string().trim().refine(validators_1.isValidCNPJ, 'CNPJ inválido — verifique os dígitos verificadores'),
    contactName: zod_1.z.string().trim().max(100).nullable().optional(),
    phone: zod_1.z.string().trim().refine(isValidBrazilianPhone, 'Formato de telefone inválido (ex: (11) 98765-4321)'),
    email: zod_1.z.string().trim().email('E-mail inválido').max(200),
    paymentTerms: zod_1.z.string().trim().max(200).nullable().optional(),
    leadTimeDays: zod_1.z.number().int('Deve ser número inteiro').min(0).max(365).nullable().optional(),
    address: zod_1.z.object({
        street: zod_1.z.string().max(200).optional(),
        city: zod_1.z.string().max(100).optional(),
        state: zod_1.z.string().max(2).optional(),
        zip: zod_1.z.string().max(10).optional(),
    }).default({}),
});
exports.updateSupplierSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().trim().min(1).max(200).optional(),
    cnpj: zod_1.z.string().trim().refine(validators_1.isValidCNPJ, 'CNPJ inválido').optional(),
    contactName: zod_1.z.string().trim().max(100).nullable().optional(),
    phone: zod_1.z.string().trim().refine(isValidBrazilianPhone, 'Telefone inválido').optional(),
    email: zod_1.z.string().trim().email('E-mail inválido').max(200).optional(),
    paymentTerms: zod_1.z.string().trim().max(200).nullable().optional(),
    leadTimeDays: zod_1.z.number().int().min(0).max(365).nullable().optional(),
    address: zod_1.z.object({
        street: zod_1.z.string().max(200).optional(),
        city: zod_1.z.string().max(100).optional(),
        state: zod_1.z.string().max(2).optional(),
        zip: zod_1.z.string().max(10).optional(),
    }).optional(),
});
exports.listSuppliersSchema = zod_1.z.object({
    search: zod_1.z.string().max(200).optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(50),
});
/* ── Schemas: locais de armazenamento ───────────────────────────────────── */
exports.createStorageLocationSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, 'Nome obrigatório').max(100),
    type: zod_1.z.enum(exports.STORAGE_TYPES, { errorMap: () => ({ message: 'Tipo de local inválido' }) }),
    description: zod_1.z.string().trim().max(500).nullable().optional(),
    minTempC: zod_1.z.number().min(-80).max(100).nullable().optional(),
    maxTempC: zod_1.z.number().min(-80).max(100).nullable().optional(),
}).refine(d => d.minTempC == null || d.maxTempC == null || d.maxTempC >= d.minTempC, { message: 'Temperatura máxima deve ser ≥ mínima', path: ['maxTempC'] });
exports.updateStorageLocationSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().trim().min(1).max(100).optional(),
    type: zod_1.z.enum(exports.STORAGE_TYPES).optional(),
    description: zod_1.z.string().trim().max(500).nullable().optional(),
    minTempC: zod_1.z.number().min(-80).max(100).nullable().optional(),
    maxTempC: zod_1.z.number().min(-80).max(100).nullable().optional(),
});
exports.listStorageLocationsSchema = zod_1.z.object({
    refrigerationOnly: zod_1.z.boolean().optional(),
});
/* ── Schemas: produtos ──────────────────────────────────────────────────── */
exports.createProductSchema = zod_1.z.object({
    name: zod_1.z.string().trim()
        .min(3, 'Nome deve ter no mínimo 3 caracteres')
        .max(200, 'Nome muito longo'),
    sku: zod_1.z.string().trim().min(1, 'SKU obrigatório').max(50)
        .regex(/^[a-zA-Z0-9-]+$/, 'SKU deve conter apenas letras, números e hífens'),
    barcode: zod_1.z.string().trim().max(20).nullable().optional()
        .refine(v => v == null || v === '' || isValidBarcode(v), 'Código de barras inválido (use EAN-8, EAN-13 ou UPC-A)'),
    categoryId: zod_1.z.string().uuid().nullable().optional(),
    preferredSupplierId: zod_1.z.string().uuid().nullable().optional(),
    brand: zod_1.z.string().trim().max(100).nullable().optional(),
    unit: zod_1.z.enum(exports.PRODUCT_UNITS, { errorMap: () => ({ message: 'Unidade inválida' }) }),
    unitCost: zod_1.z.number().min(0, 'Custo deve ser ≥ 0').nullable().optional(),
    salePrice: zod_1.z.number().min(0, 'Preço de venda deve ser ≥ 0').nullable().optional(),
    minStock: zod_1.z.number().min(0, 'Estoque mínimo deve ser ≥ 0').default(0),
    maxStock: zod_1.z.number().min(0, 'Estoque máximo deve ser ≥ 0').nullable().optional(),
    reorderPoint: zod_1.z.number().min(0, 'Ponto de pedido deve ser ≥ 0').nullable().optional(),
    anvisaRegistration: zod_1.z.string().trim().max(30).nullable().optional()
        .refine(v => v == null || v === '' || isValidAnvisaRegistration(v), 'Formato de registro ANVISA inválido'),
    isControlled: zod_1.z.boolean().default(false),
    controlClass: zod_1.z.enum(exports.ANVISA_CONTROL_CLASSES).nullable().optional(),
    isColdChain: zod_1.z.boolean().default(false),
    defaultStorageLocationId: zod_1.z.string().uuid().nullable().optional(),
    substituteIds: zod_1.z.array(zod_1.z.string().uuid()).max(20).default([]),
    requiresPrescription: zod_1.z.boolean().default(false),
    isConsumable: zod_1.z.boolean().default(true),
    photoObjectKey: zod_1.z.string().max(500).nullable().optional(),
})
    .refine(d => !d.isControlled || d.controlClass != null, { message: 'Classe de controle ANVISA obrigatória para produto controlado', path: ['controlClass'] })
    .refine(d => d.maxStock == null || d.maxStock >= d.minStock, { message: 'Estoque máximo deve ser ≥ mínimo', path: ['maxStock'] })
    .refine(d => d.reorderPoint == null || d.reorderPoint >= d.minStock, { message: 'Ponto de pedido deve ser ≥ estoque mínimo', path: ['reorderPoint'] })
    .refine(d => d.reorderPoint == null || d.maxStock == null || d.reorderPoint <= d.maxStock, { message: 'Ponto de pedido deve ser ≤ estoque máximo', path: ['reorderPoint'] });
exports.updateProductSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().trim().min(3).max(200).optional(),
    sku: zod_1.z.string().trim().min(1).max(50)
        .regex(/^[a-zA-Z0-9-]+$/).optional(),
    barcode: zod_1.z.string().trim().max(20).nullable().optional()
        .refine(v => v == null || v === '' || isValidBarcode(v), 'Código de barras inválido'),
    categoryId: zod_1.z.string().uuid().nullable().optional(),
    preferredSupplierId: zod_1.z.string().uuid().nullable().optional(),
    brand: zod_1.z.string().trim().max(100).nullable().optional(),
    unit: zod_1.z.enum(exports.PRODUCT_UNITS).optional(),
    unitCost: zod_1.z.number().min(0).nullable().optional(),
    salePrice: zod_1.z.number().min(0).nullable().optional(),
    minStock: zod_1.z.number().min(0).optional(),
    maxStock: zod_1.z.number().min(0).nullable().optional(),
    reorderPoint: zod_1.z.number().min(0).nullable().optional(),
    anvisaRegistration: zod_1.z.string().trim().max(30).nullable().optional(),
    isControlled: zod_1.z.boolean().optional(),
    controlClass: zod_1.z.enum(exports.ANVISA_CONTROL_CLASSES).nullable().optional(),
    isColdChain: zod_1.z.boolean().optional(),
    defaultStorageLocationId: zod_1.z.string().uuid().nullable().optional(),
    substituteIds: zod_1.z.array(zod_1.z.string().uuid()).max(20).optional(),
    requiresPrescription: zod_1.z.boolean().optional(),
    isConsumable: zod_1.z.boolean().optional(),
    photoObjectKey: zod_1.z.string().max(500).nullable().optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.listProductsSchema = zod_1.z.object({
    search: zod_1.z.string().max(200).optional(),
    categoryId: zod_1.z.string().uuid().optional(),
    isActive: zod_1.z.boolean().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(50),
});
exports.checkSkuSchema = zod_1.z.object({
    sku: zod_1.z.string().min(1).max(50),
    excludeId: zod_1.z.string().uuid().optional(),
});
/* ── Schemas: posição de estoque ────────────────────────────────────────── */
exports.listStockPositionSchema = zod_1.z.object({
    search: zod_1.z.string().max(200).optional(),
    categoryId: zod_1.z.string().uuid().optional(),
    statuses: zod_1.z.array(zod_1.z.enum(exports.STOCK_STATUSES)).optional(),
    storageLocationId: zod_1.z.string().uuid().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(200).default(50),
});
/* ── Schemas: ajuste de estoque ─────────────────────────────────────────── */
exports.adjustStockSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid(),
    // Para 'contagem': nova contagem total absoluta (> 0)
    // Para 'perda': quantidade perdida (> 0)
    // Para 'correcao': delta (positivo ou negativo, não zero)
    quantity: zod_1.z.number().refine(v => v !== 0, 'Quantidade não pode ser zero'),
    reason: zod_1.z.enum(exports.ADJUSTMENT_REASONS),
    notes: zod_1.z.string().trim().max(500).optional(),
});
exports.listProductLotsSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid(),
});
exports.listProductMovementsSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
/* ══════════════════════════════════════════════════════════════════════════
 * PROMPT 12 — Lotes, movimentações, FEFO, alertas
 * ══════════════════════════════════════════════════════════════════════════ */
/* ── Constantes de domínio (12) ─────────────────────────────────────────── */
exports.EXPIRY_WARNING_DAYS = 60;
exports.EXPIRY_CRITICAL_DAYS = 30;
exports.MIN_JUSTIFICATION_LENGTH = 10;
exports.MAX_JUSTIFICATION_LENGTH = 500;
exports.MIN_LOT_NUMBER_LENGTH = 1;
exports.MAX_LOT_NUMBER_LENGTH = 80;
exports.LOT_STATUSES = ['active', 'consumed', 'quarantined', 'expired'];
exports.LOT_STATUS_LABELS = {
    active: 'Ativo',
    consumed: 'Consumido',
    quarantined: 'Em quarentena',
    expired: 'Vencido',
};
exports.EXPIRY_ALERT_LEVELS = ['none', 'warning', 'critical'];
exports.EXPIRY_ALERT_LEVEL_LABELS = {
    none: 'OK',
    warning: `< ${exports.EXPIRY_WARNING_DAYS}d`,
    critical: `< ${exports.EXPIRY_CRITICAL_DAYS}d`,
};
exports.MOVEMENT_TYPES = [
    'entrada', 'saida', 'ajuste', 'perda', 'vencimento', 'transferencia', 'uso_paciente',
];
exports.MOVEMENT_TYPE_LABELS = {
    entrada: 'Entrada',
    saida: 'Saída',
    ajuste: 'Ajuste',
    perda: 'Perda',
    vencimento: 'Vencimento',
    transferencia: 'Transferência',
    uso_paciente: 'Uso em paciente',
};
exports.MOVEMENT_REASONS = [
    'procedimento',
    'venda',
    'perda',
    'descarte_vencido',
    'contagem',
    'correcao',
    'recebimento',
    'transferencia_entrada',
    'transferencia_saida',
    'inventario_inicial',
    'outro',
];
exports.MOVEMENT_REASON_LABELS = {
    procedimento: 'Procedimento',
    venda: 'Venda',
    perda: 'Perda / Extravio',
    descarte_vencido: 'Descarte por vencimento',
    contagem: 'Contagem de inventário',
    correcao: 'Correção manual',
    recebimento: 'Recebimento de compra',
    transferencia_entrada: 'Transferência (entrada)',
    transferencia_saida: 'Transferência (saída)',
    inventario_inicial: 'Inventário inicial',
    outro: 'Outro',
};
// Reasons permitidas por tipo — espelha a constraint chk_movement_reason_by_type
exports.SAIDA_REASONS = ['procedimento', 'venda', 'perda', 'descarte_vencido', 'outro'];
exports.AJUSTE_REASONS = ['contagem', 'correcao', 'outro'];
exports.ENTRADA_REASONS = ['recebimento', 'transferencia_entrada', 'inventario_inicial', 'outro'];
exports.ALERT_TYPES = ['lot_expiring', 'low_stock', 'critical_stock', 'rupture'];
exports.ALERT_TYPE_LABELS = {
    lot_expiring: 'Lote vencendo',
    low_stock: 'Estoque baixo',
    critical_stock: 'Estoque crítico',
    rupture: 'Ruptura',
};
/* ── Helpers Zod ─────────────────────────────────────────────────────────── */
const justificationSchema = zod_1.z
    .string()
    .trim()
    .min(exports.MIN_JUSTIFICATION_LENGTH, `Justificativa deve ter no mínimo ${exports.MIN_JUSTIFICATION_LENGTH} caracteres`)
    .max(exports.MAX_JUSTIFICATION_LENGTH, `Justificativa deve ter no máximo ${exports.MAX_JUSTIFICATION_LENGTH} caracteres`);
const lotNumberSchema = zod_1.z
    .string()
    .trim()
    .min(exports.MIN_LOT_NUMBER_LENGTH, 'Número de lote obrigatório')
    .max(exports.MAX_LOT_NUMBER_LENGTH, 'Número de lote muito longo');
// Data futura: aceita date-string ISO (YYYY-MM-DD). A comparação é feita no
// timezone local do servidor; se precisar granularidade fina, a API deve
// converter para o timezone da clínica antes de validar.
const futureDateSchema = zod_1.z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .refine((s) => {
    const d = new Date(`${s}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return !Number.isNaN(d.getTime()) && d >= today;
}, { message: 'Data de validade não pode estar no passado (use accept_expired para aceitar lote vencido)' });
const anyDateSchema = zod_1.z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD');
/* ── Movimentações: schemas por tipo ─────────────────────────────────────── */
//
// Observação: cada tipo tem um schema BASE (z.object puro) e um schema
// VALIDADO (com superRefine). z.discriminatedUnion exige bases puras nos
// branches; a validação cross-field é aplicada no superRefine da união.
const entryMovementBase = zod_1.z.object({
    type: zod_1.z.literal('entrada'),
    productId: zod_1.z.string().uuid(),
    lotNumber: lotNumberSchema,
    batchNumber: zod_1.z.string().trim().max(80).nullable().optional(),
    expiryDate: futureDateSchema.nullable().optional(),
    manufacturedDate: anyDateSchema.nullable().optional(),
    quantity: zod_1.z.number().positive('Quantidade deve ser > 0'),
    unitCost: zod_1.z.number().min(0, 'Custo deve ser ≥ 0'),
    supplierId: zod_1.z.string().uuid().nullable().optional(),
    storageLocationId: zod_1.z.string().uuid().nullable().optional(),
    purchaseOrderItemId: zod_1.z.string().uuid().nullable().optional(),
    reason: zod_1.z.enum(exports.ENTRADA_REASONS).default('recebimento'),
    notes: zod_1.z.string().trim().max(exports.MAX_JUSTIFICATION_LENGTH).nullable().optional(),
    acceptExpired: zod_1.z.boolean().default(false),
    acceptExpiredReason: zod_1.z.string().trim().max(exports.MAX_JUSTIFICATION_LENGTH).nullable().optional(),
});
const exitMovementBase = zod_1.z.object({
    type: zod_1.z.literal('saida'),
    productId: zod_1.z.string().uuid(),
    lotId: zod_1.z.string().uuid('Selecione um lote específico').nullable().optional(),
    quantity: zod_1.z.number().positive('Quantidade deve ser > 0'),
    reason: zod_1.z.enum(exports.SAIDA_REASONS),
    justification: justificationSchema.optional(),
    encounterId: zod_1.z.string().uuid().nullable().optional(),
    invoiceId: zod_1.z.string().uuid().nullable().optional(),
    notes: zod_1.z.string().trim().max(exports.MAX_JUSTIFICATION_LENGTH).nullable().optional(),
});
const adjustMovementBase = zod_1.z.object({
    type: zod_1.z.literal('ajuste'),
    productId: zod_1.z.string().uuid(),
    lotId: zod_1.z.string().uuid().nullable().optional(),
    // Delta em unidades: positivo adiciona, negativo remove. Zero é inválido.
    delta: zod_1.z.number().refine((v) => v !== 0, 'Delta não pode ser zero'),
    reason: zod_1.z.enum(exports.AJUSTE_REASONS),
    justification: justificationSchema,
    notes: zod_1.z.string().trim().max(exports.MAX_JUSTIFICATION_LENGTH).nullable().optional(),
});
const transferMovementBase = zod_1.z.object({
    type: zod_1.z.literal('transferencia'),
    productId: zod_1.z.string().uuid(),
    lotId: zod_1.z.string().uuid('Transferência exige lote específico'),
    quantity: zod_1.z.number().positive('Quantidade deve ser > 0'),
    fromStorageLocationId: zod_1.z.string().uuid(),
    toStorageLocationId: zod_1.z.string().uuid(),
    notes: zod_1.z.string().trim().max(exports.MAX_JUSTIFICATION_LENGTH).nullable().optional(),
});
function refineEntry(d, ctx) {
    if (d.acceptExpired) {
        if (!d.expiryDate) {
            ctx.addIssue({ code: 'custom', path: ['expiryDate'],
                message: 'Validade obrigatória quando acceptExpired=true' });
        }
        if (!d.acceptExpiredReason || d.acceptExpiredReason.trim().length < exports.MIN_JUSTIFICATION_LENGTH) {
            ctx.addIssue({ code: 'custom', path: ['acceptExpiredReason'],
                message: `Justificativa obrigatória ao aceitar lote vencido (min ${exports.MIN_JUSTIFICATION_LENGTH} caracteres)` });
        }
    }
    if (d.manufacturedDate && d.expiryDate && d.manufacturedDate > d.expiryDate) {
        ctx.addIssue({ code: 'custom', path: ['manufacturedDate'],
            message: 'Data de fabricação não pode ser posterior à validade' });
    }
}
function refineExit(d, ctx) {
    if ((d.reason === 'perda' || d.reason === 'descarte_vencido') && !d.justification) {
        ctx.addIssue({ code: 'custom', path: ['justification'],
            message: `Justificativa obrigatória para ${exports.MOVEMENT_REASON_LABELS[d.reason]}` });
    }
    if (d.reason === 'procedimento' && !d.encounterId) {
        ctx.addIssue({ code: 'custom', path: ['encounterId'],
            message: 'Saída por procedimento exige encounterId' });
    }
    if (d.reason === 'venda' && !d.invoiceId) {
        ctx.addIssue({ code: 'custom', path: ['invoiceId'],
            message: 'Saída por venda exige invoiceId' });
    }
}
function refineTransfer(d, ctx) {
    if (d.fromStorageLocationId === d.toStorageLocationId) {
        ctx.addIssue({ code: 'custom', path: ['toStorageLocationId'],
            message: 'Local de origem deve ser diferente do destino' });
    }
}
// Schemas individuais (uso direto em testes/validação isolada)
exports.entryMovementSchema = entryMovementBase.superRefine(refineEntry);
exports.exitMovementSchema = exitMovementBase.superRefine(refineExit);
exports.adjustMovementSchema = adjustMovementBase;
exports.transferMovementSchema = transferMovementBase.superRefine(refineTransfer);
// Discriminated union (entrada única do router) + cross-field refinement
exports.registerMovementSchema = zod_1.z
    .discriminatedUnion('type', [
    entryMovementBase,
    exitMovementBase,
    adjustMovementBase,
    transferMovementBase,
])
    .superRefine((d, ctx) => {
    switch (d.type) {
        case 'entrada':
            refineEntry(d, ctx);
            return;
        case 'saida':
            refineExit(d, ctx);
            return;
        case 'transferencia':
            refineTransfer(d, ctx);
            return;
        case 'ajuste': return; // já coberto pelo base (delta != 0 e justification obrigatória)
    }
});
/* ── Lotes: listagem global e mudança de status ──────────────────────────── */
exports.listLotsSchema = zod_1.z.object({
    search: zod_1.z.string().max(200).optional(),
    productId: zod_1.z.string().uuid().optional(),
    categoryId: zod_1.z.string().uuid().optional(),
    storageLocationId: zod_1.z.string().uuid().optional(),
    statuses: zod_1.z.array(zod_1.z.enum(exports.LOT_STATUSES)).optional(),
    alertLevel: zod_1.z.enum(exports.EXPIRY_ALERT_LEVELS).optional(),
    includeConsumed: zod_1.z.boolean().default(false),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(50),
});
exports.changeLotStatusSchema = zod_1.z.object({
    lotId: zod_1.z.string().uuid(),
    status: zod_1.z.enum(exports.LOT_STATUSES),
    justification: justificationSchema,
});
exports.quarantineLotSchema = zod_1.z.object({
    lotId: zod_1.z.string().uuid(),
    reason: justificationSchema,
});
/* ── FEFO: sugestão de lotes para saída ──────────────────────────────────── */
exports.fefoSuggestionSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid(),
    quantity: zod_1.z.number().positive('Quantidade deve ser > 0'),
});
/* ── Alertas: listagem e eventos ─────────────────────────────────────────── */
exports.listAlertsSchema = zod_1.z.object({
    alertType: zod_1.z.enum(exports.ALERT_TYPES).optional(),
    since: zod_1.z.string().datetime().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(200).default(50),
});
/* ── Chave de idempotência do worker ─────────────────────────────────────── */
/**
 * Monta a chave de idempotência para alert_emissions_log.
 * Formato: `{alert_type}:{entity_id}:{YYYY-MM-DD}` no timezone da clínica.
 * Um alerta por tipo/entidade/dia.
 */
function buildAlertEmissionKey(alertType, entityId, dateYmd) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
        throw new Error('buildAlertEmissionKey: dateYmd deve estar em YYYY-MM-DD');
    }
    return `${alertType}:${entityId}:${dateYmd}`;
}
//# sourceMappingURL=supply.schema.js.map