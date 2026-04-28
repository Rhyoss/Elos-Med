"use strict";
/**
 * Schemas da Aurora — painel de gestão (Fase 4).
 *
 * Contratos validados tanto no backend (tRPC + Fastify) quanto no frontend
 * (react-hook-form). Mantidos em `@dermaos/shared` para que ambos compartilhem
 * exatamente a mesma definição.
 *
 * Referências:
 *   - Anexo A §A.1.2 — modelos `AiAgent`, `AiKnowledgeBase`, `Channel`
 *   - Anexo B §B.1   — taxonomia de intenções e tools
 *   - Prompt Fase 4  — §1.1, §1.2, §1.3, §1.4, §3.5
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.channelTypeSchema = exports.testEscalationSchema = exports.metricsInputSchema = exports.metricsPeriodSchema = exports.confirmEmbeddingSchema = exports.uploadPreviewSchema = exports.reembedKnowledgeSchema = exports.deleteKnowledgeSchema = exports.getKnowledgeSchema = exports.listKnowledgeSchema = exports.previewAgentSchema = exports.unlinkChannelSchema = exports.linkChannelSchema = exports.listAgentsSchema = exports.getAgentSchema = exports.deleteAgentSchema = exports.toggleAgentSchema = exports.updateAgentSchema = exports.createAgentSchema = exports.aiAgentConfigSchema = exports.escalationRuleSchema = exports.escalationActionSchema = exports.escalationConditionSchema = exports.operatingHoursSchema = exports.embeddingStatusSchema = exports.auroraIntentSchema = exports.aiAgentToolSchema = exports.aiAgentModelSchema = exports.aiAgentTypeSchema = void 0;
const zod_1 = require("zod");
const omni_schema_1 = require("./omni.schema");
Object.defineProperty(exports, "channelTypeSchema", { enumerable: true, get: function () { return omni_schema_1.channelTypeSchema; } });
/* ── Enums da Aurora ────────────────────────────────────────────────────── */
exports.aiAgentTypeSchema = zod_1.z.enum([
    'receptionist',
    'scheduler',
    'follow_up',
    'support',
    'custom',
]);
exports.aiAgentModelSchema = zod_1.z.enum([
    'claude-haiku-4-5',
    'claude-sonnet-4-20250514',
    'ollama:llama3.1:8b',
]);
exports.aiAgentToolSchema = zod_1.z.enum([
    'consultarHorarios',
    'reservarSlot',
    'confirmarAgendamento',
    'cancelarAgendamento',
    'buscarAppointmentDoContato',
    'consultarKnowledgeBase',
    'transferirParaHumano',
]);
exports.auroraIntentSchema = zod_1.z.enum([
    'saudacao',
    'agendar_consulta',
    'remarcar_consulta',
    'cancelar_consulta',
    'confirmar_consulta',
    'consultar_horarios',
    'informacoes_clinica',
    'duvida_procedimento',
    'pos_atendimento',
    'emergencia',
    'fora_de_escopo',
]);
exports.embeddingStatusSchema = zod_1.z.enum([
    'pending',
    'processing',
    'completed',
    'failed',
]);
/* ── Horário de operação ────────────────────────────────────────────────── */
/**
 * Formato canônico: `HH:mm-HH:mm` (ex: "08:00-18:00"). `null` = dia fechado.
 * Chaves aceitas — Anexo B §B.1.2:
 *   mon, tue, wed, thu, fri, sat, sun (dias individuais)
 *   mon-fri (atalho — substitui os 5 dias)
 */
const timeRangeRegex = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;
exports.operatingHoursSchema = zod_1.z
    .object({
    'mon-fri': zod_1.z.string().regex(timeRangeRegex).nullable().optional(),
    mon: zod_1.z.string().regex(timeRangeRegex).nullable().optional(),
    tue: zod_1.z.string().regex(timeRangeRegex).nullable().optional(),
    wed: zod_1.z.string().regex(timeRangeRegex).nullable().optional(),
    thu: zod_1.z.string().regex(timeRangeRegex).nullable().optional(),
    fri: zod_1.z.string().regex(timeRangeRegex).nullable().optional(),
    sat: zod_1.z.string().regex(timeRangeRegex).nullable().optional(),
    sun: zod_1.z.string().regex(timeRangeRegex).nullable().optional(),
})
    .strict()
    .default({});
/* ── Regras de escalação ────────────────────────────────────────────────── */
exports.escalationConditionSchema = zod_1.z.object({
    type: zod_1.z.enum([
        'sentiment',
        'intent',
        'keyword',
        'time_of_day',
        'unresolved_messages',
    ]),
    operator: zod_1.z.enum([
        'equals',
        'not_equals',
        'contains',
        'greater_than',
    ]),
    value: zod_1.z.union([zod_1.z.string().min(1).max(200), zod_1.z.number()]),
});
exports.escalationActionSchema = zod_1.z.object({
    type: zod_1.z.enum([
        'escalate_to_role',
        'mark_urgent',
        'notify_internal',
    ]),
    target_role: zod_1.z
        .enum(['receptionist', 'dermatologist', 'admin'])
        .optional(),
    notify_channel: zod_1.z
        .enum(['socket', 'email'])
        .optional(),
});
exports.escalationRuleSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    priority: zod_1.z.number().int().min(1).max(99),
    name: zod_1.z.string().min(1).max(120),
    isActive: zod_1.z.boolean().default(true),
    conditions: zod_1.z.array(exports.escalationConditionSchema).min(1).max(10),
    action: exports.escalationActionSchema,
});
/* ── config JSONB do agente ─────────────────────────────────────────────── */
exports.aiAgentConfigSchema = zod_1.z.object({
    operating_hours: exports.operatingHoursSchema.optional(),
    escalation_rules: zod_1.z.array(exports.escalationRuleSchema).default([]),
    /** SLA em minutos para resposta humana após escalar. */
    sla_minutes: zod_1.z.number().int().min(1).max(1440).optional(),
});
/* ── CRUD Agents ────────────────────────────────────────────────────────── */
const nameField = zod_1.z.string().trim().min(3).max(100);
const systemPromptField = zod_1.z.string().max(16_000).optional();
exports.createAgentSchema = zod_1.z.object({
    name: nameField,
    type: exports.aiAgentTypeSchema,
    model: exports.aiAgentModelSchema,
    systemPrompt: systemPromptField,
    temperature: zod_1.z.number().min(0).max(1).default(0.30),
    maxTokens: zod_1.z.number().int().min(100).max(2000).default(800),
    toolsEnabled: zod_1.z.array(exports.aiAgentToolSchema).default([]),
    config: exports.aiAgentConfigSchema.optional(),
});
exports.updateAgentSchema = exports.createAgentSchema.partial().extend({
    id: zod_1.z.string().uuid(),
});
exports.toggleAgentSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    isActive: zod_1.z.boolean(),
});
exports.deleteAgentSchema = zod_1.z.object({ id: zod_1.z.string().uuid() });
exports.getAgentSchema = zod_1.z.object({ id: zod_1.z.string().uuid() });
exports.listAgentsSchema = zod_1.z.object({}).optional();
/* ── Canais ─────────────────────────────────────────────────────────────── */
exports.linkChannelSchema = zod_1.z.object({
    agentId: zod_1.z.string().uuid(),
    channelId: zod_1.z.string().uuid(),
});
exports.unlinkChannelSchema = zod_1.z.object({
    channelId: zod_1.z.string().uuid(),
});
/* ── Preview ────────────────────────────────────────────────────────────── */
const previewMessageSchema = zod_1.z.object({
    role: zod_1.z.enum(['user', 'assistant']),
    content: zod_1.z.string().min(1).max(2000),
});
exports.previewAgentSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    messages: zod_1.z.array(previewMessageSchema).min(1).max(20),
});
/* ── Knowledge base ─────────────────────────────────────────────────────── */
exports.listKnowledgeSchema = zod_1.z.object({
    agentId: zod_1.z.string().uuid(),
});
exports.getKnowledgeSchema = zod_1.z.object({
    agentId: zod_1.z.string().uuid(),
    id: zod_1.z.string().uuid(),
});
exports.deleteKnowledgeSchema = zod_1.z.object({
    agentId: zod_1.z.string().uuid(),
    id: zod_1.z.string().uuid(),
});
exports.reembedKnowledgeSchema = zod_1.z.object({
    agentId: zod_1.z.string().uuid(),
    id: zod_1.z.string().uuid(),
});
/** Para o preview de upload — volta do endpoint multipart. */
exports.uploadPreviewSchema = zod_1.z.object({
    documentId: zod_1.z.string().uuid(),
    title: zod_1.z.string().max(200),
    extractedText: zod_1.z.string().max(50_000),
    originalFilename: zod_1.z.string().max(255),
    fileSizeBytes: zod_1.z.number().int().nonnegative(),
    mimeType: zod_1.z.string().max(100),
});
exports.confirmEmbeddingSchema = zod_1.z.object({
    agentId: zod_1.z.string().uuid(),
    documentId: zod_1.z.string().uuid(),
    title: zod_1.z.string().trim().min(1).max(200).optional(),
});
/* ── Métricas ───────────────────────────────────────────────────────────── */
exports.metricsPeriodSchema = zod_1.z.enum(['7d', '30d', '90d']);
exports.metricsInputSchema = zod_1.z.object({
    agentId: zod_1.z.string().uuid(),
    period: exports.metricsPeriodSchema.default('7d'),
});
/* ── Teste de escalação ─────────────────────────────────────────────────── */
exports.testEscalationSchema = zod_1.z.object({
    agentId: zod_1.z.string().uuid(),
    message: zod_1.z.string().trim().min(1).max(2000),
});
//# sourceMappingURL=aurora-admin.schema.js.map