/**
 * Cache de contexto da Aurora — Anexo A §A.4.2 passo 8a.
 *
 * Armazena as últimas 20 mensagens (ASC) de uma conversa para o prompt da
 * Aurora. TTL curto (300s) porque a conversa muda continuamente; o cache
 * só serve para absorver bursts (duas mensagens seguidas do paciente).
 *
 * Miss → caller deve ler de `omni.messages` via `withClinicContext`.
 *
 * IMPORTANTE: o cache NÃO armazena PII — as mensagens aqui são as MESMAS
 * que estão em `omni.messages` (não redigidas). A redaction acontece só
 * quando o reasoner monta o prompt (§B.4.1). Portanto, garantir que apenas
 * processos com acesso a esta clínica leiam a chave (namespacing por
 * `conversationId` é suficiente — IDs são UUIDs não-enumeráveis).
 */

import type Redis from 'ioredis';

export const AURORA_CONTEXT_TTL_SECONDS = 300;
export const AURORA_CONTEXT_LIMIT = 20;

export interface CachedMessage {
  id:          string;
  senderType:  'patient' | 'ai_agent' | 'user' | 'system';
  contentType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location';
  content:     string | null;
  createdAt:   string;   // ISO
}

function cacheKey(conversationId: string): string {
  return `aurora:ctx:${conversationId}`;
}

/**
 * Lê do cache. Retorna `null` em miss — caller deve ir ao Postgres.
 */
export async function readContextCache(
  redis:          Redis,
  conversationId: string,
): Promise<CachedMessage[] | null> {
  const raw = await redis.get(cacheKey(conversationId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as CachedMessage[];
  } catch {
    return null;
  }
}

/**
 * Escreve cache (após load do Postgres). Trunca a `AURORA_CONTEXT_LIMIT` —
 * garante que excessos acidentais não explodam chaves.
 */
export async function writeContextCache(
  redis:          Redis,
  conversationId: string,
  messages:       CachedMessage[],
): Promise<void> {
  const trimmed = messages.slice(-AURORA_CONTEXT_LIMIT);
  await redis.set(
    cacheKey(conversationId),
    JSON.stringify(trimmed),
    'EX',
    AURORA_CONTEXT_TTL_SECONDS,
  );
}

/** Invalida a entrada (chamada pelo processor após persistir nova msg assistant). */
export async function invalidateContextCache(
  redis:          Redis,
  conversationId: string,
): Promise<void> {
  await redis.del(cacheKey(conversationId));
}
