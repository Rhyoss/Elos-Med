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
import correlationPlugin from './lib/correlation.js';
import { recordHttpRequest, normalizeRoute, renderPrometheusMetrics } from './lib/prometheus.js';
import { db, checkDatabaseHealth } from './db/client.js';
import { redis, connectRedis, checkRedisHealth } from './db/redis.js';
import { minio } from './lib/minio.js';
import { appRouter, type AppRouter } from './trpc/router.js';
import { createContext } from './trpc/context.js';
import { initSocketGateway } from './lib/socket.js';
import { ensureClinicalImagesBucket, ensurePrescriptionsBucket, ensureProductImagesBucket, ensureClinicAssetsBucket, ensureLgpdExportsBucket } from './lib/minio.js';
import { registerAuthenticatedRateLimit } from './lib/rate-limit.js';
import { registerLesionUploadRoute } from './modules/clinical/lesions/upload.route.js';
import { registerClinicLogoUploadRoute } from './modules/settings/logo.route.js';
import { registerProductPhotoUploadRoute } from './modules/supply/product-photo.upload.route.js';
import { ensureProductCollection } from './lib/typesense.js';
import { registerOmniWebhookRoutes } from './modules/omni/webhooks.route.js';
import { registerAuroraKnowledgeUploadRoute } from './modules/aurora/admin/upload.route.js';
import { subscribeSupplyRealtime } from './modules/supply/supply.pubsub.js';
import { subscribeInboxRealtime } from './realtime/inbox.handler.js';
import { initQueueHandler } from './realtime/queue.handler.js';
import { initNotificationsHandler } from './realtime/notifications.handler.js';
import { initAlertsHandler } from './realtime/alerts.handler.js';
import { subscribeNotificationEvents } from './modules/notifications/notifications.pubsub.js';
import { getTotalConnections } from './realtime/metrics.js';
import { registerPortalPlugin } from './modules/patient-portal/portal.plugin.js';
import { registerAnalyticsEventsRoute } from './modules/analytics/events.route.js';

// ─── Health check helpers ─────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function checkMinioHealth(): Promise<boolean> {
  try {
    await minio.bucketExists('clinical-images');
    return true;
  } catch {
    return false;
  }
}

async function checkTypesenseHealth(): Promise<boolean> {
  try {
    const url = `http://${env.TYPESENSE_HOST}:${env.TYPESENSE_PORT}/health`;
    const res = await fetch(url, { headers: { 'X-TYPESENSE-API-KEY': env.TYPESENSE_API_KEY } });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkOllamaHealth(): Promise<boolean | null> {
  const base = env.OLLAMA_BASE_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/tags`);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── /metrics auth ────────────────────────────────────────────────────────────

function isMetricsAuthorized(clientIp: string, authHeader: string | undefined): boolean {
  // Check IP allowlist first
  const allowed = (env.METRICS_ALLOWED_IPS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowed.length > 0 && allowed.includes(clientIp)) return true;

  // Fall back to Basic Auth
  if (env.METRICS_USERNAME && env.METRICS_PASSWORD && authHeader?.startsWith('Basic ')) {
    const decoded   = Buffer.from(authHeader.slice(6), 'base64').toString();
    const colonIdx  = decoded.indexOf(':');
    if (colonIdx === -1) return false;
    const user = decoded.slice(0, colonIdx);
    const pass = decoded.slice(colonIdx + 1);
    return user === env.METRICS_USERNAME && pass === env.METRICS_PASSWORD;
  }

  return false;
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap() {
  const app = Fastify({
    logger: false, // We use pino directly
    trustProxy: true,
    // tRPC junta nomes de procedimento por vírgula no path (ex.:
    // `/api/trpc/foo,bar,baz?batch=1`). O default do Fastify para parâmetros
    // de URL é 100 chars — qualquer batch com 4+ procedimentos estoura e
    // o roteador devolve 404. 2000 é folga suficiente para batches reais.
    maxParamLength: 2000,
  });

  // ─── Correlation ID + request timing (FIRST hook — before everything) ────
  await app.register(correlationPlugin);

  // ─── Structured request/response logging ────────────────────────────────
  app.addHook('onResponse', (req, reply, done) => {
    const durationMs = Number(process.hrtime.bigint() - req.startTimeNs) / 1_000_000;
    const route      = normalizeRoute(
      (req.routeOptions as { url?: string } | undefined)?.url ?? req.url,
    );

    logger.info({
      method:      req.method,
      path:        route,
      statusCode:  reply.statusCode,
      duration_ms: durationMs.toFixed(2),
      ip:          req.ip,
    }, 'request completed');

    recordHttpRequest(req.method, route, reply.statusCode, durationMs / 1000);
    done();
  });

  // ─── Security plugins ────────────────────────────────────────────────────
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc:     ["'self'"],
        scriptSrc:      ["'self'"],
        styleSrc:       ["'self'", "'unsafe-inline'"],
        imgSrc:         ["'self'", 'data:', 'blob:'],
        connectSrc:     ["'self'"],
        fontSrc:        ["'self'"],
        objectSrc:      ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  await app.register(fastifyCors, {
    origin: env.NODE_ENV === 'development'
      ? ['http://localhost:3000', 'http://localhost:3002']
      : [/\.dermaos\.com\.br$/],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(fastifyCookie, { secret: env.JWT_SECRET, hook: 'onRequest' });

  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: 'access_token', signed: false },
  });

  await app.register(fastifyRateLimit, {
    max:         env.RATE_LIMIT_MAX,
    timeWindow:  env.RATE_LIMIT_WINDOW_MS,
    redis,
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error:   'Too Many Requests',
      message: 'Muitas requisições. Tente novamente em instantes.',
    }),
  });

  await registerAuthenticatedRateLimit(app);

  // ─── REST: upload routes ─────────────────────────────────────────────────
  await registerLesionUploadRoute(app);
  await registerProductPhotoUploadRoute(app);
  await registerAuroraKnowledgeUploadRoute(app);
  await registerClinicLogoUploadRoute(app);

  // ─── REST: webhooks ───────────────────────────────────────────────────────
  await registerOmniWebhookRoutes(app);

  // ─── REST: product analytics ──────────────────────────────────────────────
  await registerAnalyticsEventsRoute(app);

  // ─── Portal do Paciente ───────────────────────────────────────────────────
  await app.register(registerPortalPlugin);

  // ─── tRPC ─────────────────────────────────────────────────────────────────
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

  // ─── Observability endpoints ──────────────────────────────────────────────

  /**
   * Liveness probe — used by load balancer for routing.
   * Must respond < 100 ms; does NOT check external dependencies.
   */
  app.get('/health', async (_req, reply) => {
    return reply.status(200).send({
      status:      'ok',
      uptime:      Math.floor(process.uptime()),
      version:     process.env['npm_package_version'] ?? '1.0.0',
      environment: env.NODE_ENV,
    });
  });

  /**
   * Readiness probe — checks all dependencies with individual timeouts.
   * HTTP 200 if critical services (db + redis) are up.
   * HTTP 503 if any critical service fails.
   * HTTP 200 with overall='degraded' if only non-critical services fail.
   */
  app.get('/ready', async (_req, reply) => {
    const start = Date.now();

    const [dbResult, redisResult, minioResult, typesenseResult, ollamaResult] =
      await Promise.allSettled([
        withTimeout(checkDatabaseHealth(),  3_000, false),
        withTimeout(checkRedisHealth(),     1_000, false),
        withTimeout(checkMinioHealth(),     3_000, false),
        withTimeout(checkTypesenseHealth(), 2_000, false),
        withTimeout(checkOllamaHealth(),    2_000, null),
      ]);

    const dbOk         = dbResult.status      === 'fulfilled' && dbResult.value      === true;
    const redisOk      = redisResult.status   === 'fulfilled' && redisResult.value   === true;
    const minioOk      = minioResult.status   === 'fulfilled' && minioResult.value   === true;
    const typesenseOk  = typesenseResult.status === 'fulfilled' && typesenseResult.value === true;
    const ollamaValue  = ollamaResult.status  === 'fulfilled' ? ollamaResult.value   : false;

    const ollamaStatus = ollamaValue === null    ? 'unavailable'
                       : ollamaValue === true    ? 'ok'
                       :                          'error';

    const overall = (!dbOk || !redisOk)    ? 'error'
                  : (!minioOk || !typesenseOk || ollamaStatus === 'error') ? 'degraded'
                  :                           'ok';

    logger.info({
      database:   dbOk        ? 'ok' : 'error',
      redis:      redisOk     ? 'ok' : 'error',
      minio:      minioOk     ? 'ok' : 'error',
      typesense:  typesenseOk ? 'ok' : 'error',
      ollama:     ollamaStatus,
      overall,
      duration_ms: Date.now() - start,
    }, 'readiness check completed');

    const body = {
      database:   dbOk        ? 'ok' : 'error',
      redis:      redisOk     ? 'ok' : 'error',
      minio:      minioOk     ? 'ok' : 'error',
      typesense:  typesenseOk ? 'ok' : 'error',
      ollama:     ollamaStatus,
      overall,
      checked_at: new Date().toISOString(),
    } as const;

    const httpStatus = dbOk && redisOk ? 200 : 503;
    return reply.status(httpStatus).send(body);
  });

  /**
   * Prometheus metrics — protected by IP allowlist or Basic Auth.
   * Returns 403 for unauthorised callers (no detail in error body).
   */
  app.get('/metrics', async (req, reply) => {
    if (!isMetricsAuthorized(req.ip, req.headers.authorization)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    try {
      const body = renderPrometheusMetrics(getTotalConnections);
      return reply
        .status(200)
        .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
        .send(body);
    } catch (err) {
      logger.error({ err }, 'Failed to render Prometheus metrics');
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // ─── Graceful shutdown ────────────────────────────────────────────────────

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

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));

  // ─── Start ────────────────────────────────────────────────────────────────

  await connectRedis();
  await ensureClinicalImagesBucket();
  await ensurePrescriptionsBucket();
  await ensureProductImagesBucket();
  await ensureClinicAssetsBucket();
  await ensureLgpdExportsBucket();
  await ensureProductCollection();

  await app.listen({ port: env.PORT, host: '0.0.0.0' });

  initSocketGateway(app);
  await subscribeInboxRealtime();
  await subscribeSupplyRealtime();
  initQueueHandler();
  initNotificationsHandler();
  initAlertsHandler();
  subscribeNotificationEvents();

  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'DermaOS API running');
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal error during bootstrap');
  process.exit(1);
});
