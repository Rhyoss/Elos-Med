import { z } from 'zod';

/* ── Tipos de prescrição ────────────────────────────────────────────────── */

export const PRESCRIPTION_TYPES = [
  'topica',
  'sistemica',
  'manipulada',
  'cosmeceutica',
] as const;
export const prescriptionTypeSchema = z.enum(PRESCRIPTION_TYPES);
export type PrescriptionType = z.infer<typeof prescriptionTypeSchema>;

export const PRESCRIPTION_TYPE_LABELS: Record<PrescriptionType, string> = {
  topica:       'Tópica',
  sistemica:    'Sistêmica',
  manipulada:   'Manipulada',
  cosmeceutica: 'Cosmecêutica',
};

export const prescriptionStatusSchema = z.enum([
  'rascunho',
  'emitida',
  'assinada',
  'enviada_digital',
  'impressa',
  'expirada',
  'cancelada',
]);
export type PrescriptionStatus = z.infer<typeof prescriptionStatusSchema>;

export const PRESCRIPTION_STATUS_LABELS: Record<PrescriptionStatus, string> = {
  rascunho:        'Rascunho',
  emitida:         'Emitida',
  assinada:        'Assinada',
  enviada_digital: 'Enviada',
  impressa:        'Impressa',
  expirada:        'Expirada',
  cancelada:       'Cancelada',
};

export const prescriptionDeliveryStatusSchema = z.enum([
  'pending',
  'sent_mock',
  'delivered',
  'failed',
]);
export type PrescriptionDeliveryStatus = z.infer<typeof prescriptionDeliveryStatusSchema>;

/* ── Itens: schema discriminado por tipo ────────────────────────────────── */

// Campo comum: sanitizar texto livre removendo tags HTML suspeitas via .transform
// (O server faz nova validação/sanitização; client apenas evita submissões óbvias.)
const noHtmlTags = (s: string) => !/<\s*(script|iframe|object|embed)/i.test(s);
const safeText = (max: number, min = 0) =>
  z.string()
   .trim()
   .min(min)
   .max(max)
   .refine(noHtmlTags, { message: 'Texto contém marcações não permitidas' });
const safeTextMin = (max: number, minVal: number, msg?: string) =>
  z.string()
   .trim()
   .min(minVal, msg)
   .max(max)
   .refine(noHtmlTags, { message: 'Texto contém marcações não permitidas' });

export const topicaItemSchema = z.object({
  type:         z.literal('topica'),
  name:         safeTextMin(200, 2, 'Nome do medicamento é obrigatório'),
  concentration: safeText(100).optional(),
  applicationArea: safeTextMin(200, 2, 'Área de aplicação é obrigatória'),
  frequency:    safeTextMin(120, 2, 'Posologia é obrigatória'),
  durationDays: z.number().int().positive().max(365).optional(),
  instructions: safeText(1000).optional(),
});
export type TopicaItem = z.infer<typeof topicaItemSchema>;

export const sistemicaItemSchema = z.object({
  type:         z.literal('sistemica'),
  name:         safeTextMin(200, 2, 'Nome do medicamento é obrigatório'),
  dosage:       safeTextMin(100, 1, 'Dosagem é obrigatória'),
  form:         safeText(60).optional(),            // comprimido, cápsula, gotas...
  route:        safeText(40).optional(),            // oral, IM, IV...
  frequency:    safeTextMin(120, 2, 'Posologia é obrigatória'),
  durationDays: z.number().int().positive().max(365),
  quantity:     z.number().positive().max(9999).optional(),
  continuousUse: z.boolean().default(false),
  instructions: safeText(1000).optional(),
});
export type SistemicaItem = z.infer<typeof sistemicaItemSchema>;

export const manipuladaComponentSchema = z.object({
  substance:    safeTextMin(200, 2),
  concentration: safeTextMin(60, 1),
});
export type ManipuladaComponent = z.infer<typeof manipuladaComponentSchema>;

export const manipuladaItemSchema = z.object({
  type:         z.literal('manipulada'),
  formulation:  safeTextMin(200, 2, 'Nome da fórmula é obrigatório'),
  vehicle:      safeTextMin(100, 2, 'Veículo é obrigatório'), // creme, gel, loção
  components:   z.array(manipuladaComponentSchema).min(1, 'Adicione ao menos um componente').max(20),
  quantity:     safeTextMin(60, 1, 'Quantidade é obrigatória'),    // 30g, 100ml
  applicationArea: safeTextMin(200, 2, 'Área de aplicação é obrigatória'),
  frequency:    safeTextMin(120, 2, 'Posologia é obrigatória'),
  durationDays: z.number().int().positive().max(365).optional(),
  instructions: safeText(1000).optional(),
});
export type ManipuladaItem = z.infer<typeof manipuladaItemSchema>;

export const cosmeceuticaItemSchema = z.object({
  type:         z.literal('cosmeceutica'),
  name:         safeTextMin(200, 2, 'Produto é obrigatório'),
  brand:        safeText(120).optional(),
  applicationArea: safeTextMin(200, 2, 'Área de aplicação é obrigatória'),
  frequency:    safeTextMin(120, 2, 'Frequência de uso é obrigatória'),
  instructions: safeText(1000).optional(),
});
export type CosmeceuticaItem = z.infer<typeof cosmeceuticaItemSchema>;

export const prescriptionItemSchema = z.discriminatedUnion('type', [
  topicaItemSchema,
  sistemicaItemSchema,
  manipuladaItemSchema,
  cosmeceuticaItemSchema,
]);
export type PrescriptionItem = z.infer<typeof prescriptionItemSchema>;

/* ── Create / Update ────────────────────────────────────────────────────── */

// Valida que todos os itens têm o mesmo `type` declarado na prescrição.
function assertItemsMatchType(
  type: PrescriptionType,
  items: readonly { type: PrescriptionType }[],
  ctx: z.RefinementCtx,
) {
  items.forEach((item, i) => {
    if (item.type !== type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Item ${i + 1} não corresponde ao tipo ${type}`,
        path: ['items', i, 'type'],
      });
    }
  });
}

export const createPrescriptionSchema = z
  .object({
    patientId:    z.string().uuid('ID de paciente inválido'),
    encounterId:  z.string().uuid().optional(),
    type:         prescriptionTypeSchema,
    items:        z.array(prescriptionItemSchema).min(1, 'Adicione ao menos um item').max(40),
    notes:        z.string().trim().max(4000).optional(),
    validUntil:   z.coerce.date().optional(),
  })
  .superRefine((data, ctx) => assertItemsMatchType(data.type, data.items, ctx));
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;

export const updatePrescriptionSchema = z
  .object({
    id:           z.string().uuid(),
    items:        z.array(prescriptionItemSchema).min(1).max(40).optional(),
    notes:        z.string().trim().max(4000).nullable().optional(),
    validUntil:   z.coerce.date().nullable().optional(),
  });
export type UpdatePrescriptionInput = z.infer<typeof updatePrescriptionSchema>;

export const signPrescriptionSchema = z.object({
  id: z.string().uuid(),
});
export type SignPrescriptionInput = z.infer<typeof signPrescriptionSchema>;

export const duplicatePrescriptionSchema = z.object({
  id: z.string().uuid(),
});
export type DuplicatePrescriptionInput = z.infer<typeof duplicatePrescriptionSchema>;

export const cancelPrescriptionSchema = z.object({
  id:     z.string().uuid(),
  reason: z.string().trim().min(3, 'Motivo obrigatório').max(500),
});
export type CancelPrescriptionInput = z.infer<typeof cancelPrescriptionSchema>;

export const sendPrescriptionSchema = z.object({
  id:        z.string().uuid(),
  channel:   z.enum(['email', 'sms', 'whatsapp', 'portal']).default('email'),
  recipient: z.string().trim().min(3).max(200).optional(),
});
export type SendPrescriptionInput = z.infer<typeof sendPrescriptionSchema>;

/* ── Queries ────────────────────────────────────────────────────────────── */

export const listPrescriptionsByPatientSchema = z.object({
  patientId: z.string().uuid(),
  status:    prescriptionStatusSchema.optional(),
  type:      prescriptionTypeSchema.optional(),
  page:      z.coerce.number().int().positive().default(1),
  pageSize:  z.coerce.number().int().positive().max(100).default(20),
});
export type ListPrescriptionsQuery = z.infer<typeof listPrescriptionsByPatientSchema>;

export const getPrescriptionByIdSchema = z.object({
  id: z.string().uuid(),
});

export const requestPrescriptionPdfSchema = z.object({
  id: z.string().uuid(),
});

/* ── Configuração de campos por tipo (consumida pelo frontend) ─────────── */

export interface PrescriptionTypeField {
  key:          string;
  label:        string;
  kind:         'text' | 'textarea' | 'number' | 'select' | 'switch' | 'components';
  required:     boolean;
  placeholder?: string;
  options?:     readonly { value: string; label: string }[];
  maxLength?:   number;
  min?:         number;
  max?:         number;
}

export const PRESCRIPTION_TYPE_FIELDS: Record<PrescriptionType, readonly PrescriptionTypeField[]> = {
  topica: [
    { key: 'name',            label: 'Medicamento',          kind: 'text',     required: true,  maxLength: 200 },
    { key: 'concentration',   label: 'Concentração',         kind: 'text',     required: false, maxLength: 100 },
    { key: 'applicationArea', label: 'Área de aplicação',    kind: 'text',     required: true,  maxLength: 200 },
    { key: 'frequency',       label: 'Posologia',            kind: 'text',     required: true,  maxLength: 120 },
    { key: 'durationDays',    label: 'Duração (dias)',       kind: 'number',   required: false, min: 1, max: 365 },
    { key: 'instructions',    label: 'Orientações',          kind: 'textarea', required: false, maxLength: 1000 },
  ],
  sistemica: [
    { key: 'name',            label: 'Medicamento',          kind: 'text',     required: true,  maxLength: 200 },
    { key: 'dosage',          label: 'Dosagem',              kind: 'text',     required: true,  maxLength: 100 },
    { key: 'form',            label: 'Forma farmacêutica',   kind: 'text',     required: false, maxLength: 60 },
    { key: 'route',           label: 'Via',                  kind: 'text',     required: false, maxLength: 40 },
    { key: 'frequency',       label: 'Posologia',            kind: 'text',     required: true,  maxLength: 120 },
    { key: 'durationDays',    label: 'Duração (dias)',       kind: 'number',   required: true,  min: 1, max: 365 },
    { key: 'quantity',        label: 'Quantidade',           kind: 'number',   required: false, min: 1, max: 9999 },
    { key: 'continuousUse',   label: 'Uso contínuo',         kind: 'switch',   required: false },
    { key: 'instructions',    label: 'Orientações',          kind: 'textarea', required: false, maxLength: 1000 },
  ],
  manipulada: [
    { key: 'formulation',     label: 'Nome da fórmula',      kind: 'text',     required: true,  maxLength: 200 },
    { key: 'vehicle',         label: 'Veículo',              kind: 'text',     required: true,  maxLength: 100 },
    { key: 'components',      label: 'Componentes',          kind: 'components', required: true },
    { key: 'quantity',        label: 'Quantidade total',     kind: 'text',     required: true,  maxLength: 60 },
    { key: 'applicationArea', label: 'Área de aplicação',    kind: 'text',     required: true,  maxLength: 200 },
    { key: 'frequency',       label: 'Posologia',            kind: 'text',     required: true,  maxLength: 120 },
    { key: 'durationDays',    label: 'Duração (dias)',       kind: 'number',   required: false, min: 1, max: 365 },
    { key: 'instructions',    label: 'Orientações',          kind: 'textarea', required: false, maxLength: 1000 },
  ],
  cosmeceutica: [
    { key: 'name',            label: 'Produto',              kind: 'text',     required: true,  maxLength: 200 },
    { key: 'brand',           label: 'Marca',                kind: 'text',     required: false, maxLength: 120 },
    { key: 'applicationArea', label: 'Área de aplicação',    kind: 'text',     required: true,  maxLength: 200 },
    { key: 'frequency',       label: 'Frequência de uso',    kind: 'text',     required: true,  maxLength: 120 },
    { key: 'instructions',    label: 'Orientações',          kind: 'textarea', required: false, maxLength: 1000 },
  ],
};
