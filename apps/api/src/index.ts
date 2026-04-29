import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { fastifyTRPCPlugin, type FastifyTRPCPluginOptions } from '@trpc/server/adapters/fastify';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { db, checkDatabaseHealth } from './db/client.js';
import { redis, connectRedis, checkRedisHealth } from './db/redis.js';
import { appRouter, type AppRouter } from './trpc/router.js';
import { createContext } from './trpc/context.js';
import { initSocketGateway } from './lib/socket.js';
import { ensureClinicalImagesBucket, ensurePrescriptionsBucket, ensureProductImagesBucket } from './lib/minio.js';
import { registerLesionUploadRoute } from './modules/clinical/lesions/upload.route.js';
import { registerProductPhotoUploadRoute } from './modules/supply/product-photo.upload.route.js';
import { ensureProductCollection } from './lib/typesense.js';
import { registerOmniWebhookRoutes } from './modules/omni/webhooks.route.js';
import { registerAuroraKnowledgeUploadRoute } from './modules/aurora/admin/upload.route.js';
import { subscribeOmniRealtime } from './modules/omni/omni.pubsub.js';
import { subscribeSupplyRealtime } from './modules/supply/supply.pubsub.js';

async function bootstrap() {
  const app = Fastify({
    logger: false, // Usamos pino diretamente
    trustProxy: true,
    maxParamLength: 5000,
  });

  // ─── Plugins de segurança ──────────────────────────────────────────────────
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  // SEC-08: lista explícita de origins. Em produção, exige CORS_ORIGINS
  // (CSV) — refuses regex aberto que aceita qualquer subdomínio.
  const corsOrigins = env.NODE_ENV === 'development'
    ? ['http://localhost:3000']
    : env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);

  if (env.NODE_ENV !== 'development' && corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS obrigatório em produção (SEC-08)');
  }

  await app.register(fastifyCors, {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // SEC-07: COOKIE_SECRET é distinto de JWT_SECRET
  await app.register(fastifyCookie, {
    secret: env.COOKIE_SECRET,
    hook: 'onRequest',
  });

  // SEC-06: dois plugins JWT em namespaces separados — chaves distintas,
  // rotacionáveis independentemente; access tokens não podem ser
  // reapresentados como refresh tokens (e vice-versa) mesmo com
  // adulteração do payload `type`.
  await app.register(fastifyJwt, {
    namespace: 'access',
    secret: env.JWT_SECRET,
    sign: {
      iss:      'dermaos-api',
      aud:      'dermaos-staff',
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    },
    verify: { allowedIss: 'dermaos-api', allowedAud: 'dermaos-staff' },
    cookie: {
      cookieName: 'access_token',
      signed: false,
    },
  });

  await app.register(fastifyJwt, {
    namespace: 'refresh',
    secret: env.JWT_REFRESH_SECRET,
    sign: {
      iss:      'dermaos-api',
      aud:      'dermaos-refresh',
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    },
    verify: { allowedIss: 'dermaos-api', allowedAud: 'dermaos-refresh' },
  });

  // SEC-21: namespace dedicado ao Patient Portal. Tokens com aud=patient
  // NÃO podem ser usados em rotas de staff. (Mesmo segredo do `access`
  // mas audience distinta — a verificação de aud impede o cross-use.)
  await app.register(fastifyJwt, {
    namespace: 'patient',
    secret: env.JWT_SECRET,
    sign: {
      iss:      'dermaos-api',
      aud:      'dermaos-patient',
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    },
    verify: { allowedIss: 'dermaos-api', allowedAud: 'dermaos-patient' },
    cookie: {
      cookieName: 'patient_access_token',
      signed: false,
    },
  });

  await app.register(fastifyRateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    redis,
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Muitas requisições. Tente novamente em instantes.',
    }),
  });

  // SEC-09: rate limit específico para os paths reais do tRPC de auth.
  // O nginx-level rate limit aponta para `/api/auth/login` (path inexistente);
  // os endpoints reais são `/api/trpc/auth.login`, etc.
  await app.register(async (scoped) => {
    const authRouteRegex = /^\/api\/trpc\/auth\.(login|forgotPassword|resetPassword)\b/;
    scoped.addHook('onRequest', async (req, reply) => {
      if (!authRouteRegex.test(req.url)) return;
      // Limit: 5/min por IP. Usa o mesmo backend Redis.
      const key = `auth_rl:${req.ip}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, 60);
      if (count > 5) {
        return reply.status(429).send({
          error: 'Too Many Requests',
          message: 'Muitas tentativas de autenticação. Aguarde 1 minuto.',
        });
      }
    });
  });

  // ─── REST: upload de imagens clínicas (multipart) ─────────────────────────
  await registerLesionUploadRoute(app);

  // ─── REST: upload de foto de produto (DermSupply) ─────────────────────────
  await registerProductPhotoUploadRoute(app);

  // ─── REST: upload de documentos da knowledge base da Aurora (multipart) ───
  await registerAuroraKnowledgeUploadRoute(app);

  // ─── REST: webhooks dos canais de comunicação (WhatsApp/IG/Telegram/Email) ─
  await registerOmniWebhookRoutes(app);

  // ─── tRPC ──────────────────────────────────────────────────────────────────
  await app.register(fastifyTRPCPlugin, {
    prefix: '/api/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError: ({ path, error }) => {
        if (error.code === 'INTERNAL_SERVER_ERROR') {
          logger.error({ path, err: error }, 'tRPC internal error');
        }
      },
    } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
  });

  // ─── Health checks ─────────────────────────────────────────────────────────

  // Liveness — processo está vivo
  app.get('/health', async (_req, reply) => {
    return reply.status(200).send({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Readiness — dependências estão prontas
  app.get('/ready', async (_req, reply) => {
    const [dbOk, redisOk] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const healthy = dbOk && redisOk;

    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? 'ready' : 'degraded',
      checks: {
        database: dbOk ? 'ok' : 'fail',
        redis: redisOk ? 'ok' : 'fail',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // ─── Graceful shutdown ─────────────────────────────────────────────────────

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully');
    try {
      await app.close();
      await db.end();
      redis.disconnect();
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // ─── Start ─────────────────────────────────────────────────────────────────

  await connectRedis();
  await ensureClinicalImagesBucket();
  await ensurePrescriptionsBucket();
  await ensureProductImagesBucket();
  await ensureProductCollection();

  await app.listen({ port: env.PORT, host: '0.0.0.0' });

  // Inicializa Socket.io DEPOIS do listen — precisa do http.Server pronto
  initSocketGateway(app);

  // Relay de eventos vindos do worker (mensagens recebidas via webhook)
  await subscribeOmniRealtime();

  // Relay de alertas de estoque/validade emitidos pelo worker diário
  await subscribeSupplyRealtime();

  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'DermaOS API running');
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal error during bootstrap');
  process.exit(1);
});
