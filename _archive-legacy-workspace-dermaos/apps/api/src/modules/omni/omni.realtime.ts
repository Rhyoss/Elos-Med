import { redis } from '../../db/redis.js';
import { emitToClinic } from '../../lib/socket.js';

/**
 * Throttle server-side para indicador de digitação:
 * no máximo 1 evento por segundo por (conversationId, userId).
 * Usa chaves Redis com TTL curto.
 */
export async function emitTyping(
  clinicId:       string,
  conversationId: string,
  userId:         string,
  userName:       string,
): Promise<void> {
  const key = `omni:typing:${clinicId}:${conversationId}:${userId}`;
  const acquired = await redis.set(key, '1', 'PX', 1_000, 'NX');
  if (acquired !== 'OK') return; // janela de 1s ainda ativa

  emitToClinic(clinicId, 'typing_indicator', {
    conversationId,
    userId,
    userName,
  });
}
