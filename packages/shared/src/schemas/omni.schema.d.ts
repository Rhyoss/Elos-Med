import { z } from 'zod';
export declare const channelTypeSchema: z.ZodEnum<["whatsapp", "instagram", "email", "sms", "webchat", "phone"]>;
export declare const conversationStatusSchema: z.ZodEnum<["open", "pending", "resolved", "spam", "archived"]>;
export declare const conversationPrioritySchema: z.ZodEnum<["low", "normal", "high", "urgent"]>;
export declare const messageSenderTypeSchema: z.ZodEnum<["patient", "user", "ai_agent", "system"]>;
export declare const messageContentTypeSchema: z.ZodEnum<["text", "image", "audio", "video", "document", "location", "template", "interactive"]>;
export declare const messageStatusSchema: z.ZodEnum<["pending", "sent", "delivered", "read", "failed"]>;
export declare const assignmentFilterSchema: z.ZodEnum<["mine", "team", "ai", "unassigned", "all"]>;
export declare const listConversationsSchema: z.ZodObject<{
    channelType: z.ZodOptional<z.ZodEnum<["whatsapp", "instagram", "email", "sms", "webchat", "phone"]>>;
    status: z.ZodOptional<z.ZodEnum<["open", "pending", "resolved", "spam", "archived"]>>;
    assignment: z.ZodDefault<z.ZodEnum<["mine", "team", "ai", "unassigned", "all"]>>;
    search: z.ZodOptional<z.ZodString>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    assignment: "mine" | "team" | "ai" | "unassigned" | "all";
    status?: "resolved" | "pending" | "open" | "spam" | "archived" | undefined;
    search?: string | undefined;
    channelType?: "email" | "phone" | "whatsapp" | "sms" | "instagram" | "webchat" | undefined;
    cursor?: string | undefined;
}, {
    status?: "resolved" | "pending" | "open" | "spam" | "archived" | undefined;
    search?: string | undefined;
    limit?: number | undefined;
    channelType?: "email" | "phone" | "whatsapp" | "sms" | "instagram" | "webchat" | undefined;
    assignment?: "mine" | "team" | "ai" | "unassigned" | "all" | undefined;
    cursor?: string | undefined;
}>;
export type ListConversationsInput = z.infer<typeof listConversationsSchema>;
export declare const listMessagesSchema: z.ZodObject<{
    conversationId: z.ZodString;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    conversationId: string;
    cursor?: string | undefined;
}, {
    conversationId: string;
    limit?: number | undefined;
    cursor?: string | undefined;
}>;
export type ListMessagesInput = z.infer<typeof listMessagesSchema>;
export declare const sendMessageSchema: z.ZodObject<{
    conversationId: z.ZodString;
    contentType: z.ZodDefault<z.ZodEnum<["text", "image", "audio", "video", "document", "location", "template", "interactive"]>>;
    content: z.ZodString;
    mediaUrl: z.ZodOptional<z.ZodString>;
    isInternalNote: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    conversationId: string;
    contentType: "text" | "image" | "audio" | "video" | "document" | "location" | "template" | "interactive";
    content: string;
    isInternalNote: boolean;
    mediaUrl?: string | undefined;
}, {
    conversationId: string;
    content: string;
    contentType?: "text" | "image" | "audio" | "video" | "document" | "location" | "template" | "interactive" | undefined;
    mediaUrl?: string | undefined;
    isInternalNote?: boolean | undefined;
}>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export declare const assignConversationSchema: z.ZodObject<{
    conversationId: z.ZodString;
    assigneeId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    conversationId: string;
    assigneeId: string | null;
}, {
    conversationId: string;
    assigneeId: string | null;
}>;
export type AssignConversationInput = z.infer<typeof assignConversationSchema>;
export declare const escalateConversationSchema: z.ZodObject<{
    conversationId: z.ZodString;
    toUserId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    conversationId: string;
    toUserId: string;
}, {
    reason: string;
    conversationId: string;
    toUserId: string;
}>;
export type EscalateConversationInput = z.infer<typeof escalateConversationSchema>;
export declare const resolveConversationSchema: z.ZodObject<{
    conversationId: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    conversationId: string;
    reason?: string | undefined;
}, {
    conversationId: string;
    reason?: string | undefined;
}>;
export type ResolveConversationInput = z.infer<typeof resolveConversationSchema>;
export declare const updateConversationStatusSchema: z.ZodObject<{
    conversationId: z.ZodString;
    status: z.ZodEnum<["open", "pending", "resolved", "spam", "archived"]>;
}, "strip", z.ZodTypeAny, {
    status: "resolved" | "pending" | "open" | "spam" | "archived";
    conversationId: string;
}, {
    status: "resolved" | "pending" | "open" | "spam" | "archived";
    conversationId: string;
}>;
export type UpdateConversationStatusInput = z.infer<typeof updateConversationStatusSchema>;
export declare const retryMessageSchema: z.ZodObject<{
    messageId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    messageId: string;
}, {
    messageId: string;
}>;
export type RetryMessageInput = z.infer<typeof retryMessageSchema>;
export declare const typingIndicatorSchema: z.ZodObject<{
    conversationId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    conversationId: string;
}, {
    conversationId: string;
}>;
export type TypingIndicatorInput = z.infer<typeof typingIndicatorSchema>;
export declare const markReadSchema: z.ZodObject<{
    conversationId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    conversationId: string;
}, {
    conversationId: string;
}>;
export type MarkReadInput = z.infer<typeof markReadSchema>;
export declare const linkContactToPatientSchema: z.ZodObject<{
    contactId: z.ZodString;
    patientId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    patientId: string;
    contactId: string;
}, {
    patientId: string;
    contactId: string;
}>;
export type LinkContactToPatientInput = z.infer<typeof linkContactToPatientSchema>;
export declare const createChannelSchema: z.ZodObject<{
    type: z.ZodEnum<["whatsapp", "instagram", "email", "sms", "webchat", "phone"]>;
    name: z.ZodString;
    config: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    aiAgentId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "email" | "phone" | "whatsapp" | "sms" | "instagram" | "webchat";
    name: string;
    config: Record<string, unknown>;
    aiAgentId?: string | undefined;
}, {
    type: "email" | "phone" | "whatsapp" | "sms" | "instagram" | "webchat";
    name: string;
    config?: Record<string, unknown> | undefined;
    aiAgentId?: string | undefined;
}>;
export type CreateChannelInput = z.infer<typeof createChannelSchema>;
//# sourceMappingURL=omni.schema.d.ts.map