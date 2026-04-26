import { z } from 'zod';
import { isValidCNPJ } from '../utils/validators';

/* ── Constantes de domínio ────────────────────────────────────────────────── */

export const PRODUCT_UNITS = [
  'unidade', 'ml', 'mg', 'mcg', 'ampola', 'frasco',
  'caixa', 'par', 'kit', 'pacote', 'rolo', 'litro', 'grama',
] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const ANVISA_CONTROL_CLASSES = [
  'A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'C2', 'C3', 'C4', 'C5',
  'D1', 'D2', 'E', 'F1', 'F2', 'F3',
] as const;
export type AnvisaControlClass = (typeof ANVISA_CONTROL_CLASSES)[number];

export const STORAGE_TYPES = [
  'geladeira', 'freezer', 'temperatura_ambiente', 'controlado', 'descartavel',
] as const;
export type StorageType = (typeof STORAGE_TYPES)[number];

export const REFRIGERATED_STORAGE_TYPES: ReadonlyArray<StorageType> = ['geladeira', 'freezer'];

export const STORAGE_TYPE_LABELS: Record<StorageType, string> = {
  geladeira:            'Geladeira (2°C – 8°C)',
  freezer:              'Freezer (≤ −18°C)',
  temperatura_ambiente: 'Temperatura Ambiente',
  controlado:           'Armário Controlado',
  descartavel:          'Área de Descartáveis',
};

export const STOCK_STATUSES = [
  'OK', 'ATENCAO', 'CRITICO', 'RUPTURA', 'VENCIMENTO_PROXIMO',
] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  OK:                 'OK',
  ATENCAO:            'Atenção',
  CRITICO:            'Crítico',
  RUPTURA:            'Ruptura',
  VENCIMENTO_PROXIMO: 'Venc. Próximo',
};

export const ADJUSTMENT_REASONS = ['contagem', 'perda', 'correcao'] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  contagem: 'Contagem de inventário',
  perda:    'Perda / Extravio',
  correcao: 'Correção manual',
};

/* ── Validadores ──────────────────────────────────────────────────────────── */

function validateBarcodeCheckDigit(digits: string): boolean {
  if (![8, 12, 13].includes(digits.length)) return false;
  const nums = digits.split('').map(Number);
  const checkDigit = nums[nums.length - 1]!;
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

export function isValidBarcode(code: string): boolean {
  return validateBarcodeCheckDigit(code.replace(/\D/g, ''));
}

export function isValidBrazilianPhone(phone: string): boolean {
  const d = phone.replace(/\D/g, '');
  // DDD (2 dígitos) + número (8 ou 9 dígitos) = 10 ou 11 dígitos
  if (d.length !== 10 && d.length !== 11) return false;
  // DDD deve iniciar com dígito 1-9
  return /^[1-9]/.test(d);
}

export function isValidAnvisaRegistration(reg: string): boolean {
  const normalized = reg.replace(/[\s.\-/]/g, '');
  return /^\d{5,15}$/.test(normalized);
}

/* ── Schemas: categorias ─────────────────────────────────────────────────── */

export const createCategorySchema = z.object({
  name:        z.string().trim().min(1, 'Nome obrigatório').max(100, 'Nome muito longo'),
  parentId:    z.string().uuid('ID de categoria pai inválido').nullable().optional(),
  description: z.string().trim().max(500, 'Descrição muito longa').nullable().optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  id:          z.string().uuid(),
  name:        z.string().trim().min(1).max(100).optional(),
  parentId:    z.string().uuid().nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const listCategoriesSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
});
export type ListCategoriesInput = z.infer<typeof listCategoriesSchema>;

/* ── Schemas: fornecedores ───────────────────────────────────────────────── */

export const createSupplierSchema = z.object({
  name:         z.string().trim().min(1, 'Razão social obrigatória').max(200),
  cnpj:         z.string().trim().refine(isValidCNPJ, 'CNPJ inválido — verifique os dígitos verificadores'),
  contactName:  z.string().trim().max(100).nullable().optional(),
  phone:        z.string().trim().refine(isValidBrazilianPhone, 'Formato de telefone inválido (ex: (11) 98765-4321)'),
  email:        z.string().trim().email('E-mail inválido').max(200),
  paymentTerms: z.string().trim().max(200).nullable().optional(),
  leadTimeDays: z.number().int('Deve ser número inteiro').min(0).max(365).nullable().optional(),
  address: z.object({
    street: z.string().max(200).optional(),
    city:   z.string().max(100).optional(),
    state:  z.string().max(2).optional(),
    zip:    z.string().max(10).optional(),
  }).default({}),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = z.object({
  id:           z.string().uuid(),
  name:         z.string().trim().min(1).max(200).optional(),
  cnpj:         z.string().trim().refine(isValidCNPJ, 'CNPJ inválido').optional(),
  contactName:  z.string().trim().max(100).nullable().optional(),
  phone:        z.string().trim().refine(isValidBrazilianPhone, 'Telefone inválido').optional(),
  email:        z.string().trim().email('E-mail inválido').max(200).optional(),
  paymentTerms: z.string().trim().max(200).nullable().optional(),
  leadTimeDays: z.number().int().min(0).max(365).nullable().optional(),
  address: z.object({
    street: z.string().max(200).optional(),
    city:   z.string().max(100).optional(),
    state:  z.string().max(2).optional(),
    zip:    z.string().max(10).optional(),
  }).optional(),
});
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const listSuppliersSchema = z.object({
  search: z.string().max(200).optional(),
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().positive().max(100).default(50),
});
export type ListSuppliersInput = z.infer<typeof listSuppliersSchema>;

/* ── Schemas: locais de armazenamento ───────────────────────────────────── */

export const createStorageLocationSchema = z.object({
  name:        z.string().trim().min(1, 'Nome obrigatório').max(100),
  type:        z.enum(STORAGE_TYPES, { errorMap: () => ({ message: 'Tipo de local inválido' }) }),
  description: z.string().trim().max(500).nullable().optional(),
  minTempC:    z.number().min(-80).max(100).nullable().optional(),
  maxTempC:    z.number().min(-80).max(100).nullable().optional(),
}).refine(
  d => d.minTempC == null || d.maxTempC == null || d.maxTempC >= d.minTempC,
  { message: 'Temperatura máxima deve ser ≥ mínima', path: ['maxTempC'] },
);
export type CreateStorageLocationInput = z.infer<typeof createStorageLocationSchema>;

export const updateStorageLocationSchema = z.object({
  id:          z.string().uuid(),
  name:        z.string().trim().min(1).max(100).optional(),
  type:        z.enum(STORAGE_TYPES).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  minTempC:    z.number().min(-80).max(100).nullable().optional(),
  maxTempC:    z.number().min(-80).max(100).nullable().optional(),
});
export type UpdateStorageLocationInput = z.infer<typeof updateStorageLocationSchema>;

export const listStorageLocationsSchema = z.object({
  refrigerationOnly: z.boolean().optional(),
});
export type ListStorageLocationsInput = z.infer<typeof listStorageLocationsSchema>;

/* ── Schemas: produtos ──────────────────────────────────────────────────── */

export const createProductSchema = z.object({
  name:                     z.string().trim()
                              .min(3, 'Nome deve ter no mínimo 3 caracteres')
                              .max(200, 'Nome muito longo'),
  sku:                      z.string().trim().min(1, 'SKU obrigatório').max(50)
                              .regex(/^[a-zA-Z0-9-]+$/, 'SKU deve conter apenas letras, números e hífens'),
  barcode:                  z.string().trim().max(20).nullable().optional()
                              .refine(v => v == null || v === '' || isValidBarcode(v),
                                'Código de barras inválido (use EAN-8, EAN-13 ou UPC-A)'),
  categoryId:               z.string().uuid().nullable().optional(),
  preferredSupplierId:      z.string().uuid().nullable().optional(),
  brand:                    z.string().trim().max(100).nullable().optional(),
  unit:                     z.enum(PRODUCT_UNITS, { errorMap: () => ({ message: 'Unidade inválida' }) }),
  unitCost:                 z.number().min(0, 'Custo deve ser ≥ 0').nullable().optional(),
  salePrice:                z.number().min(0, 'Preço de venda deve ser ≥ 0').nullable().optional(),
  minStock:                 z.number().min(0, 'Estoque mínimo deve ser ≥ 0').default(0),
  maxStock:                 z.number().min(0, 'Estoque máximo deve ser ≥ 0').nullable().optional(),
  reorderPoint:             z.number().min(0, 'Ponto de pedido deve ser ≥ 0').nullable().optional(),
  anvisaRegistration:       z.string().trim().max(30).nullable().optional()
                              .refine(v => v == null || v === '' || isValidAnvisaRegistration(v),
                                'Formato de registro ANVISA inválido'),
  isControlled:             z.boolean().default(false),
  controlClass:             z.enum(ANVISA_CONTROL_CLASSES).nullable().optional(),
  isColdChain:              z.boolean().default(false),
  defaultStorageLocationId: z.string().uuid().nullable().optional(),
  substituteIds:            z.array(z.string().uuid()).max(20).default([]),
  requiresPrescription:     z.boolean().default(false),
  isConsumable:             z.boolean().default(true),
  photoObjectKey:           z.string().max(500).nullable().optional(),
})
.refine(
  d => !d.isControlled || d.controlClass != null,
  { message: 'Classe de controle ANVISA obrigatória para produto controlado', path: ['controlClass'] },
)
.refine(
  d => d.maxStock == null || d.maxStock >= d.minStock,
  { message: 'Estoque máximo deve ser ≥ mínimo', path: ['maxStock'] },
)
.refine(
  d => d.reorderPoint == null || d.reorderPoint >= d.minStock,
  { message: 'Ponto de pedido deve ser ≥ estoque mínimo', path: ['reorderPoint'] },
)
.refine(
  d => d.reorderPoint == null || d.maxStock == null || d.reorderPoint <= d.maxStock,
  { message: 'Ponto de pedido deve ser ≤ estoque máximo', path: ['reorderPoint'] },
);
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  id:                       z.string().uuid(),
  name:                     z.string().trim().min(3).max(200).optional(),
  sku:                      z.string().trim().min(1).max(50)
                              .regex(/^[a-zA-Z0-9-]+$/).optional(),
  barcode:                  z.string().trim().max(20).nullable().optional()
                              .refine(v => v == null || v === '' || isValidBarcode(v),
                                'Código de barras inválido'),
  categoryId:               z.string().uuid().nullable().optional(),
  preferredSupplierId:      z.string().uuid().nullable().optional(),
  brand:                    z.string().trim().max(100).nullable().optional(),
  unit:                     z.enum(PRODUCT_UNITS).optional(),
  unitCost:                 z.number().min(0).nullable().optional(),
  salePrice:                z.number().min(0).nullable().optional(),
  minStock:                 z.number().min(0).optional(),
  maxStock:                 z.number().min(0).nullable().optional(),
  reorderPoint:             z.number().min(0).nullable().optional(),
  anvisaRegistration:       z.string().trim().max(30).nullable().optional(),
  isControlled:             z.boolean().optional(),
  controlClass:             z.enum(ANVISA_CONTROL_CLASSES).nullable().optional(),
  isColdChain:              z.boolean().optional(),
  defaultStorageLocationId: z.string().uuid().nullable().optional(),
  substituteIds:            z.array(z.string().uuid()).max(20).optional(),
  requiresPrescription:     z.boolean().optional(),
  isConsumable:             z.boolean().optional(),
  photoObjectKey:           z.string().max(500).nullable().optional(),
  isActive:                 z.boolean().optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const listProductsSchema = z.object({
  search:     z.string().max(200).optional(),
  categoryId: z.string().uuid().optional(),
  isActive:   z.boolean().optional(),
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().positive().max(100).default(50),
});
export type ListProductsInput = z.infer<typeof listProductsSchema>;

export const checkSkuSchema = z.object({
  sku:       z.string().min(1).max(50),
  excludeId: z.string().uuid().optional(),
});
export type CheckSkuInput = z.infer<typeof checkSkuSchema>;

/* ── Schemas: posição de estoque ────────────────────────────────────────── */

export const listStockPositionSchema = z.object({
  search:            z.string().max(200).optional(),
  categoryId:        z.string().uuid().optional(),
  statuses:          z.array(z.enum(STOCK_STATUSES)).optional(),
  storageLocationId: z.string().uuid().optional(),
  page:              z.coerce.number().int().positive().default(1),
  limit:             z.coerce.number().int().positive().max(200).default(50),
});
export type ListStockPositionInput = z.infer<typeof listStockPositionSchema>;

/* ── Schemas: ajuste de estoque ─────────────────────────────────────────── */

export const adjustStockSchema = z.object({
  productId: z.string().uuid(),
  // Para 'contagem': nova contagem total absoluta (> 0)
  // Para 'perda': quantidade perdida (> 0)
  // Para 'correcao': delta (positivo ou negativo, não zero)
  quantity:  z.number().refine(v => v !== 0, 'Quantidade não pode ser zero'),
  reason:    z.enum(ADJUSTMENT_REASONS),
  notes:     z.string().trim().max(500).optional(),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const listProductLotsSchema = z.object({
  productId: z.string().uuid(),
});
export type ListProductLotsInput = z.infer<typeof listProductLotsSchema>;

export const listProductMovementsSchema = z.object({
  productId: z.string().uuid(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().positive().max(100).default(20),
});
export type ListProductMovementsInput = z.infer<typeof listProductMovementsSchema>;

/* ══════════════════════════════════════════════════════════════════════════
 * PROMPT 12 — Lotes, movimentações, FEFO, alertas
 * ══════════════════════════════════════════════════════════════════════════ */

/* ── Constantes de domínio (12) ─────────────────────────────────────────── */

export const EXPIRY_WARNING_DAYS       = 60 as const;
export const EXPIRY_CRITICAL_DAYS      = 30 as const;
export const MIN_JUSTIFICATION_LENGTH  = 10 as const;
export const MAX_JUSTIFICATION_LENGTH  = 500 as const;
export const MIN_LOT_NUMBER_LENGTH     = 1  as const;
export const MAX_LOT_NUMBER_LENGTH     = 80 as const;

export const LOT_STATUSES = ['active', 'consumed', 'quarantined', 'expired'] as const;
export type LotStatus = (typeof LOT_STATUSES)[number];

export const LOT_STATUS_LABELS: Record<LotStatus, string> = {
  active:      'Ativo',
  consumed:    'Consumido',
  quarantined: 'Em quarentena',
  expired:     'Vencido',
};

export const EXPIRY_ALERT_LEVELS = ['none', 'warning', 'critical'] as const;
export type ExpiryAlertLevel = (typeof EXPIRY_ALERT_LEVELS)[number];

export const EXPIRY_ALERT_LEVEL_LABELS: Record<ExpiryAlertLevel, string> = {
  none:     'OK',
  warning:  `< ${EXPIRY_WARNING_DAYS}d`,
  critical: `< ${EXPIRY_CRITICAL_DAYS}d`,
};

export const MOVEMENT_TYPES = [
  'entrada', 'saida', 'ajuste', 'perda', 'vencimento', 'transferencia', 'uso_paciente',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  entrada:       'Entrada',
  saida:         'Saída',
  ajuste:        'Ajuste',
  perda:         'Perda',
  vencimento:    'Vencimento',
  transferencia: 'Transferência',
  uso_paciente:  'Uso em paciente',
};

export const MOVEMENT_REASONS = [
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
] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];

export const MOVEMENT_REASON_LABELS: Record<MovementReason, string> = {
  procedimento:            'Procedimento',
  venda:                   'Venda',
  perda:                   'Perda / Extravio',
  descarte_vencido:        'Descarte por vencimento',
  contagem:                'Contagem de inventário',
  correcao:                'Correção manual',
  recebimento:             'Recebimento de compra',
  transferencia_entrada:   'Transferência (entrada)',
  transferencia_saida:     'Transferência (saída)',
  inventario_inicial:      'Inventário inicial',
  outro:                   'Outro',
};

// Reasons permitidas por tipo — espelha a constraint chk_movement_reason_by_type
export const SAIDA_REASONS:    ReadonlyArray<MovementReason> = ['procedimento','venda','perda','descarte_vencido','outro'];
export const AJUSTE_REASONS:   ReadonlyArray<MovementReason> = ['contagem','correcao','outro'];
export const ENTRADA_REASONS:  ReadonlyArray<MovementReason> = ['recebimento','transferencia_entrada','inventario_inicial','outro'];

export const ALERT_TYPES = ['lot_expiring', 'low_stock', 'critical_stock', 'rupture'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  lot_expiring:   'Lote vencendo',
  low_stock:      'Estoque baixo',
  critical_stock: 'Estoque crítico',
  rupture:        'Ruptura',
};

/* ── Helpers Zod ─────────────────────────────────────────────────────────── */

const justificationSchema = z
  .string()
  .trim()
  .min(MIN_JUSTIFICATION_LENGTH, `Justificativa deve ter no mínimo ${MIN_JUSTIFICATION_LENGTH} caracteres`)
  .max(MAX_JUSTIFICATION_LENGTH, `Justificativa deve ter no máximo ${MAX_JUSTIFICATION_LENGTH} caracteres`);

const lotNumberSchema = z
  .string()
  .trim()
  .min(MIN_LOT_NUMBER_LENGTH, 'Número de lote obrigatório')
  .max(MAX_LOT_NUMBER_LENGTH, 'Número de lote muito longo');

// Data futura: aceita date-string ISO (YYYY-MM-DD). A comparação é feita no
// timezone local do servidor; se precisar granularidade fina, a API deve
// converter para o timezone da clínica antes de validar.
const futureDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
  .refine(
    (s) => {
      const d = new Date(`${s}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return !Number.isNaN(d.getTime()) && d >= today;
    },
    { message: 'Data de validade não pode estar no passado (use accept_expired para aceitar lote vencido)' },
  );

const anyDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD');

/* ── Movimentações: schemas por tipo ─────────────────────────────────────── */
//
// Observação: cada tipo tem um schema BASE (z.object puro) e um schema
// VALIDADO (com superRefine). z.discriminatedUnion exige bases puras nos
// branches; a validação cross-field é aplicada no superRefine da união.

const entryMovementBase = z.object({
  type:                 z.literal('entrada'),
  productId:            z.string().uuid(),
  lotNumber:            lotNumberSchema,
  batchNumber:          z.string().trim().max(80).nullable().optional(),
  expiryDate:           futureDateSchema.nullable().optional(),
  manufacturedDate:     anyDateSchema.nullable().optional(),
  quantity:             z.number().positive('Quantidade deve ser > 0'),
  unitCost:             z.number().min(0, 'Custo deve ser ≥ 0'),
  supplierId:           z.string().uuid().nullable().optional(),
  storageLocationId:    z.string().uuid().nullable().optional(),
  purchaseOrderItemId:  z.string().uuid().nullable().optional(),
  reason:               z.enum(ENTRADA_REASONS as unknown as [MovementReason, ...MovementReason[]]).default('recebimento'),
  notes:                z.string().trim().max(MAX_JUSTIFICATION_LENGTH).nullable().optional(),
  acceptExpired:        z.boolean().default(false),
  acceptExpiredReason:  z.string().trim().max(MAX_JUSTIFICATION_LENGTH).nullable().optional(),
});

const exitMovementBase = z.object({
  type:           z.literal('saida'),
  productId:      z.string().uuid(),
  lotId:          z.string().uuid('Selecione um lote específico').nullable().optional(),
  quantity:       z.number().positive('Quantidade deve ser > 0'),
  reason:         z.enum(SAIDA_REASONS as unknown as [MovementReason, ...MovementReason[]]),
  justification:  justificationSchema.optional(),
  encounterId:    z.string().uuid().nullable().optional(),
  invoiceId:      z.string().uuid().nullable().optional(),
  notes:          z.string().trim().max(MAX_JUSTIFICATION_LENGTH).nullable().optional(),
});

const adjustMovementBase = z.object({
  type:           z.literal('ajuste'),
  productId:      z.string().uuid(),
  lotId:          z.string().uuid().nullable().optional(),
  // Delta em unidades: positivo adiciona, negativo remove. Zero é inválido.
  delta:          z.number().refine((v) => v !== 0, 'Delta não pode ser zero'),
  reason:         z.enum(AJUSTE_REASONS as unknown as [MovementReason, ...MovementReason[]]),
  justification:  justificationSchema,
  notes:          z.string().trim().max(MAX_JUSTIFICATION_LENGTH).nullable().optional(),
});

const transferMovementBase = z.object({
  type:                 z.literal('transferencia'),
  productId:            z.string().uuid(),
  lotId:                z.string().uuid('Transferência exige lote específico'),
  quantity:             z.number().positive('Quantidade deve ser > 0'),
  fromStorageLocationId: z.string().uuid(),
  toStorageLocationId:   z.string().uuid(),
  notes:                z.string().trim().max(MAX_JUSTIFICATION_LENGTH).nullable().optional(),
});

type EntryBase    = z.infer<typeof entryMovementBase>;
type ExitBase     = z.infer<typeof exitMovementBase>;
type TransferBase = z.infer<typeof transferMovementBase>;

function refineEntry(d: EntryBase, ctx: z.RefinementCtx): void {
  if (d.acceptExpired) {
    if (!d.expiryDate) {
      ctx.addIssue({ code: 'custom', path: ['expiryDate'],
        message: 'Validade obrigatória quando acceptExpired=true' });
    }
    if (!d.acceptExpiredReason || d.acceptExpiredReason.trim().length < MIN_JUSTIFICATION_LENGTH) {
      ctx.addIssue({ code: 'custom', path: ['acceptExpiredReason'],
        message: `Justificativa obrigatória ao aceitar lote vencido (min ${MIN_JUSTIFICATION_LENGTH} caracteres)` });
    }
  }
  if (d.manufacturedDate && d.expiryDate && d.manufacturedDate > d.expiryDate) {
    ctx.addIssue({ code: 'custom', path: ['manufacturedDate'],
      message: 'Data de fabricação não pode ser posterior à validade' });
  }
}

function refineExit(d: ExitBase, ctx: z.RefinementCtx): void {
  if ((d.reason === 'perda' || d.reason === 'descarte_vencido') && !d.justification) {
    ctx.addIssue({ code: 'custom', path: ['justification'],
      message: `Justificativa obrigatória para ${MOVEMENT_REASON_LABELS[d.reason]}` });
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

function refineTransfer(d: TransferBase, ctx: z.RefinementCtx): void {
  if (d.fromStorageLocationId === d.toStorageLocationId) {
    ctx.addIssue({ code: 'custom', path: ['toStorageLocationId'],
      message: 'Local de origem deve ser diferente do destino' });
  }
}

// Schemas individuais (uso direto em testes/validação isolada)
export const entryMovementSchema    = entryMovementBase.superRefine(refineEntry);
export const exitMovementSchema     = exitMovementBase.superRefine(refineExit);
export const adjustMovementSchema   = adjustMovementBase;
export const transferMovementSchema = transferMovementBase.superRefine(refineTransfer);

export type EntryMovementInput    = z.infer<typeof entryMovementSchema>;
export type ExitMovementInput     = z.infer<typeof exitMovementSchema>;
export type AdjustMovementInput   = z.infer<typeof adjustMovementSchema>;
export type TransferMovementInput = z.infer<typeof transferMovementSchema>;

// Discriminated union (entrada única do router) + cross-field refinement
export const registerMovementSchema = z
  .discriminatedUnion('type', [
    entryMovementBase,
    exitMovementBase,
    adjustMovementBase,
    transferMovementBase,
  ])
  .superRefine((d, ctx) => {
    switch (d.type) {
      case 'entrada':       refineEntry(d, ctx);    return;
      case 'saida':         refineExit(d, ctx);     return;
      case 'transferencia': refineTransfer(d, ctx); return;
      case 'ajuste':        return; // já coberto pelo base (delta != 0 e justification obrigatória)
    }
  });
export type RegisterMovementInput = z.infer<typeof registerMovementSchema>;

/* ── Lotes: listagem global e mudança de status ──────────────────────────── */

export const listLotsSchema = z.object({
  search:            z.string().max(200).optional(),
  productId:         z.string().uuid().optional(),
  categoryId:        z.string().uuid().optional(),
  storageLocationId: z.string().uuid().optional(),
  statuses:          z.array(z.enum(LOT_STATUSES)).optional(),
  alertLevel:        z.enum(EXPIRY_ALERT_LEVELS).optional(),
  includeConsumed:   z.boolean().default(false),
  page:              z.coerce.number().int().positive().default(1),
  limit:             z.coerce.number().int().positive().max(100).default(50),
});
export type ListLotsInput = z.infer<typeof listLotsSchema>;

export const changeLotStatusSchema = z.object({
  lotId:         z.string().uuid(),
  status:        z.enum(LOT_STATUSES),
  justification: justificationSchema,
});
export type ChangeLotStatusInput = z.infer<typeof changeLotStatusSchema>;

export const quarantineLotSchema = z.object({
  lotId:  z.string().uuid(),
  reason: justificationSchema,
});
export type QuarantineLotInput = z.infer<typeof quarantineLotSchema>;

/* ── FEFO: sugestão de lotes para saída ──────────────────────────────────── */

export const fefoSuggestionSchema = z.object({
  productId: z.string().uuid(),
  quantity:  z.number().positive('Quantidade deve ser > 0'),
});
export type FefoSuggestionInput = z.infer<typeof fefoSuggestionSchema>;

export interface FefoSuggestionResult {
  available:      boolean;                         // true se saldo total cobre a quantidade
  totalAvailable: number;                          // soma de quantity_current entre lotes ativos
  requested:      number;
  shortage:       number;                          // max(0, requested - totalAvailable)
  lots: Array<{
    lotId:             string;
    lotNumber:         string;
    expiryDate:        string | null;
    quantityAvailable: number;
    quantityFromLot:   number;
  }>;
}

/* ── Alertas: listagem e eventos ─────────────────────────────────────────── */

export const listAlertsSchema = z.object({
  alertType: z.enum(ALERT_TYPES).optional(),
  since:     z.string().datetime().optional(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().positive().max(200).default(50),
});
export type ListAlertsInput = z.infer<typeof listAlertsSchema>;

export interface StockAlertEvent {
  type:         'stock.lot_expiring' | 'stock.low_alert' | 'stock.critical_alert' | 'stock.rupture';
  clinicId:     string;
  productId:    string;
  productName:  string;
  lotId?:       string;
  lotNumber?:   string;
  expiryDate?:  string | null;
  qtyRemaining: number;
  storageLocationId?:   string | null;
  storageLocationName?: string | null;
  emittedAt:    string;
}

/* ── Chave de idempotência do worker ─────────────────────────────────────── */

/**
 * Monta a chave de idempotência para alert_emissions_log.
 * Formato: `{alert_type}:{entity_id}:{YYYY-MM-DD}` no timezone da clínica.
 * Um alerta por tipo/entidade/dia.
 */
export function buildAlertEmissionKey(
  alertType: AlertType,
  entityId:  string,
  dateYmd:   string,
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    throw new Error('buildAlertEmissionKey: dateYmd deve estar em YYYY-MM-DD');
  }
  return `${alertType}:${entityId}:${dateYmd}`;
}
