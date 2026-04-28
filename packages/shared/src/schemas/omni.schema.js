"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChannelSchema = exports.linkContactToPatientSchema = exports.markReadSchema = exports.typingIndicatorSchema = exports.retryMessageSchema = exports.updateConversationStatusSchema = exports.resolveConversationSchema = exports.escalateConversationSchema = exports.assignConversationSchema = exports.sendMessageSchema = exports.listMessagesSchema = exports.listConversationsSchema = exports.assignmentFilterSchema = exports.messageStatusSchema = exports.messageContentTypeSchema = exports.messageSenderTypeSchema = exports.conversationPrioritySchema = exports.conversationStatusSchema = exports.channelTypeSchema = void 0;
const zod_1 = require("zod");
/* ── Enums alinhados com omni.* no Postgres ───────────────────────────── */
exports.channelTypeSchema = zod_1.z.enum([
    'whatsapp',
    'instagram',
    'email',
    'sms',
    'webchat',
    'phone',
]);
exports.conversationStatusSchema = zod_1.z.enum([
    'open',
    'pending',
    'resolved',
    'spam',
    'archived',
]);
exports.conversationPrioritySchema = zod_1.z.enum([
    'low',
    'normal',
    'high',
    'urgent',
]);
exports.messageSenderTypeSchema = zod_1.z.enum([
    'patient',
    'user',
    'ai_agent',
    'system',
]);
exports.messageContentTypeSchema = zod_1.z.enum([
    'text',
    'image',
    'audio',
    'video',
    'document',
    'location',
    'template',
    'interactive',
]);
exports.messageStatusSchema = zod_1.z.enum([
    'pending',
    'sent',
    'delivered',
    'read',
    'failed',
]);
exports.assignmentFilterSchema = zod_1.z.enum(['mine', 'team', 'ai', 'unassigned', 'all']);
/* ── Listagem de conversas (cursor-based) ─────────────────────────────── */
exports.listConversationsSchema = zod_1.z.object({
    channelType: exports.channelTypeSchema.optional(),
    status: exports.conversationStatusSchema.optional(),
    assignment: exports.assignmentFilterSchema.default('all'),
    search: zod_1.z.string().min(3).max(200).optional(),
    cursor: zod_1.z.string().datetime().optional(), // last_message_at ISO
    limit: zod_1.z.coerce.number().int().positive().max(100).default(30),
});
/* ── Mensagens (cursor-based — created_at DESC) ───────────────────────── */
exports.listMessagesSchema = zod_1.z.object({
    conversationId: zod_1.z.string().uuid(),
    cursor: zod_1.z.string().datetime().optional(), // created_at ISO
    limit: zod_1.z.coerce.number().int().positive().max(100).default(50),
});
/* ── Envio de mensagem ─────────────────────────────────────────────────── */
exports.sendMessageSchema = zod_1.z.object({
    conversationId: zod_1.z.string().uuid(),
    contentType: exports.messageContentTypeSchema.default('text'),
    content: zod_1.z
        .string()
        .trim()
        .min(1, 'Mensagem vazia')
        .max(4096, 'Mensagem excede o limite de 4096 caracteres'),
    mediaUrl: zod_1.z.string().url().optional(),
    isInternalNote: zod_1.z.boolean().default(false),
});
/* ── Atribuir / escalar / resolver ─────────────────────────────────────── */
exports.assignConversationSchema = zod_1.z.object({
    conversationId: zod_1.z.string().uuid(),
    assigneeId: zod_1.z.string().uuid().nullable(), // null = desatribuir
});
exports.escalateConversationSchema = zod_1.z.object({
    conversationId: zod_1.z.string().uuid(),
    toUserId: zod_1.z.string().uuid(),
    reason: zod_1.z.string().trim().min(1, 'Motivo obrigatório').max(500),
});
exports.resolveConversationSchema = zod_1.z.object({
    conversationId: zod_1.z.string().uuid(),
    reason: zod_1.z.string().trim().max(500).optional(),
});
exports.updateConversationStatusSchema = zod_1.z.object({
    conversationId: zod_1.z.string().uuid(),
    status: exports.conversationStatusSchema,
});
/* ── Retry de envio ────────────────────────────────────────────────────── */
exports.retryMessageSchema = zod_1.z.object({
    messageId: zod_1.z.string().uuid(),
});
/* ── Typing indicator ─────────────────────────────────────────────────── */
exports.typingIndicatorSchema = zod_1.z.object({
    conversationId: zod_1.z.string().uuid(),
});
/* ── Marcar como lida ─────────────────────────────────────────────────── */
exports.markReadSchema = zod_1.z.object({
    conversationId: zod_1.z.string().uuid(),
});
/* ── Link contato ↔ paciente ──────────────────────────────────────────── */
exports.linkContactToPatientSchema = zod_1.z.object({
    contactId: zod_1.z.string().uuid(),
    patientId: zod_1.z.string().uuid(),
});
/* ── Canais ────────────────────────────────────────────────────────────── */
exports.createChannelSchema = zod_1.z.object({
    type: exports.channelTypeSchema,
    name: zod_1.z.string().trim().min(1).max(100),
    config: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).default({}),
    aiAgentId: zod_1.z.string().uuid().optional(),
});
//# sourceMappingURL=omni.schema.js.map