import { z } from 'zod';

/* ── Tipos / status ─────────────────────────────────────────────────────── */

export const PROTOCOL_TYPES = [
  'fototerapia',
  'laser_fracionado',
  'peeling',
  'injetavel',
  'microagulhamento',
  'outro',
] as const;
export const protocolTypeSchema = z.enum(PROTOCOL_TYPES);
export type ProtocolType = z.infer<typeof protocolTypeSchema>;

export const PROTOCOL_TYPE_LABELS: Record<ProtocolType, string> = {
  fototerapia:       'Fototerapia',
  laser_fracionado:  'Laser fracionado',
  peeling:           'Peeling químico',
  injetavel:         'Injetáveis',
  microagulhamento:  'Microagulhamento',
  outro:             'Outro',
};

export const protocolStatusSchema = z.enum([
  'ativo', 'pausado', 'concluido', 'cancelado',
]);
export type ProtocolStatus = z.infer<typeof protocolStatusSchema>;

export const PROTOCOL_STATUS_LABELS: Record<ProtocolStatus, string> = {
  ativo:     'Em andamento',
  pausado:   'Pausado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export const adverseSeveritySchema = z.enum(['none', 'leve', 'moderado', 'grave']);
export type AdverseSeverity = z.infer<typeof adverseSeveritySchema>;

export const ADVERSE_SEVERITY_LABELS: Record<AdverseSeverity, string> = {
  none:     'Nenhum',
  leve:     'Leve',
  moderado: 'Moderado',
  grave:    'Grave',
};

/* ── Links de produtos (vínculo com supply) ─────────────────────────────── */

export const protocolProductLinkSchema = z.object({
  productId:       z.string().uuid(),
  quantityPerSession: z.number().positive().max(9999),
  notes:           z.string().trim().max(200).optional(),
});
export type ProtocolProductLink = z.infer<typeof protocolProductLinkSchema>;

/* ── Create / Update protocolo ──────────────────────────────────────────── */

export const createProtocolSchema = z.object({
  patientId:      z.string().uuid('Paciente inválido'),
  providerId:     z.string().uuid('Profissional inválido'),
  type:           protocolTypeSchema,
  name:           z.string().trim().min(2, 'Nome do protocolo é obrigatório').max(200),
  description:    z.string().trim().max(2000).optional(),
  totalSessions:  z.number().int().positive('Total de sessões deve ser maior que zero').max(100),
  intervalDays:   z.number().int().positive('Intervalo deve ser maior que zero').max(365),
  startedAt:      z.coerce.date().optional(),
  parametersSchema: z.record(z.string(), z.unknown()).optional(),
  productLinks:   z.array(protocolProductLinkSchema).max(50).optional(),
  notes:          z.string().trim().max(2000).optional(),
});
export type CreateProtocolInput = z.infer<typeof createProtocolSchema>;

export const updateProtocolSchema = z.object({
  id:             z.string().uuid(),
  data: z.object({
    name:           z.string().trim().min(2).max(200).optional(),
    description:    z.string().trim().max(2000).nullable().optional(),
    totalSessions:  z.number().int().positive().max(100).optional(),
    intervalDays:   z.number().int().positive().max(365).optional(),
    parametersSchema: z.record(z.string(), z.unknown()).optional(),
    productLinks:   z.array(protocolProductLinkSchema).max(50).optional(),
    notes:          z.string().trim().max(2000).nullable().optional(),
  }),
});
export type UpdateProtocolInput = z.infer<typeof updateProtocolSchema>;

export const cancelProtocolSchema = z.object({
  id:     z.string().uuid(),
  reason: z.string().trim().min(3, 'Motivo obrigatório').max(500),
});
export type CancelProtocolInput = z.infer<typeof cancelProtocolSchema>;

export const pauseProtocolSchema = z.object({
  id:     z.string().uuid(),
  reason: z.string().trim().min(3, 'Motivo obrigatório').max(500),
});
export type PauseProtocolInput = z.infer<typeof pauseProtocolSchema>;

export const resumeProtocolSchema = z.object({
  id: z.string().uuid(),
});

/* ── Eventos adversos ───────────────────────────────────────────────────── */

export const adverseEventSchema = z.object({
  description: z.string().trim().min(2, 'Descrição obrigatória').max(500),
  severity:    adverseSeveritySchema.exclude(['none']),
  action:      z.string().trim().max(500).optional(),
});
export type AdverseEvent = z.infer<typeof adverseEventSchema>;

/* ── Consumo de produto por sessão ──────────────────────────────────────── */

export const sessionProductConsumptionSchema = z.object({
  productId: z.string().uuid(),
  quantity:  z.number().positive().max(9999),
  lotId:     z.string().uuid().optional(),
  notes:     z.string().trim().max(200).optional(),
});
export type SessionProductConsumption = z.infer<typeof sessionProductConsumptionSchema>;

/* ── Registrar sessão ──────────────────────────────────────────────────── */

export const registerSessionSchema = z.object({
  protocolId:       z.string().uuid(),
  appointmentId:    z.string().uuid().optional(),
  performedAt:      z.coerce.date().optional(),
  durationMin:      z.number().int().positive().max(600).optional(),
  parameters:       z.record(z.string(), z.unknown()).optional(),
  patientResponse:  z.string().trim().max(2000).optional(),
  adverseEvents:    z.array(adverseEventSchema).max(20).default([]),
  productsConsumed: z.array(sessionProductConsumptionSchema).max(40).default([]),
  preImageIds:      z.array(z.string().uuid()).max(20).default([]),
  postImageIds:     z.array(z.string().uuid()).max(20).default([]),
  outcome:          z.string().trim().max(1000).optional(),
  nextSessionNotes: z.string().trim().max(1000).optional(),
  observations:     z.string().trim().max(2000).optional(),
});
export type RegisterSessionInput = z.infer<typeof registerSessionSchema>;

export const correctSessionSchema = z.object({
  sessionId:     z.string().uuid(),
  justification: z.string().trim().min(10, 'Justificativa deve ter ao menos 10 caracteres').max(1000),
  correction:    registerSessionSchema.omit({ protocolId: true }).partial(),
});
export type CorrectSessionInput = z.infer<typeof correctSessionSchema>;

export const suggestNextSessionSchema = z.object({
  protocolId: z.string().uuid(),
});

/* ── Queries ────────────────────────────────────────────────────────────── */

export const listProtocolsByPatientSchema = z.object({
  patientId: z.string().uuid(),
  status:    protocolStatusSchema.optional(),
});
export type ListProtocolsQuery = z.infer<typeof listProtocolsByPatientSchema>;

export const getProtocolByIdSchema = z.object({
  id: z.string().uuid(),
});

export const listProtocolSessionsSchema = z.object({
  protocolId: z.string().uuid(),
});

export const getProtocolSessionByIdSchema = z.object({
  sessionId: z.string().uuid(),
});
