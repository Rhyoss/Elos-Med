"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.previewTemplateSchema = exports.listTemplatesSchema = exports.updateTemplateSchema = exports.createTemplateSchema = exports.listExecutionLogSchema = exports.listAutomationsSchema = exports.toggleAutomationSchema = exports.updateAutomationSchema = exports.createAutomationSchema = exports.automationConditionSchema = exports.conditionOperatorSchema = exports.TEMPLATE_PREVIEW_DATA = exports.TEMPLATE_VARIABLES = exports.CHANNEL_CHAR_LIMITS = exports.automationChannelSchema = exports.AUTOMATION_CHANNELS = exports.TRIGGER_META = exports.automationTriggerSchema = exports.AUTOMATION_TRIGGERS = void 0;
const zod_1 = require("zod");
/* ── Triggers disponíveis (enum estrito) ──────────────────────────────────── */
exports.AUTOMATION_TRIGGERS = [
    'appointment_24h_before',
    'appointment_2h_before',
    'appointment_created',
    'encounter_completed',
    'biopsy_result_received',
    'invoice_overdue_7d',
    'patient_birthday',
    'lead_no_response_48h',
    'lead_score_above_80',
];
exports.automationTriggerSchema = zod_1.z.enum(exports.AUTOMATION_TRIGGERS);
/** Metadados do trigger — documentação inline para guiar configuração no frontend. */
exports.TRIGGER_META = {
    appointment_24h_before: {
        label: 'Lembrete 24h antes',
        description: 'Dispara 24 horas antes de uma consulta agendada. Dados disponíveis: dados do paciente, data/horário, médico, clínica.',
        variables: ['{{nome_paciente}}', '{{data_consulta}}', '{{horario}}', '{{medico}}', '{{clinica}}', '{{telefone_clinica}}'],
        entityType: 'appointment',
    },
    appointment_2h_before: {
        label: 'Lembrete 2h antes',
        description: 'Dispara 2 horas antes de uma consulta agendada. Dados disponíveis: dados do paciente, data/horário, médico, clínica.',
        variables: ['{{nome_paciente}}', '{{data_consulta}}', '{{horario}}', '{{medico}}', '{{clinica}}', '{{telefone_clinica}}'],
        entityType: 'appointment',
    },
    appointment_created: {
        label: 'Confirmação imediata',
        description: 'Dispara imediatamente quando uma consulta é criada. Dados disponíveis: dados do paciente, data/horário, médico, clínica.',
        variables: ['{{nome_paciente}}', '{{data_consulta}}', '{{horario}}', '{{medico}}', '{{clinica}}', '{{telefone_clinica}}'],
        entityType: 'appointment',
    },
    encounter_completed: {
        label: 'Pós-consulta',
        description: 'Dispara quando uma consulta é finalizada. Dados disponíveis: nome do paciente, médico, clínica.',
        variables: ['{{nome_paciente}}', '{{medico}}', '{{clinica}}', '{{telefone_clinica}}'],
        entityType: 'encounter',
    },
    biopsy_result_received: {
        label: 'Resultado de biópsia disponível',
        description: 'Dispara quando um resultado de biópsia é registrado no sistema. Dados disponíveis: nome do paciente, médico, clínica.',
        variables: ['{{nome_paciente}}', '{{medico}}', '{{clinica}}', '{{telefone_clinica}}'],
        entityType: 'clinical_result',
    },
    invoice_overdue_7d: {
        label: 'Cobrança amigável (7 dias)',
        description: 'Dispara 7 dias após uma fatura vencer sem pagamento. Dados disponíveis: nome do paciente, clínica.',
        variables: ['{{nome_paciente}}', '{{clinica}}', '{{telefone_clinica}}'],
        entityType: 'invoice',
    },
    patient_birthday: {
        label: 'Felicitação de aniversário',
        description: 'Dispara às 08:00 do timezone da clínica no dia do aniversário do paciente. Dados disponíveis: nome do paciente, clínica.',
        variables: ['{{nome_paciente}}', '{{clinica}}', '{{telefone_clinica}}'],
        entityType: 'patient',
    },
    lead_no_response_48h: {
        label: 'Follow-up de lead (48h sem resposta)',
        description: 'Dispara 48 horas após um lead ser capturado sem nenhuma resposta. Dados disponíveis: nome do lead, clínica.',
        variables: ['{{nome_paciente}}', '{{clinica}}', '{{telefone_clinica}}'],
        entityType: 'lead',
    },
    lead_score_above_80: {
        label: 'Lead qualificado (score ≥ 80)',
        description: 'Dispara notificação interna para a equipe quando um lead atinge score ≥ 80. Dados disponíveis: nome do lead, clínica.',
        variables: ['{{nome_paciente}}', '{{clinica}}'],
        entityType: 'lead',
    },
};
/* ── Canais suportados para automações ───────────────────────────────────── */
exports.AUTOMATION_CHANNELS = ['whatsapp', 'sms', 'email'];
exports.automationChannelSchema = zod_1.z.enum(exports.AUTOMATION_CHANNELS);
/** Limite de caracteres por canal — exibido no editor de template. */
exports.CHANNEL_CHAR_LIMITS = {
    whatsapp: 1024,
    sms: 160,
    email: Infinity,
};
/* ── Variáveis de template permitidas ────────────────────────────────────── */
exports.TEMPLATE_VARIABLES = [
    '{{nome_paciente}}',
    '{{data_consulta}}',
    '{{horario}}',
    '{{medico}}',
    '{{clinica}}',
    '{{telefone_clinica}}',
];
/** Dados fictícios para preview — realistas em pt-BR. */
exports.TEMPLATE_PREVIEW_DATA = {
    '{{nome_paciente}}': 'Maria Silva',
    '{{data_consulta}}': '15/05/2026',
    '{{horario}}': '14:30',
    '{{medico}}': 'Dr. João Pereira',
    '{{clinica}}': 'Clínica DermaOS',
    '{{telefone_clinica}}': '(11) 99999-9999',
};
/* ── Condições ──────────────────────────────────────────────────────────── */
exports.conditionOperatorSchema = zod_1.z.enum([
    'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in', 'not_in', 'exists', 'not_exists',
]);
exports.automationConditionSchema = zod_1.z.object({
    field: zod_1.z.string().min(1).max(100),
    operator: exports.conditionOperatorSchema,
    value: zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean(), zod_1.z.array(zod_1.z.string())]).optional(),
});
/* ── Automações — CRUD schemas ────────────────────────────────────────────── */
exports.createAutomationSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, 'Nome obrigatório').max(200),
    trigger: exports.automationTriggerSchema,
    templateId: zod_1.z.string().uuid('Template inválido'),
    channelId: zod_1.z.string().uuid('Canal inválido'),
    delayMinutes: zod_1.z.number().int().min(0, 'Delay deve ser ≥ 0').default(0),
    conditions: zod_1.z.array(exports.automationConditionSchema).max(10).default([]),
    isActive: zod_1.z.boolean().default(true),
});
exports.updateAutomationSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().trim().min(1).max(200).optional(),
    templateId: zod_1.z.string().uuid().optional(),
    channelId: zod_1.z.string().uuid().optional(),
    delayMinutes: zod_1.z.number().int().min(0).optional(),
    conditions: zod_1.z.array(exports.automationConditionSchema).max(10).optional(),
});
exports.toggleAutomationSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    isActive: zod_1.z.boolean(),
});
exports.listAutomationsSchema = zod_1.z.object({
    trigger: exports.automationTriggerSchema.optional(),
    channel: exports.automationChannelSchema.optional(),
    isActive: zod_1.z.boolean().optional(),
    cursor: zod_1.z.string().datetime().optional(),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(50),
});
exports.listExecutionLogSchema = zod_1.z.object({
    automationId: zod_1.z.string().uuid(),
    status: zod_1.z.enum(['processing', 'sent', 'skipped', 'failed']).optional(),
    cursor: zod_1.z.string().datetime().optional(),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(50),
});
/* ── Templates — CRUD schemas ─────────────────────────────────────────────── */
exports.createTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, 'Nome obrigatório').max(200),
    channel: exports.automationChannelSchema,
    body: zod_1.z.string().trim().min(1, 'Conteúdo obrigatório').max(10_000),
    bodyHtml: zod_1.z.string().max(50_000).optional(),
    subject: zod_1.z.string().trim().max(200).optional(),
    metaHsmId: zod_1.z.string().trim().max(200).optional(),
});
exports.updateTemplateSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().trim().min(1).max(200).optional(),
    body: zod_1.z.string().trim().min(1).max(10_000).optional(),
    bodyHtml: zod_1.z.string().max(50_000).optional(),
    subject: zod_1.z.string().trim().max(200).optional(),
    metaHsmId: zod_1.z.string().trim().max(200).optional(),
});
exports.listTemplatesSchema = zod_1.z.object({
    channel: exports.automationChannelSchema.optional(),
    search: zod_1.z.string().max(200).optional(),
    cursor: zod_1.z.string().datetime().optional(),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(50),
});
exports.previewTemplateSchema = zod_1.z.object({
    body: zod_1.z.string().max(10_000),
});
//# sourceMappingURL=automations.schema.js.map