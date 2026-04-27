import { z } from 'zod';

// ─── Constantes de domínio ─────────────────────────────────────────────────

export const INVOICE_STATUSES = [
  'rascunho',
  'emitida',
  'parcial',
  'paga',
  'vencida',
  'cancelada',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  rascunho: 'Rascunho',
  emitida:  'Emitida',
  parcial:  'Parcial',
  paga:     'Paga',
  vencida:  'Vencida',
  cancelada: 'Cancelada',
};

export const PAYMENT_METHODS = [
  'dinheiro',
  'pix',
  'cartao_credito',
  'cartao_debito',
  'boleto',
  'plano_saude',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  dinheiro:       'Dinheiro',
  pix:            'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito:  'Cartão de Débito',
  boleto:         'Boleto',
  plano_saude:    'Convênio / Plano',
};

export const SERVICE_CATEGORIES = [
  'consulta',
  'procedimento_estetico',
  'procedimento_cirurgico',
  'exame',
  'produto',
  'outro',
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  consulta:                'Consulta',
  procedimento_estetico:   'Procedimento Estético',
  procedimento_cirurgico:  'Procedimento Cirúrgico',
  exame:                   'Exame',
  produto:                 'Produto',
  outro:                   'Outro',
};

export const DISCOUNT_REASONS = [
  'cortesia',
  'pacote',
  'fidelidade',
  'negociacao',
  'outro',
] as const;
export type DiscountReason = (typeof DISCOUNT_REASONS)[number];

export const DISCOUNT_REASON_LABELS: Record<DiscountReason, string> = {
  cortesia:    'Cortesia',
  pacote:      'Pacote',
  fidelidade:  'Fidelidade',
  negociacao:  'Negociação',
  outro:       'Outro',
};

// ─── Validadores internos ──────────────────────────────────────────────────

/** Preço em centavos: >= 0, inteiro */
const priceSchema = z
  .number()
  .int('Valor deve ser inteiro (centavos).')
  .min(0, 'Valor não pode ser negativo.');

/** Preço em centavos: > 0, inteiro */
const positivePriceSchema = z
  .number()
  .int('Valor deve ser inteiro (centavos).')
  .positive('Valor deve ser maior que zero.');

/** Código TUSS: 8 dígitos numéricos */
const tussCodeSchema = z
  .string()
  .regex(/^\d{8}$/, 'Código TUSS deve ter exatamente 8 dígitos numéricos.')
  .optional();

// ─── Catálogo de Serviços ──────────────────────────────────────────────────

export const createServiceSchema = z.object({
  name:        z.string().min(1, 'Nome obrigatório.').max(200).trim(),
  description: z.string().max(1000).trim().optional(),
  category:    z.enum(SERVICE_CATEGORIES).default('consulta'),
  tussCode:    tussCodeSchema,
  cbhpmCode:   z.string().max(20).optional(),
  price:       priceSchema,
  durationMin: z.number().int().positive('Duração deve ser maior que zero.').default(30),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema
  .partial()
  .extend({ id: z.string().uuid() });
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export const listServicesSchema = z.object({
  search:     z.string().max(200).optional(),
  category:   z.enum(SERVICE_CATEGORIES).optional(),
  isActive:   z.boolean().optional(),
  page:       z.number().int().positive().default(1),
  limit:      z.number().int().positive().max(100).default(25),
});
export type ListServicesInput = z.infer<typeof listServicesSchema>;

// ─── Itens de Fatura ───────────────────────────────────────────────────────

export const invoiceItemSchema = z.object({
  serviceId:   z.string().uuid('ID de serviço inválido.'),
  providerId:  z.string().uuid('ID de médico inválido.').optional(),
  description: z.string().max(500).trim().optional(),
  quantity:    z.number().int().positive().default(1),
  unitPrice:   priceSchema.optional(), // se omitido, usa preço atual do catálogo
});
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;

// ─── Criação / Edição de Fatura (Rascunho) ────────────────────────────────

export const discountSchema = z.discriminatedUnion('discountType', [
  z.object({
    discountType:   z.literal('absolute'),
    discountValue:  positivePriceSchema,
    discountReason: z.enum(DISCOUNT_REASONS),
    discountNote:   z.string().min(5, 'Motivo mínimo 5 caracteres.').max(500).optional(),
  }),
  z.object({
    discountType:   z.literal('percentage'),
    discountValue:  z.number().int().min(1).max(100, 'Desconto máximo 100%.'),
    discountReason: z.enum(DISCOUNT_REASONS),
    discountNote:   z.string().min(5, 'Motivo mínimo 5 caracteres.').max(500).optional(),
  }),
]);
export type DiscountInput = z.infer<typeof discountSchema>;

export const createInvoiceSchema = z.object({
  patientId:     z.string().uuid('ID de paciente inválido.'),
  appointmentId: z.string().uuid().optional(),
  providerId:    z.string().uuid().optional(),
  dueDate:       z.coerce.date().optional(),
  notes:         z.string().max(2000).trim().optional(),
  internalNotes: z.string().max(2000).trim().optional(),
  items:         z.array(invoiceItemSchema).min(1, 'Fatura deve ter ao menos 1 item.'),
  discount:      discountSchema.optional(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const updateInvoiceDraftSchema = z.object({
  id:            z.string().uuid(),
  dueDate:       z.coerce.date().optional(),
  notes:         z.string().max(2000).trim().optional(),
  internalNotes: z.string().max(2000).trim().optional(),
  items:         z.array(invoiceItemSchema).min(1).optional(),
  discount:      discountSchema.optional().nullable(),
});
export type UpdateInvoiceDraftInput = z.infer<typeof updateInvoiceDraftSchema>;

export const listInvoicesSchema = z.object({
  patientId:  z.string().uuid().optional(),
  providerId: z.string().uuid().optional(),
  status:     z.enum(INVOICE_STATUSES).optional(),
  dateFrom:   z.coerce.date().optional(),
  dateTo:     z.coerce.date().optional(),
  search:     z.string().max(200).optional(),
  page:       z.number().int().positive().default(1),
  limit:      z.number().int().positive().max(100).default(25),
});
export type ListInvoicesInput = z.infer<typeof listInvoicesSchema>;

export const emitInvoiceSchema = z.object({
  id: z.string().uuid(),
});

export const cancelInvoiceSchema = z.object({
  id:     z.string().uuid(),
  reason: z.string().min(5, 'Motivo de cancelamento obrigatório (mín. 5 chars).').max(500),
});
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;

export const applyDiscountSchema = z.object({
  invoiceId: z.string().uuid(),
  discount:  discountSchema,
});

// ─── Pagamentos ────────────────────────────────────────────────────────────

const basePaymentSchema = z.object({
  invoiceId: z.string().uuid('ID de fatura inválido.'),
  amount:    positivePriceSchema,
  paidAt:    z.coerce.date().optional(),
  notes:     z.string().max(500).optional(),
});

export const registerPaymentSchema = z
  .discriminatedUnion('method', [
    basePaymentSchema.extend({
      method: z.literal('dinheiro'),
    }),
    basePaymentSchema.extend({
      method:   z.literal('pix'),
      pixTxid:  z.string().max(100).optional(),
    }),
    basePaymentSchema.extend({
      method:           z.literal('cartao_credito'),
      cardBrand:        z.string().max(50).optional(),
      cardLast4:        z.string().length(4).regex(/^\d{4}$/).optional(),
      cardInstallments: z.number().int().min(1).default(1),
    }),
    basePaymentSchema.extend({
      method:    z.literal('cartao_debito'),
      cardBrand: z.string().max(50).optional(),
      cardLast4: z.string().length(4).regex(/^\d{4}$/).optional(),
    }),
    basePaymentSchema.extend({
      method:         z.literal('boleto'),
      boletoBarcode:  z.string().max(200).optional(),
    }),
    basePaymentSchema.extend({
      method:        z.literal('plano_saude'),
      convenioName:  z.string().max(100),
      convenioGuide: z.string().max(100).optional(),
    }),
  ])
  .describe('Registro de pagamento com campos específicos por método.');
export type RegisterPaymentInput = z.infer<typeof registerPaymentSchema>;

export const refundPaymentSchema = z.object({
  paymentId:    z.string().uuid('ID de pagamento inválido.'),
  reason:       z.string().min(5, 'Motivo de estorno obrigatório (mín. 5 chars).').max(500),
});
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;

export const installmentsSchema = z.object({
  invoiceId:    z.string().uuid(),
  method:       z.enum(PAYMENT_METHODS),
  installments: z.number().int().min(2, 'Parcelamento exige ao menos 2 parcelas.'),
  firstDueDate: z.coerce.date(),
});
export type InstallmentsInput = z.infer<typeof installmentsSchema>;

// ─── Caixa do Dia ──────────────────────────────────────────────────────────

export const caixaQuerySchema = z.object({
  date: z.coerce.date().optional(), // se omitido, usa hoje no timezone da clínica
});
export type CaixaQueryInput = z.infer<typeof caixaQuerySchema>;

// ─── Configuração Financeira ───────────────────────────────────────────────

export const updateFinancialConfigSchema = z.object({
  timezone:            z.string().max(100).optional(),
  maxDiscountPct:      z.number().int().min(0).max(100).optional(),
  adminDiscountFloor:  z.number().int().min(0).max(100).optional(),
  maxInstallments:     z.number().int().min(1).max(60).optional(),
  invoicePrefix:       z.string().min(2).max(6).toUpperCase().optional(),
  dueDays:             z.number().int().min(0).max(365).optional(),
});
export type UpdateFinancialConfigInput = z.infer<typeof updateFinancialConfigSchema>;
