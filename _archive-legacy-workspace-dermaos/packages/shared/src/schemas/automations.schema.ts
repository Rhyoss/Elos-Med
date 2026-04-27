import { z } from 'zod';

/* ── Triggers disponíveis (enum estrito) ──────────────────────────────────── */

export const AUTOMATION_TRIGGERS = [
  'appointment_24h_before',
  'appointment_2h_before',
  'appointment_created',
  'encounter_completed',
  'biopsy_result_received',
  'invoice_overdue_7d',
  'patient_birthday',
  'lead_no_response_48h',
  'lead_score_above_80',
] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const automationTriggerSchema = z.enum(AUTOMATION_TRIGGERS);

/** Metadados do trigger — documentação inline para guiar configuração no frontend. */
export const TRIGGER_META: Record<
  AutomationTrigger,
  { label: string; description: string; variables: string[]; entityType: string }
> = {
  appointment_24h_before: {
    label:       'Lembrete 24h antes',
    description: 'Dispara 24 horas antes de uma consulta agendada. Dados disponíveis: dados do paciente, data/horário, médico, clínica.',
    variables:   ['{{nome_paciente}}', '{{data_consulta}}', '{{horario}}', '{{medico}}', '{{clinica}}', '{{telefone_clinica}}'],
    entityType:  'appointment',
  },
  appointment_2h_before: {
    label:       'Lembrete 2h antes',
    description: 'Dispara 2 horas antes de uma consulta agendada. Dados disponíveis: dados do paciente, data/horário, médico, clínica.',
    variables:   ['{{nome_paciente}}', '{{data_consulta}}', '{{horario}}', '{{medico}}', '{{clinica}}', '{{telefone_clinica}}'],
    entityType:  'appointment',
  },
  appointment_created: {
    label:       'Confirmação imediata',
    description: 'Dispara imediatamente quando uma consulta é criada. Dados disponíveis: dados do paciente, data/horário, médico, clínica.',
    variables:   ['{{nome_paciente}}', '{{data_consulta}}', '{{horario}}', '{{medico}}', '{{clinica}}', '{{telefone_clinica}}'],
    entityType:  'appointment',
  },
  encounter_completed: {
    label:       'Pós-consulta',
    description: 'Dispara quando uma consulta é finalizada. Dados disponíveis: nome do paciente, médico, clínica.',
    variables:   ['{{nome_paciente}}', '{{medico}}', '{{clinica}}', '{{telefone_clinica}}'],
    entityType:  'encounter',
  },
  biopsy_result_received: {
    label:       'Resultado de biópsia disponível',
    description: 'Dispara quando um resultado de biópsia é registrado no sistema. Dados disponíveis: nome do paciente, médico, clínica.',
    variables:   ['{{nome_paciente}}', '{{medico}}', '{{clinica}}', '{{telefone_clinica}}'],
    entityType:  'clinical_result',
  },
  invoice_overdue_7d: {
    label:       'Cobrança amigável (7 dias)',
    description: 'Dispara 7 dias após uma fatura vencer sem pagamento. Dados disponíveis: nome do paciente, clínica.',
    variables:   ['{{nome_paciente}}', '{{clinica}}', '{{telefone_clinica}}'],
    entityType:  'invoice',
  },
  patient_birthday: {
    label:       'Felicitação de aniversário',
    description: 'Dispara às 08:00 do timezone da clínica no dia do aniversário do paciente. Dados disponíveis: nome do paciente, clínica.',
    variables:   ['{{nome_paciente}}', '{{clinica}}', '{{telefone_clinica}}'],
    entityType:  'patient',
  },
  lead_no_response_48h: {
    label:       'Follow-up de lead (48h sem resposta)',
    description: 'Dispara 48 horas após um lead ser capturado sem nenhuma resposta. Dados disponíveis: nome do lead, clínica.',
    variables:   ['{{nome_paciente}}', '{{clinica}}', '{{telefone_clinica}}'],
    entityType:  'lead',
  },
  lead_score_above_80: {
    label:       'Lead qualificado (score ≥ 80)',
    description: 'Dispara notificação interna para a equipe quando um lead atinge score ≥ 80. Dados disponíveis: nome do lead, clínica.',
    variables:   ['{{nome_paciente}}', '{{clinica}}'],
    entityType:  'lead',
  },
};

/* ── Canais suportados para automações ───────────────────────────────────── */

export const AUTOMATION_CHANNELS = ['whatsapp', 'sms', 'email'] as const;
export type AutomationChannel = (typeof AUTOMATION_CHANNELS)[number];
export const automationChannelSchema = z.enum(AUTOMATION_CHANNELS);

/** Limite de caracteres por canal — exibido no editor de template. */
export const CHANNEL_CHAR_LIMITS: Record<AutomationChannel, number> = {
  whatsapp: 1024,
  sms:      160,
  email:    Infinity,
};

/* ── Variáveis de template permitidas ────────────────────────────────────── */

export const TEMPLATE_VARIABLES = [
  '{{nome_paciente}}',
  '{{data_consulta}}',
  '{{horario}}',
  '{{medico}}',
  '{{clinica}}',
  '{{telefone_clinica}}',
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

/** Dados fictícios para preview — realistas em pt-BR. */
export const TEMPLATE_PREVIEW_DATA: Record<TemplateVariable, string> = {
  '{{nome_paciente}}':   'Maria Silva',
  '{{data_consulta}}':   '15/05/2026',
  '{{horario}}':         '14:30',
  '{{medico}}':          'Dr. João Pereira',
  '{{clinica}}':         'Clínica DermaOS',
  '{{telefone_clinica}}': '(11) 99999-9999',
};

/* ── Condições ──────────────────────────────────────────────────────────── */

export const conditionOperatorSchema = z.enum([
  'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in', 'not_in', 'exists', 'not_exists',
]);

export const automationConditionSchema = z.object({
  field:    z.string().min(1).max(100),
  operator: conditionOperatorSchema,
  value:    z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
});
export type AutomationCondition = z.infer<typeof automationConditionSchema>;

/* ── Automações — CRUD schemas ────────────────────────────────────────────── */

export const createAutomationSchema = z.object({
  name:         z.string().trim().min(1, 'Nome obrigatório').max(200),
  trigger:      automationTriggerSchema,
  templateId:   z.string().uuid('Template inválido'),
  channelId:    z.string().uuid('Canal inválido'),
  delayMinutes: z.number().int().min(0, 'Delay deve ser ≥ 0').default(0),
  conditions:   z.array(automationConditionSchema).max(10).default([]),
  isActive:     z.boolean().default(true),
});
export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;

export const updateAutomationSchema = z.object({
  id:           z.string().uuid(),
  name:         z.string().trim().min(1).max(200).optional(),
  templateId:   z.string().uuid().optional(),
  channelId:    z.string().uuid().optional(),
  delayMinutes: z.number().int().min(0).optional(),
  conditions:   z.array(automationConditionSchema).max(10).optional(),
});
export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;

export const toggleAutomationSchema = z.object({
  id:       z.string().uuid(),
  isActive: z.boolean(),
});
export type ToggleAutomationInput = z.infer<typeof toggleAutomationSchema>;

export const listAutomationsSchema = z.object({
  trigger:  automationTriggerSchema.optional(),
  channel:  automationChannelSchema.optional(),
  isActive: z.boolean().optional(),
  cursor:   z.string().datetime().optional(),
  limit:    z.coerce.number().int().positive().max(100).default(50),
});
export type ListAutomationsInput = z.infer<typeof listAutomationsSchema>;

export const listExecutionLogSchema = z.object({
  automationId: z.string().uuid(),
  status:       z.enum(['processing', 'sent', 'skipped', 'failed']).optional(),
  cursor:       z.string().datetime().optional(),
  limit:        z.coerce.number().int().positive().max(100).default(50),
});
export type ListExecutionLogInput = z.infer<typeof listExecutionLogSchema>;

/* ── Templates — CRUD schemas ─────────────────────────────────────────────── */

export const createTemplateSchema = z.object({
  name:      z.string().trim().min(1, 'Nome obrigatório').max(200),
  channel:   automationChannelSchema,
  body:      z.string().trim().min(1, 'Conteúdo obrigatório').max(10_000),
  bodyHtml:  z.string().max(50_000).optional(),
  subject:   z.string().trim().max(200).optional(),
  metaHsmId: z.string().trim().max(200).optional(),
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z.object({
  id:        z.string().uuid(),
  name:      z.string().trim().min(1).max(200).optional(),
  body:      z.string().trim().min(1).max(10_000).optional(),
  bodyHtml:  z.string().max(50_000).optional(),
  subject:   z.string().trim().max(200).optional(),
  metaHsmId: z.string().trim().max(200).optional(),
});
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const listTemplatesSchema = z.object({
  channel: automationChannelSchema.optional(),
  search:  z.string().max(200).optional(),
  cursor:  z.string().datetime().optional(),
  limit:   z.coerce.number().int().positive().max(100).default(50),
});
export type ListTemplatesInput = z.infer<typeof listTemplatesSchema>;

export const previewTemplateSchema = z.object({
  body: z.string().max(10_000),
});
export type PreviewTemplateInput = z.infer<typeof previewTemplateSchema>;
