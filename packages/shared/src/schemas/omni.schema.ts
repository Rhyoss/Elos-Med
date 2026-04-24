import { z } from 'zod';

/* ── Enums alinhados com omni.* no Postgres ───────────────────────────── */

export const channelTypeSchema = z.enum([
  'whatsapp',
  'instagram',
  'email',
  'sms',
  'webchat',
  'phone',
]);

export const conversationStatusSchema = z.enum([
  'open',
  'pending',
  'resolved',
  'spam',
  'archived',
]);

export const conversationPrioritySchema = z.enum([
  'low',
  'normal',
  'high',
  'urgent',
]);

export const messageSenderTypeSchema = z.enum([
  'patient',
  'user',
  'ai_agent',
  'system',
]);

export const messageContentTypeSchema = z.enum([
  'text',
  'image',
  'audio',
  'video',
  'document',
  'location',
  'template',
  'interactive',
]);

export const messageStatusSchema = z.enum([
  'pending',
  'sent',
  'delivered',
  'read',
  'failed',
]);

export const assignmentFilterSchema = z.enum(['mine', 'team', 'ai', 'unassigned', 'all']);

/* ── Listagem de conversas (cursor-based) ─────────────────────────────── */

export const listConversationsSchema = z.object({
  channelType: channelTypeSchema.optional(),
  status:      conversationStatusSchema.optional(),
  assignment:  assignmentFilterSchema.default('all'),
  search:      z.string().min(3).max(200).optional(),
  cursor:      z.string().datetime().optional(),   // last_message_at ISO
  limit:       z.coerce.number().int().positive().max(100).default(30),
});
export type ListConversationsInput = z.infer<typeof listConversationsSchema>;

/* ── Mensagens (cursor-based — created_at DESC) ───────────────────────── */

export const listMessagesSchema = z.object({
  conversationId: z.string().uuid(),
  cursor:         z.string().datetime().optional(), // created_at ISO
  limit:          z.coerce.number().int().positive().max(100).default(50),
});
export type ListMessagesInput = z.infer<typeof listMessagesSchema>;

/* ── Envio de mensagem ─────────────────────────────────────────────────── */

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  contentType:    messageContentTypeSchema.default('text'),
  content:        z
    .string()
    .trim()
    .min(1, 'Mensagem vazia')
    .max(4096, 'Mensagem excede o limite de 4096 caracteres'),
  mediaUrl:       z.string().url().optional(),
  isInternalNote: z.boolean().default(false),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/* ── Atribuir / escalar / resolver ─────────────────────────────────────── */

export const assignConversationSchema = z.object({
  conversationId: z.string().uuid(),
  assigneeId:     z.string().uuid().nullable(),   // null = desatribuir
});
export type AssignConversationInput = z.infer<typeof assignConversationSchema>;

export const escalateConversationSchema = z.object({
  conversationId: z.string().uuid(),
  toUserId:       z.string().uuid(),
  reason:         z.string().trim().min(1, 'Motivo obrigatório').max(500),
});
export type EscalateConversationInput = z.infer<typeof escalateConversationSchema>;

export const resolveConversationSchema = z.object({
  conversationId: z.string().uuid(),
  reason:         z.string().trim().max(500).optional(),
});
export type ResolveConversationInput = z.infer<typeof resolveConversationSchema>;

export const updateConversationStatusSchema = z.object({
  conversationId: z.string().uuid(),
  status:         conversationStatusSchema,
});
export type UpdateConversationStatusInput = z.infer<typeof updateConversationStatusSchema>;

/* ── Retry de envio ────────────────────────────────────────────────────── */

export const retryMessageSchema = z.object({
  messageId: z.string().uuid(),
});
export type RetryMessageInput = z.infer<typeof retryMessageSchema>;

/* ── Typing indicator ─────────────────────────────────────────────────── */

export const typingIndicatorSchema = z.object({
  conversationId: z.string().uuid(),
});
export type TypingIndicatorInput = z.infer<typeof typingIndicatorSchema>;

/* ── Marcar como lida ─────────────────────────────────────────────────── */

export const markReadSchema = z.object({
  conversationId: z.string().uuid(),
});
export type MarkReadInput = z.infer<typeof markReadSchema>;

/* ── Link contato ↔ paciente ──────────────────────────────────────────── */

export const linkContactToPatientSchema = z.object({
  contactId: z.string().uuid(),
  patientId: z.string().uuid(),
});
export type LinkContactToPatientInput = z.infer<typeof linkContactToPatientSchema>;

/* ── Canais ────────────────────────────────────────────────────────────── */

export const createChannelSchema = z.object({
  type:       channelTypeSchema,
  name:       z.string().trim().min(1).max(100),
  config:     z.record(z.string(), z.unknown()).default({}),
  aiAgentId:  z.string().uuid().optional(),
});
export type CreateChannelInput = z.infer<typeof createChannelSchema>;
