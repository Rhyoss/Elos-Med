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
    // tRPC httpBatchLink concatena nomes de procedure por vírgula; com 4+ procs
    // estourava o default de 100 do Fastify e retornava 404.
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

  await app.register(fastifyCors, {
    origin: env.NODE_ENV === 'development'
      ? ['http://localhost:3000']
      : [/\.dermaos\.com\.br$/],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(fastifyCookie, {
    secret: env.JWT_SECRET,
    hook: 'onRequest',
  });

  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: 'access_token',
      signed: false,
    },
  });

  await app.register(fastifyRateLimit, {
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
