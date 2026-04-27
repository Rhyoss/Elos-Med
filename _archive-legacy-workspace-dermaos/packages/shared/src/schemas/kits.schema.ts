import { z } from 'zod';

/* ══════════════════════════════════════════════════════════════════════════
 * Kits de procedimento — CRUD, disponibilidade, consumo, rastreabilidade
 * ══════════════════════════════════════════════════════════════════════════ */

export const KIT_STATUSES = ['active', 'superseded', 'archived'] as const;
export type KitStatus = (typeof KIT_STATUSES)[number];

export const KIT_STATUS_LABELS: Record<KitStatus, string> = {
  active:     'Ativo',
  superseded: 'Substituído',
  archived:   'Arquivado',
};

export const KIT_AVAILABILITY_STATUSES = ['completo', 'parcial', 'indisponivel'] as const;
export type KitAvailabilityStatus = (typeof KIT_AVAILABILITY_STATUSES)[number];

export const KIT_AVAILABILITY_LABELS: Record<KitAvailabilityStatus, string> = {
  completo:     'Disponível',
  parcial:      'Parcial',
  indisponivel: 'Indisponível',
};

export const KIT_ITEM_STATUSES = ['disponivel', 'insuficiente', 'indisponivel'] as const;
export type KitItemStatus = (typeof KIT_ITEM_STATUSES)[number];

/* ── Kit item (body) ─────────────────────────────────────────────────────── */

export const kitItemInputSchema = z.object({
  productId:    z.string().uuid('Produto inválido'),
  quantity:     z.number().positive('Quantidade deve ser > 0'),
  isOptional:   z.boolean().default(false),
  displayOrder: z.number().int().nonnegative().default(0),
  notes:        z.string().trim().max(500).nullable().optional(),
});
export type KitItemInput = z.infer<typeof kitItemInputSchema>;

/* ── Create/Update kit ───────────────────────────────────────────────────── */

const kitItemsArraySchema = z.array(kitItemInputSchema)
  .min(1, 'Kit deve conter ao menos 1 item')
  .superRefine((items, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      const id = items[i]!.productId;
      if (seen.has(id)) {
        ctx.addIssue({
          code:    'custom',
          path:    [i, 'productId'],
          message: 'Produto duplicado no kit — use apenas um registro por produto',
        });
      }
      seen.add(id);
    }
  });

export const createKitSchema = z.object({
  name:            z.string().trim().min(3, 'Nome muito curto').max(120, 'Nome muito longo'),
  description:     z.string().trim().max(500).nullable().optional(),
  procedureTypeId: z.string().uuid('Tipo de procedimento obrigatório'),
  items:           kitItemsArraySchema,
});
export type CreateKitInput = z.infer<typeof createKitSchema>;

export const updateKitSchema = z.object({
  id:               z.string().uuid(),
  name:             z.string().trim().min(3).max(120).optional(),
  description:      z.string().trim().max(500).nullable().optional(),
  procedureTypeId:  z.string().uuid().optional(),
  items:            kitItemsArraySchema.optional(),
  acknowledgeVersioning: z.boolean().optional(),
});
export type UpdateKitInput = z.infer<typeof updateKitSchema>;

/* ── List kits ───────────────────────────────────────────────────────────── */

export const listKitsSchema = z.object({
  search:          z.string().trim().max(120).optional(),
  procedureTypeId: z.string().uuid().optional(),
  availability:    z.enum(KIT_AVAILABILITY_STATUSES).optional(),
  includeArchived: z.boolean().default(false),
  page:            z.coerce.number().int().positive().default(1),
  limit:           z.coerce.number().int().positive().max(100).default(50),
});
export type ListKitsInput = z.infer<typeof listKitsSchema>;

export const archiveKitSchema = z.object({
  id: z.string().uuid(),
});
export type ArchiveKitInput = z.infer<typeof archiveKitSchema>;

/* ── Availability check ──────────────────────────────────────────────────── */

export const kitAvailabilitySchema = z.object({
  kitId: z.string().uuid(),
});
export type KitAvailabilityInput = z.infer<typeof kitAvailabilitySchema>;

export interface KitAvailabilityItemResult {
  productId:        string;
  productName:      string;
  productUnit:      string;
  isOptional:       boolean;
  quantityRequired: number;
  quantityAvailable: number;
  status:           KitItemStatus;
  suggestedLots: Array<{
    lotId:             string;
    lotNumber:         string;
    expiryDate:        string | null;
    quantityFromLot:   number;
    quantityAvailable: number;
  }>;
}

export interface KitAvailabilityResult {
  kitId:       string;
  kitName:     string;
  kitVersion:  number;
  status:      KitAvailabilityStatus;
  items:       KitAvailabilityItemResult[];
  checkedAt:   string;
}

/* ══════════════════════════════════════════════════════════════════════════
 * Consumo por procedimento
 * ══════════════════════════════════════════════════════════════════════════ */

export const CONSUMPTION_SOURCES = ['encounter', 'protocol_session', 'manual', 'offline_sync'] as const;
export type ConsumptionSource = (typeof CONSUMPTION_SOURCES)[number];

export const CONSUMPTION_STATUSES = ['completed', 'partial', 'skipped', 'failed'] as const;
export type ConsumptionStatus = (typeof CONSUMPTION_STATUSES)[number];

/* ── Consumption item override (usuário troca de lote ou marca não-usado) ─ */

export const consumptionItemOverrideSchema = z.object({
  productId: z.string().uuid(),
  // Lote específico escolhido (sobrescreve sugestão FEFO). Null = usa FEFO.
  lotId:     z.string().uuid().nullable().optional(),
  // Marca item opcional como não usado neste procedimento.
  skipped:   z.boolean().default(false),
  // Quantidade efetivamente usada (default = quantity do kit_item).
  quantity:  z.number().positive().optional(),
});
export type ConsumptionItemOverride = z.infer<typeof consumptionItemOverrideSchema>;

/* ── Consume kit (request) ───────────────────────────────────────────────── */

export const consumeKitSchema = z.object({
  kitId:              z.string().uuid(),
  patientId:          z.string().uuid('Paciente obrigatório'),
  encounterId:        z.string().uuid().nullable().optional(),
  protocolSessionId:  z.string().uuid().nullable().optional(),
  source:             z.enum(CONSUMPTION_SOURCES).default('manual'),
  idempotencyKey:     z.string().trim().min(6).max(200),
  confirmed:          z.literal(true, {
    errorMap: () => ({ message: 'Confirmação obrigatória para registrar consumo' }),
  }),
  overrides:          z.array(consumptionItemOverrideSchema).default([]),
  notes:              z.string().trim().max(500).nullable().optional(),
  // Permite finalizar o consumo mesmo com itens faltantes (gera pending_items).
  allowPartial:       z.boolean().default(true),
  // Timestamp do consumo na origem (útil para offline). Default: NOW no servidor.
  occurredAt:         z.string().datetime().optional(),
})
.superRefine((d, ctx) => {
  if (!d.encounterId && !d.protocolSessionId && d.source !== 'manual' && d.source !== 'offline_sync') {
    ctx.addIssue({
      code:    'custom',
      path:    ['encounterId'],
      message: 'Consumo exige encounterId ou protocolSessionId',
    });
  }
});
export type ConsumeKitInput = z.infer<typeof consumeKitSchema>;

export interface ConsumeKitResultItem {
  productId:         string;
  productName:       string;
  quantityConsumed:  number;
  quantityMissing:   number;
  skipped:           boolean;
  lots: Array<{
    lotId:      string;
    lotNumber:  string;
    quantity:   number;
  }>;
}

export interface ConsumeKitResult {
  consumptionLogId: string;
  kitId:            string;
  status:           ConsumptionStatus;
  itemsConsumed:    number;
  itemsPending:     number;
  items:            ConsumeKitResultItem[];
  alreadyProcessed: boolean;
}

/* ── List consumptions (histórico) ───────────────────────────────────────── */

export const listConsumptionsSchema = z.object({
  patientId:   z.string().uuid().optional(),
  kitId:       z.string().uuid().optional(),
  status:      z.enum(CONSUMPTION_STATUSES).optional(),
  encounterId: z.string().uuid().optional(),
  from:        z.string().datetime().optional(),
  to:          z.string().datetime().optional(),
  page:        z.coerce.number().int().positive().default(1),
  limit:       z.coerce.number().int().positive().max(100).default(50),
});
export type ListConsumptionsInput = z.infer<typeof listConsumptionsSchema>;

/* ── Agenda-do-dia (step 1) ──────────────────────────────────────────────── */

export const todayAppointmentsWithKitsSchema = z.object({
  providerId: z.string().uuid().optional(),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type TodayAppointmentsWithKitsInput = z.infer<typeof todayAppointmentsWithKitsSchema>;

/* ══════════════════════════════════════════════════════════════════════════
 * Rastreabilidade ANVISA
 * ══════════════════════════════════════════════════════════════════════════ */

export const tracebackByLotSchema = z.object({
  lotId:  z.string().uuid().optional(),
  lotNumber: z.string().trim().min(1).max(80).optional(),
  productId: z.string().uuid().optional(),
  cursor: z.string().datetime().optional(),
  limit:  z.coerce.number().int().positive().max(100).default(50),
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
export type TracebackByLotInput = z.infer<typeof tracebackByLotSchema>;

export const tracebackByPatientSchema = z.object({
  patientId: z.string().uuid(),
  from:      z.string().datetime().optional(),
  to:        z.string().datetime().optional(),
  cursor:    z.string().datetime().optional(),
  limit:     z.coerce.number().int().positive().max(100).default(50),
});
export type TracebackByPatientInput = z.infer<typeof tracebackByPatientSchema>;

export interface TracebackRow {
  traceId:        string;
  appliedAt:      string;
  quantityUsed:   number;
  patientId:      string;
  patientLabel:   string;      // mascarado se o usuário não tem 'recall'
  patientPhone:   string | null;
  productId:      string;
  productName:    string;
  productAnvisa:  string | null;
  lotId:          string;
  lotNumber:      string;
  expiryDate:     string | null;
  supplierName:   string | null;
  encounterId:    string | null;
  procedureName:  string | null;
  providerName:   string | null;
}

export interface TracebackResult {
  rows:       TracebackRow[];
  nextCursor: string | null;
  total:      number;
}

/* ── PDF report (recall) ─────────────────────────────────────────────────── */

export const generateRecallReportSchema = z.object({
  scope:     z.enum(['by_lot', 'by_patient']),
  lotId:     z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
})
.superRefine((d, ctx) => {
  if (d.scope === 'by_lot' && !d.lotId) {
    ctx.addIssue({ code: 'custom', path: ['lotId'], message: 'lotId obrigatório para escopo by_lot' });
  }
  if (d.scope === 'by_patient' && !d.patientId) {
    ctx.addIssue({ code: 'custom', path: ['patientId'], message: 'patientId obrigatório para escopo by_patient' });
  }
});
export type GenerateRecallReportInput = z.infer<typeof generateRecallReportSchema>;

export interface RecallReportResult {
  reportId:   string;
  objectKey:  string;
  downloadUrl: string;
  sha256:     string;
  sizeBytes:  number;
  generatedAt: string;
}

export const downloadRecallReportSchema = z.object({
  reportId: z.string().uuid(),
});
export type DownloadRecallReportInput = z.infer<typeof downloadRecallReportSchema>;

/* ══════════════════════════════════════════════════════════════════════════
 * Event payloads (internal)
 * ══════════════════════════════════════════════════════════════════════════ */

export interface EncounterCompletedEvent {
  clinicId:       string;
  encounterId:    string;
  patientId:      string;
  providerId:     string;
  appointmentId:  string | null;
  serviceId:      string | null;
  completedAt:    string;
}

export interface ProtocolSessionCompletedEvent {
  clinicId:            string;
  protocolSessionId:   string;
  protocolId:          string;
  patientId:           string;
  appointmentId:       string | null;
  serviceId:           string | null;
  performedBy:         string | null;
  performedAt:         string;
}

export interface StockConsumptionIncompletePayload {
  kitId:        string;
  kitName:      string;
  encounterId:  string | null;
  patientId:    string;
  missingItems: Array<{
    productId:       string;
    productName:     string;
    quantityMissing: number;
  }>;
}
