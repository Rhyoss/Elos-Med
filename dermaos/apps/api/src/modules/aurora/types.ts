/**
 * Tipos compartilhados pelo módulo Aurora.
 * Evita dependência circular entre classifier/guardrails/service.
 */

export type MessageContentType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'location'
  | 'template'
  | 'interactive';

export type MessageSenderType = 'patient' | 'user' | 'ai_agent' | 'system';

/**
 * Representação mínima de uma mensagem no contexto da Aurora.
 * Os serviços concretos (omni.service, aurora.service) convertem a partir de
 * `MessageRow` para este shape antes de passar para classifier/guardrails.
 */
export interface ConversationMessage {
  id:          string;
  senderType:  MessageSenderType;
  contentType: MessageContentType;
  /** Pode ser null quando conteúdo é mídia pura. */
  content:     string | null;
  createdAt:   Date;
}

/**
 * Prioridade de conversa — subset de `omni.conversation_priority` relevante
 * para decisões da Aurora.
 */
export type AuroraTransferPriority = 'normal' | 'high' | 'urgent';
