import { z } from 'zod';

/* ── Status e urgência ───────────────────────────────────────────────────── */

export const ORDER_STATUSES = [
  'rascunho',
  'pendente_aprovacao',
  'aprovado',
  'rejeitado',
  'devolvido',
  'enviado',
  'parcialmente_recebido',
  'recebido',
  'cancelado',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  rascunho:              'Rascunho',
  pendente_aprovacao:    'Aguardando aprovação',
  aprovado:              'Aprovado',
  rejeitado:             'Rejeitado',
  devolvido:             'Devolvido para correção',
  enviado:               'Enviado ao fornecedor',
  parcialmente_recebido: 'Parcialmente recebido',
  recebido:              'Recebido',
  cancelado:             'Cancelado',
};

export const ORDER_URGENCIES = ['normal', 'urgente', 'emergencia'] as const;
export type OrderUrgency = (typeof ORDER_URGENCIES)[number];

export const ORDER_URGENCY_LABELS: Record<OrderUrgency, string> = {
  normal:     'Normal',
  urgente:    'Urgente',
  emergencia: 'Emergência',
};

/* ── Máquina de estados ───────────────────────────────────────────────────
 * Espelha a validação server-side; também usada no frontend para esconder
 * ações inválidas sem chamar a API.
 */
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  rascunho:              ['pendente_aprovacao', 'cancelado'],
  pendente_aprovacao:    ['aprovado', 'rejeitado', 'devolvido'],
  aprovado:              ['enviado'],
  rejeitado:             ['cancelado'],
  devolvido:             ['pendente_aprovacao', 'cancelado'],
  enviado:               ['parcialmente_recebido', 'recebido'],
  parcialmente_recebido: ['parcialmente_recebido', 'recebido'],
  recebido:              [],
  cancelado:             [],
};

export const EDITABLE_STATUSES: ReadonlyArray<OrderStatus> = ['rascunho', 'devolvido'];

/* ── Schemas de input ────────────────────────────────────────────────────── */

const orderItemInputSchema = z.object({
  id:            z.string().uuid().optional(),           // se já existe (update)
  productId:     z.string().uuid('Produto inválido'),
  quantity:      z.number().positive('Quantidade deve ser > 0'),
  estimatedCost: z.number().min(0, 'Preço estimado deve ser ≥ 0'),
  notes:         z.string().trim().max(500).nullable().optional(),
});
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

export const createPurchaseOrderSchema = z.object({
  supplierId:       z.string().uuid('Fornecedor obrigatório'),
  urgency:          z.enum(ORDER_URGENCIES, { errorMap: () => ({ message: 'Urgência inválida' }) }),
  notes:            z.string().trim().max(1000).nullable().optional(),
  expectedDelivery: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida').nullable().optional(),
  items:            z.array(orderItemInputSchema)
    .min(1, 'Pelo menos 1 item é obrigatório')
    .max(100, 'Máximo de 100 itens por pedido'),
});
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

export const updatePurchaseOrderSchema = z.object({
  orderId:          z.string().uuid(),
  supplierId:       z.string().uuid().optional(),
  urgency:          z.enum(ORDER_URGENCIES).optional(),
  notes:            z.string().trim().max(1000).nullable().optional(),
  expectedDelivery: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  items:            z.array(orderItemInputSchema).min(1).max(100).optional(),
});
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;

export const submitOrderSchema  = z.object({ orderId: z.string().uuid() });
export type SubmitOrderInput    = z.infer<typeof submitOrderSchema>;

export const approveOrderSchema = z.object({ orderId: z.string().uuid() });
export type ApproveOrderInput   = z.infer<typeof approveOrderSchema>;

export const rejectOrderSchema  = z.object({
  orderId: z.string().uuid(),
  reason:  z.string().trim()
    .min(10, 'Motivo deve ter no mínimo 10 caracteres')
    .max(500, 'Motivo muito longo'),
});
export type RejectOrderInput = z.infer<typeof rejectOrderSchema>;

export const returnOrderSchema = z.object({
  orderId: z.string().uuid(),
  reason:  z.string().trim()
    .min(10, 'Motivo deve ter no mínimo 10 caracteres')
    .max(500, 'Motivo muito longo'),
});
export type ReturnOrderInput = z.infer<typeof returnOrderSchema>;

export const sendOrderSchema = z.object({ orderId: z.string().uuid() });
export type SendOrderInput   = z.infer<typeof sendOrderSchema>;

const receiveItemSchema = z.object({
  purchaseOrderItemId: z.string().uuid(),
  quantityReceived:    z.number().min(0, 'Quantidade não pode ser negativa'),
  lotNumber:           z.string().trim().max(80),
  expiryDate:          z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no formato YYYY-MM-DD')
    .nullable()
    .optional(),
  temperatureCelsius:  z.number().nullable().optional(),
  storageLocationId:   z.string().uuid().nullable().optional(),
});
export type ReceiveItemInput = z.infer<typeof receiveItemSchema>;

export const receiveOrderSchema = z.object({
  orderId:                 z.string().uuid(),
  type:                    z.enum(['confirmar_total', 'confirmar_parcial', 'recusar']),
  // Dados NF-e (opcional — aceita preenchimento manual se parse falhar)
  nfeXml:                  z.string().max(5 * 1024 * 1024, 'XML excede 5MB').optional(),
  nfeNumber:               z.string().trim().max(20).optional(),
  nfeSeries:               z.string().trim().max(5).optional(),
  issuerCnpj:              z.string().trim().optional(),
  issueDate:               z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  divergenceJustification: z.string().trim().min(10).max(500).optional(),
  supervisorApproved:      z.boolean().optional(),
  refusalReason:           z.string().trim()
    .min(10, 'Motivo de recusa deve ter no mínimo 10 caracteres')
    .max(500)
    .optional(),
  items: z.array(receiveItemSchema).min(1, 'Pelo menos 1 item é obrigatório'),
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
      const item = d.items[idx]!;
      if (item.quantityReceived > 0 && !item.lotNumber?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['items', idx, 'lotNumber'],
          message: 'Número de lote obrigatório para itens recebidos' });
      }
    }
  }
});
export type ReceiveOrderInput = z.infer<typeof receiveOrderSchema>;

export const listOrdersSchema = z.object({
  status:     z.enum(ORDER_STATUSES).optional(),
  urgency:    z.enum(ORDER_URGENCIES).optional(),
  supplierId: z.string().uuid().optional(),
  dateFrom:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search:     z.string().max(200).optional(),
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().positive().max(100).default(20),
});
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;

export const getOrderSchema = z.object({ orderId: z.string().uuid() });
export type GetOrderInput   = z.infer<typeof getOrderSchema>;

export const parseNfeSchema = z.object({
  xml: z.string().min(1, 'XML obrigatório').max(5 * 1024 * 1024, 'XML excede 5MB'),
});
export type ParseNfeInput = z.infer<typeof parseNfeSchema>;

export const listSuggestionsSchema = z.object({
  supplierId: z.string().uuid().optional(),
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().positive().max(200).default(50),
});
export type ListSuggestionsInput = z.infer<typeof listSuggestionsSchema>;

export const getPurchaseSettingsSchema = z.object({});
export type GetPurchaseSettingsInput   = z.infer<typeof getPurchaseSettingsSchema>;

/* ── Tipos de saída ───────────────────────────────────────────────────────── */

export interface PurchaseSuggestion {
  productId:             string;
  productName:           string;
  sku:                   string | null;
  unit:                  string;
  qtyAtual:              number;
  reorderPoint:          number;
  qtySugerida:           number;
  maxStock:              number | null;
  suggestedSupplierId:   string | null;
  suggestedSupplierName: string | null;
  lastUnitCost:          number | null;
  lastOrderDate:         string | null;
  demandaProxima:        boolean;
  procedureCount:        number;
  stockStatus:           'RUPTURA' | 'CRITICO' | 'ATENCAO';
}

export interface PurchaseOrderItem {
  id:               string;
  productId:        string;
  productName:      string;
  sku:              string | null;
  unit:             string;
  quantityOrdered:  number;
  quantityReceived: number;
  unitCost:         number;
  totalCost:        number;
  notes:            string | null;
}

export interface PurchaseOrderStatusHistory {
  id:             string;
  fromStatus:     OrderStatus | null;
  toStatus:       OrderStatus;
  changedBy:      string | null;
  changedByName:  string | null;
  changedByLabel: string | null;
  changedAt:      string;
  reason:         string | null;
}

export interface PurchaseOrder {
  id:              string;
  orderNumber:     string | null;
  supplierId:      string;
  supplierName:    string;
  status:          OrderStatus;
  urgency:         OrderUrgency;
  totalAmount:     number;
  notes:           string | null;
  expectedDelivery: string | null;
  createdBy:       string | null;
  createdByName:   string | null;
  createdAt:       string;
  submittedAt:     string | null;
  approvedAt:      string | null;
  approvedBy:      string | null;
  rejectedAt:      string | null;
  rejectionReason: string | null;
  returnedAt:      string | null;
  returnReason:    string | null;
  sentAt:          string | null;
  autoApproved:    boolean;
  items?:          PurchaseOrderItem[];
  history?:        PurchaseOrderStatusHistory[];
}

export interface PurchaseSettings {
  autoApprovalThreshold:  number;
  divergenceTolerancePct: number;
  divergenceSupervisorPct: number;
  orderNumberPrefix:      string;
}

export interface NfeParsedItem {
  codigo:        string;
  descricao:     string;
  quantidade:    number;
  valorUnitario: number;
  valorTotal:    number;
}

export interface NfeParsed {
  numero:        string;
  serie:         string;
  cnpjEmitente:  string;
  dataEmissao:   string;
  itens:         NfeParsedItem[];
}

export interface ReceiveOrderResult {
  orderId:         string;
  newStatus:       OrderStatus;
  lotsCreated:     number;
  movementsCreated: number;
  cnpjDivergent:   boolean;
}
