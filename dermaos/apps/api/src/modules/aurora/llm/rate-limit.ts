/**
 * Rate limit por clínica para chamadas de LLM da Aurora — Anexo A §A.3.3.
 *
 * Token bucket via Redis: 30 requisições por minuto por `clinicId`.
 * Implementação com INCR + EXPIRE (janela fixa) — suficiente para o volume
 * esperado e 1 RTT por tentativa. Em estouro: devolve `allowed=false` e o
 * caller deve decidir ou B.3.9 (técnico) ou reenfileirar com backoff.
 *
 * Chave: `aurora:rl:{clinicId}:{minute-bucket}` — TTL 2min (cobre jitter
 * de clock entre processos).
 */

import type Redis from 'ioredis';

export const AURORA_RATE_LIMIT_PER_MINUTE = 30;
const KEY_TTL_SECONDS = 120;

export interface RateLimitResult {
  allowed:   boolean;
  remaining: number;
  resetAt:   number;   // epoch ms — quando o bucket zera
  limit:     number;
}

function bucketKey(clinicId: string, now: number): string {
  const minuteBucket = Math.floor(now / 60_000);
  return `aurora:rl:${clinicId}:${minuteBucket}`;
}

/**
 * Consome 1 token. Se estouro, retorna allowed=false sem decrementar.
 *
 * Implementação: INCR na chave do minuto atual; se for a primeira vez
 * nesse bucket, seta EXPIRE. O chamador nunca faz DECR — a janela fixa
 * é aceitável para o volume de picos previsto (<30/min por clínica).
 */
export async function consumeAuroraToken(
  redis:    Redis,
  clinicId: string,
  limit:    number = AURORA_RATE_LIMIT_PER_MINUTE,
  now:      number = Date.now(),
): Promise<RateLimitResult> {
  const key = bucketKey(clinicId, now);

  const pipeline = redis.multi();
  pipeline.incr(key);
  pipeline.expire(key, KEY_TTL_SECONDS, 'NX');
  const results = await pipeline.exec();

  // `exec()` retorna Array<[Error | null, unknown]> | null.
  const count = Number(results?.[0]?.[1] ?? 0);
  const resetAt = (Math.floor(now / 60_000) + 1) * 60_000;

  if (count > limit) {
    return {
      allowed:   false,
      remaining: 0,
      resetAt,
      limit,
    };
  }

  return {
    allowed:   true,
    remaining: Math.max(0, limit - count),
    resetAt,
    limit,
  };
}
