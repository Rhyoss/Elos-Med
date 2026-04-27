import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../db/redis.js';
import { logger } from './logger.js';

/**
 * Rate limit em sliding-window por chave Redis. Protege endpoints sensíveis
 * da plataforma. Camadas mais externas (por IP genérico) ficam no Nginx.
 *
 * Resposta canônica em qualquer camada: 429 + JSON estruturado
 *   { error: 'rate_limit_exceeded', retry_after_seconds: <int> }
 */

interface SlidingWindowOptions {
  /** Identificador estável da bucket — incluir scope + key. Ex: 'login:ip:1.2.3.4'. */
  key:        string;
  /** Limite de requests dentro da janela. */
  max:        number;
  /** Tamanho da janela em segundos. */
  windowSec:  number;
}

interface SlidingWindowResult {
  allowed:        boolean;
  remaining:      number;
  retryAfterSec:  number;
  resetAt:        number;
}

/**
 * Sliding window via ZSET (timestamps em ms). Atomico via MULTI.
 * Mais preciso que fixed-window: não permite burst no reset da janela.
 */
async function slidingWindow(opts: SlidingWindowOptions): Promise<SlidingWindowResult> {
  const now = Date.now();
  const windowMs = opts.windowSec * 1_000;
  const cutoff = now - windowMs;
  const fullKey = `dermaos:ratelimit:${opts.key}`;

  // Pipeline atômico: remove entradas antigas, conta, adiciona, define TTL.
  const pipeline = redis.multi();
  pipeline.zremrangebyscore(fullKey, 0, cutoff);
  pipeline.zcard(fullKey);
  pipeline.zadd(fullKey, now.toString(), `${now}:${Math.random().toString(36).slice(2)}`);
  pipeline.pexpire(fullKey, windowMs);
  const results = await pipeline.exec();
  const count = (results?.[1]?.[1] as number) ?? 0;

  // count é o tamanho ANTES do zadd. allowed se count < max.
  if (count >= opts.max) {
    // Reverter zadd recente (não conta esse hit) — opcional; aqui mantemos
    // para que o cliente "queime" tentativas dentro da janela.
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil(opts.windowSec),
      resetAt: now + windowMs,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, opts.max - count - 1),
    retryAfterSec: 0,
    resetAt: now + windowMs,
  };
}

function tooManyRequests(reply: FastifyReply, retryAfterSec: number) {
  return reply
    .status(429)
    .header('Retry-After', String(retryAfterSec))
    .send({
      error: 'rate_limit_exceeded',
      retry_after_seconds: retryAfterSec,
    });
}

function setRateHeaders(reply: FastifyReply, max: number, result: SlidingWindowResult) {
  reply.header('X-RateLimit-Limit', String(max));
  reply.header('X-RateLimit-Remaining', String(result.remaining));
  reply.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1_000)));
}

// ─── Limites por endpoint sensível ───────────────────────────────────────────

const LIMITS = {
  // Login: 5 req/min por IP + 10 req/min por email
  loginIp:        { max: 5,   windowSec: 60   },
  loginEmail:     { max: 10,  windowSec: 60   },
  // Upload: 10 req/min por usuário
  upload:         { max: 10,  windowSec: 60   },
  // AI (Claude/Python): 30 req/min por tenant
  ai:             { max: 30,  windowSec: 60   },
  // LGPD export: 2 req/hora por usuário
  lgpdExport:     { max: 2,   windowSec: 3600 },
  // Reset de senha: 3 req/hora por email
  passwordReset:  { max: 3,   windowSec: 3600 },
  // Webhook inbound: 500 req/min por canal
  webhook:        { max: 500, windowSec: 60   },
  // Por usuário autenticado: 1000 req/min
  authenticated:  { max: 1000, windowSec: 60  },
} as const;

type LimitName = keyof typeof LIMITS;

function rawIp(req: FastifyRequest): string {
  // trustProxy=true: req.ip já vem decodificado de X-Forwarded-For pelo Fastify.
  return req.ip ?? '0.0.0.0';
}

/** Hook genérico: enforce + headers. Não levanta — chama reply.send. */
async function enforce(
  req: FastifyRequest,
  reply: FastifyReply,
  limitName: LimitName,
  scope: string,
): Promise<boolean> {
  const cfg = LIMITS[limitName];
  const result = await slidingWindow({
    key: `${limitName}:${scope}`,
    max: cfg.max,
    windowSec: cfg.windowSec,
  });
  setRateHeaders(reply, cfg.max, result);
  if (!result.allowed) {
    logger.warn(
      { limit: limitName, scope, ip: rawIp(req) },
      '[rate-limit] exceeded',
    );
    await tooManyRequests(reply, result.retryAfterSec);
    return false;
  }
  return true;
}

// ─── Hooks Fastify reutilizáveis ─────────────────────────────────────────────

/** Hook para POST /api/auth/login — combina IP + email. */
export async function loginRateLimit(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const ip = rawIp(req);
  const body = (req.body as { email?: string } | undefined) ?? {};
  const email = (body.email ?? '').trim().toLowerCase();

  // IP gate primeiro — se passa, checa por email (se houver)
  if (!(await enforce(req, reply, 'loginIp', ip))) return;
  if (email && !(await enforce(req, reply, 'loginEmail', email))) return;
}

/** Hook para uploads — exige usuário autenticado. */
export async function uploadRateLimit(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = (req.user as { sub?: string } | undefined)?.sub ?? rawIp(req);
  await enforce(req, reply, 'upload', userId);
}

export async function aiRateLimit(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const clinicId = (req.user as { clinicId?: string } | undefined)?.clinicId ?? rawIp(req);
  await enforce(req, reply, 'ai', clinicId);
}

/** Para tRPC: chamado dentro do middleware. Retorna resultado. */
export async function checkLgpdExportLimit(userId: string): Promise<SlidingWindowResult> {
  return slidingWindow({
    key: `lgpdExport:${userId}`,
    max: LIMITS.lgpdExport.max,
    windowSec: LIMITS.lgpdExport.windowSec,
  });
}

export async function checkPasswordResetLimit(email: string): Promise<SlidingWindowResult> {
  return slidingWindow({
    key: `passwordReset:${email.trim().toLowerCase()}`,
    max: LIMITS.passwordReset.max,
    windowSec: LIMITS.passwordReset.windowSec,
  });
}

/** Hook para webhooks — chave por canal. */
export function webhookRateLimit(channelKey: (req: FastifyRequest) => string) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const scope = channelKey(req);
    await enforce(req, reply, 'webhook', scope);
  };
}

/** Plugin global: aplica limite por usuário autenticado em /api/* (1000/min). */
export async function registerAuthenticatedRateLimit(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/') || req.url.startsWith('/api/auth/login')) return;
    // Tenta decodificar JWT silenciosamente — se houver, aplica limite por usuário
    let userId: string | null = null;
    try {
      const decoded = await req.jwtVerify<{ sub: string }>();
      userId = decoded.sub;
    } catch {
      return; // rota pública — limite por IP fica para Nginx
    }
    if (!userId) return;
    await enforce(req, reply, 'authenticated', userId);
  });
}
