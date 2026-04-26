import 'dotenv/config';
import http from 'node:http';
import { Worker, Queue, type Processor } from 'bullmq';
import Redis from 'ioredis';
import { Pool } from 'pg';
import pino from 'pino';

// ─── Existing processors ────────────────────────────────────────────────────
import { buildLesionImageProcessor }      from './processors/lesion-image.processor.js';
import { buildOmniInboundProcessor }      from './processors/omni-inbound.processor.js';
import { buildAuroraReasoningProcessor }  from './processors/aurora-reasoning.processor.js';
import { buildAuroraEmbedProcessor }      from './processors/aurora-embed.processor.js';
import { buildOmniOutboundProcessor }     from './processors/omni-outbound.processor.js';
import { buildSchedulingHoldsCleanupProcessor } from './schedules/scheduling-holds-cleanup.js';
import { buildAutomationsProcessor, buildBirthdayCronProcessor } from './processors/automations.processor.js';
import { buildSupplyAlertsProcessor }     from './processors/supply-alerts.processor.js';
import { buildSupplyConsumptionProcessor } from './processors/supply-consumption.processor.js';
import { buildAnalyticsAggregationProcessor } from './processors/analytics-aggregation.processor.js';
import { buildLgpdExportProcessor }       from './processors/lgpd-export.processor.js';

// ─── New scheduled-job processors ──────────────────────────────────────────
import { buildAppointmentRemindersProcessor } from './processors/appointment-reminders.processor.js';
import { buildAutomationQueueProcessor }  from './processors/automation-queue.processor.js';
import { buildMonthlyCohortProcessor }    from './processors/monthly-cohort.processor.js';
import { buildPatientReactivationProcessor } from './processors/patient-reactivation.processor.js';
import { buildSupplyForecastProcessor }   from './processors/supply-forecast.processor.js';
import { buildSearchSyncProcessor }       from './processors/search-sync.processor.js';

import { decryptOptional }                from './lib/encryption.js';
import { formatPrometheus, getWorkerStatuses } from './lib/metrics.js';
import { notifyAdminDlq }                 from './lib/dlq-notify.js';
import { Client as MinioClient }          from 'minio';
import argon2 from 'argon2';
import crypto from 'node:crypto';

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  ...(process.env['NODE_ENV'] === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
});

const redisConnection = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
redisConnection.on('error', (err) => logger.error({ err }, 'Redis connection error'));
redisConnection.on('ready', () => logger.info('Worker Redis connected'));

// ─── Queue names ────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  NOTIFICATIONS:              'notifications',
  REMINDERS:                  'appointment-reminders',
  REPORTS:                    'reports',
  SEARCH_INDEX:               'search-indexing',
  SEARCH_SYNC:                'search-sync',
  EMAIL:                      'email',
  ANALYTICS:                  'analytics-aggregation',
  PATIENT_LTV:                'patient-ltv',
  LESION_IMAGE:               'lesion-image-processing',
  OMNI_INBOUND:               'omni-inbound',
  OMNI_OUTBOUND:              'omni-outbound',
  AURORA_REASONING:           'aurora-reasoning',
  AURORA_EMBED:               'aurora-embed',
  SCHEDULING_HOLDS_CLEANUP:   'scheduling-holds-cleanup',
  AUTOMATIONS:                'automations',
  AUTOMATIONS_BIRTHDAY_CRON:  'automations-birthday-cron',
  AUTOMATION_QUEUE:           'automation-queue-processor',
  SUPPLY_STOCK_DAILY:         'supply-stock-daily',
  SUPPLY_CONSUMPTION:         'supply-consumption',
  SUPPLY_FORECAST:            'supply-forecast',
  MONTHLY_COHORT:             'monthly-cohort-analysis',
  PATIENT_REACTIVATION:       'patient-reactivation',
  LGPD_EXPORT:                'lgpd-export',
} as const;

// ─── Shared resources ────────────────────────────────────────────────────────

const workerDb = new Pool({
  connectionString: process.env['DATABASE_URL'],
  max: 10,
  idleTimeoutMillis: 30_000,
});
workerDb.on('error', (err) => logger.error({ err }, 'Worker pg pool error'));

const pubRedis = redisConnection.duplicate({ maxRetriesPerRequest: 3 });
pubRedis.on('error', (err) => logger.error({ err }, 'Worker pub Redis error'));

// Dedicated Redis client for distributed locks (separate from BullMQ connection).
const lockRedis = redisConnection.duplicate({ maxRetriesPerRequest: 3 });
lockRedis.on('error', (err) => logger.error({ err }, 'Lock Redis error'));

const queueConnection = redisConnection.duplicate({ maxRetriesPerRequest: null });

// ─── Worker registry + graceful-shutdown tracking ────────────────────────────

const workers: Worker[] = [];

/**
 * Registers a BullMQ worker.
 *
 * Enhanced beyond the original:
 *   - Captures failed event; on final attempt calls notifyAdminDlq.
 *   - Concurrency configurable per job type.
 */
function registerWorker<T = unknown>(
  queueName:   string,
  processor:   Processor<T>,
  concurrency  = 5,
  maxAttempts  = 3,
): Worker {
  const worker = new Worker(queueName, processor, {
    connection:         redisConnection.duplicate(),
    concurrency,
    removeOnComplete:   { count: 1000, age: 86_400 },
    removeOnFail:       { count: 5000, age: 7 * 86_400 },
  });

  worker.on('completed', (job) => {
    logger.debug({ queue: queueName, jobId: job.id }, 'Job completed');
  });

  worker.on('failed', async (job, err) => {
    const attempts = job?.attemptsMade ?? 0;
    logger.error({ queue: queueName, jobId: job?.id, attempts, err }, 'Job failed');

    // Emit DLQ admin notification after final retry
    if (job && attempts >= maxAttempts - 1) {
      await notifyAdminDlq({
        db:      workerDb,
        logger,
        jobName: queueName,
        jobId:   job.id,
        error:   err,
        payload: { attempts, queue: queueName },
      }).catch(() => undefined);
    }
  });

  worker.on('error', (err) => {
    logger.error({ queue: queueName, err }, 'Worker error');
  });

  workers.push(worker);
  logger.info({ queue: queueName, concurrency }, 'Worker registered');
  return worker;
}

// ─── Queue producers (used by processors to enqueue downstream jobs) ─────────

const auroraReasoningQueue = new Queue(QUEUE_NAMES.AURORA_REASONING, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff:  { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 1_000, age: 86_400 },
    removeOnFail:     { count: 5_000, age: 14 * 86_400 },
  },
});

const omniOutboundQueue = new Queue(QUEUE_NAMES.OMNI_OUTBOUND, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff:  { type: 'exponential', delay: 2_000 },
    removeOnComplete: { count: 500, age: 86_400 },
    removeOnFail:     { count: 2_000, age: 7 * 86_400 },
  },
});

const automationsJobQueue = new Queue(QUEUE_NAMES.AUTOMATIONS, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff:  { type: 'exponential', delay: 10_000 },
    removeOnComplete: { count: 1_000, age:  7 * 86_400 },
    removeOnFail:     { count: 5_000, age: 30 * 86_400 },
  },
});

const queues: Queue[] = [auroraReasoningQueue, omniOutboundQueue, automationsJobQueue];

// ─── Register processors ─────────────────────────────────────────────────────

// Email stub
registerWorker(QUEUE_NAMES.EMAIL, async (job) => {
  const { to, subject } = job.data as { to: string; subject: string; html: string };
  logger.info({ queue: QUEUE_NAMES.EMAIL, to, subject }, 'Processing email job (stub)');
});

// Lesion image processing
registerWorker(QUEUE_NAMES.LESION_IMAGE, buildLesionImageProcessor(logger), 3);

// Omni inbound/outbound
registerWorker(
  QUEUE_NAMES.OMNI_INBOUND,
  buildOmniInboundProcessor({ db: workerDb, redis: pubRedis, logger, auroraReasoningQueue, omniOutboundQueue }),
  10,
);
registerWorker(QUEUE_NAMES.OMNI_OUTBOUND, buildOmniOutboundProcessor({ db: workerDb, logger }), 10);

// Aurora reasoning + embeddings
const AURORA_USER_ID    = process.env['AURORA_USER_ID']    ?? '00000000-0000-0000-0000-000000000000';
const ANTHROPIC_API_KEY = process.env['CLAUDE_API_KEY']    ?? null;
const OLLAMA_BASE_URL   = process.env['OLLAMA_BASE_URL']   ?? 'http://localhost:11434';

registerWorker(
  QUEUE_NAMES.AURORA_REASONING,
  buildAuroraReasoningProcessor({
    db: workerDb, redis: pubRedis, logger, outboundQueue: omniOutboundQueue,
    anthropicApiKey: ANTHROPIC_API_KEY, ollamaBaseUrl: OLLAMA_BASE_URL, auroraUserId: AURORA_USER_ID,
  }),
  5,
);
registerWorker(QUEUE_NAMES.AURORA_EMBED, buildAuroraEmbedProcessor({ db: workerDb, logger, ollamaBaseUrl: OLLAMA_BASE_URL }), 3);

// Scheduling holds cleanup
registerWorker(QUEUE_NAMES.SCHEDULING_HOLDS_CLEANUP, buildSchedulingHoldsCleanupProcessor(workerDb, logger), 1);

// Automations
registerWorker(QUEUE_NAMES.AUTOMATIONS, buildAutomationsProcessor({ db: workerDb, logger }), 10);
registerWorker(QUEUE_NAMES.AUTOMATIONS_BIRTHDAY_CRON, buildBirthdayCronProcessor({ db: workerDb, logger }, automationsJobQueue), 1);

// Supply (existing processors, now enhanced with lock + metrics)
registerWorker(
  QUEUE_NAMES.SUPPLY_STOCK_DAILY,
  buildSupplyAlertsProcessor({ db: workerDb, redis: lockRedis, logger }),
  1,
);
registerWorker(QUEUE_NAMES.SUPPLY_CONSUMPTION, buildSupplyConsumptionProcessor({ db: workerDb, redis: pubRedis, logger }), 5);

// Analytics KPI snapshot (enhanced)
registerWorker(
  QUEUE_NAMES.ANALYTICS,
  buildAnalyticsAggregationProcessor({ db: workerDb, redis: lockRedis, logger }),
  1,
);

// LGPD export
{
  const lgpdMinio = new MinioClient({
    endPoint:  process.env['MINIO_ENDPOINT']    ?? 'minio',
    port:      Number(process.env['MINIO_PORT'] ?? 9000),
    useSSL:    process.env['MINIO_USE_SSL']     === 'true',
    accessKey: process.env['MINIO_ACCESS_KEY']  ?? '',
    secretKey: process.env['MINIO_SECRET_KEY']  ?? '',
  });
  registerWorker(
    QUEUE_NAMES.LGPD_EXPORT,
    buildLgpdExportProcessor({
      db: workerDb, logger, minio: lgpdMinio, bucket: 'lgpd-exports',
      decrypt: (ct, clinicId) => decryptOptional(ct, clinicId),
      generateZipPassword: () => crypto.randomBytes(18).toString('base64').replace(/[+/=]/g, '').slice(0, 24),
      hashZipPassword: (pwd) => argon2.hash(pwd, { type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 4 }),
      ...(process.env['SMTP_HOST']  ? { smtpHost: process.env['SMTP_HOST'] }         : {}),
      ...(process.env['SMTP_PORT']  ? { smtpPort: Number(process.env['SMTP_PORT']) } : {}),
      ...(process.env['SMTP_USER']  ? { smtpUser: process.env['SMTP_USER'] }         : {}),
      ...(process.env['SMTP_PASS']  ? { smtpPass: process.env['SMTP_PASS'] }         : {}),
      ...(process.env['SMTP_FROM']  ? { smtpFrom: process.env['SMTP_FROM'] }         : {}),
      ...(process.env['PORTAL_URL'] ? { portalUrl: process.env['PORTAL_URL'] }       : {}),
    }),
    2,
  );
}

// ─── New scheduled jobs (Jobs 4–8) ───────────────────────────────────────────

// Job 4 — appointment-reminders (every 15 min, per-clinic lock)
registerWorker(
  QUEUE_NAMES.REMINDERS,
  buildAppointmentRemindersProcessor({ db: workerDb, redis: lockRedis, logger }),
  3,  // 3 tenants processed in parallel
);

// Job 5 — automation-queue processor (every 5 min, SKIP LOCKED)
registerWorker(
  QUEUE_NAMES.AUTOMATION_QUEUE,
  buildAutomationQueueProcessor({ db: workerDb, redis: lockRedis, logger }),
  5,  // multiple workers can process different clinic queues
);

// Job 6 — patient-reactivation (weekly dispatcher — runs every 30 min,
//          only fires for clinics where it is Sunday 10:00 local)
registerWorker(
  QUEUE_NAMES.PATIENT_REACTIVATION,
  buildPatientReactivationProcessor({ db: workerDb, redis: lockRedis, logger }),
  1,
);

// Job 7 — supply-forecast (weekly Monday 04:00 UTC)
registerWorker(
  QUEUE_NAMES.SUPPLY_FORECAST,
  buildSupplyForecastProcessor({
    db:           workerDb,
    redis:        lockRedis,
    logger,
    aiServiceUrl: process.env['AI_SERVICE_URL'] ?? 'http://ai:8000',
  }),
  1,
);

// Job 8 — search-sync (every 10 min, incremental)
registerWorker(
  QUEUE_NAMES.SEARCH_SYNC,
  buildSearchSyncProcessor({
    db:           workerDb,
    redis:        lockRedis,
    logger,
    typesenseUrl: process.env['TYPESENSE_URL']     ?? 'http://typesense:8108',
    typesenseKey: process.env['TYPESENSE_API_KEY'] ?? '',
  }),
  2,
);

// ─── Schedule repeatable jobs ────────────────────────────────────────────────

function scheduleRepeatable(
  queueName: string,
  jobName:   string,
  jobData:   Record<string, unknown>,
  opts:      { jobId: string; repeatEvery?: number; cron?: string; attempts?: number },
) {
  const q = new Queue(queueName, { connection: redisConnection.duplicate({ maxRetriesPerRequest: null }) });
  queues.push(q);

  const repeatOpts = opts.cron
    ? { pattern: opts.cron }
    : { every: opts.repeatEvery };

  void q.add(jobName, { ...jobData, triggeredAt: new Date().toISOString() }, {
    jobId:            opts.jobId,
    repeat:           opts.cron ? { pattern: opts.cron } : { every: opts.repeatEvery },
    attempts:         opts.attempts ?? 3,
    backoff:          { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 30,  age: 30 * 86_400 },
    removeOnFail:     { count: 100, age: 90 * 86_400 },
  })
    .then(() => logger.info({ queue: queueName, jobId: opts.jobId }, 'Repeatable job registered'))
    .catch((err) => logger.error({ err, queue: queueName }, 'Failed to register repeatable job'));
}

// Scheduling holds cleanup — every 60s
scheduleRepeatable(QUEUE_NAMES.SCHEDULING_HOLDS_CLEANUP, 'cleanup-expired-holds', {},
  { jobId: 'scheduling-holds-cleanup-1m', repeatEvery: 60_000 });

// Birthday automations cron — every hour
scheduleRepeatable(QUEUE_NAMES.AUTOMATIONS_BIRTHDAY_CRON, 'birthday-scan', {},
  { jobId: 'automations-birthday-cron-1h', repeatEvery: 3_600_000 });

// Supply stock daily dispatcher — every 15 min (fires per clinic only at 06:00 local)
scheduleRepeatable(QUEUE_NAMES.SUPPLY_STOCK_DAILY, 'supply-stock-daily-dispatcher', {},
  { jobId: 'supply-stock-daily-15m', repeatEvery: 15 * 60_000 });

// Analytics KPI snapshot — daily at 02:00 UTC
scheduleRepeatable(QUEUE_NAMES.ANALYTICS, 'analytics-nightly-aggregation', {},
  { jobId: 'analytics-nightly-2am', cron: '0 2 * * *', attempts: 2 });

// Monthly cohort analysis — first day of each month at 03:00 UTC
scheduleRepeatable(QUEUE_NAMES.MONTHLY_COHORT, 'monthly-cohort-run', {},
  { jobId: 'monthly-cohort-03am', cron: '0 3 1 * *', attempts: 3 });

// Appointment reminders — every 15 min
scheduleRepeatable(QUEUE_NAMES.REMINDERS, 'appointment-reminders-sweep', {},
  { jobId: 'appointment-reminders-15m', repeatEvery: 15 * 60_000 });

// Automation queue processor — every 5 min
scheduleRepeatable(QUEUE_NAMES.AUTOMATION_QUEUE, 'automation-queue-sweep', {},
  { jobId: 'automation-queue-5m', repeatEvery: 5 * 60_000 });

// Patient reactivation dispatcher — every 30 min (fires per clinic only on Sunday 10:00 local)
scheduleRepeatable(QUEUE_NAMES.PATIENT_REACTIVATION, 'patient-reactivation-dispatcher', {},
  { jobId: 'patient-reactivation-30m', repeatEvery: 30 * 60_000 });

// Supply forecast — weekly, Monday 04:00 UTC
scheduleRepeatable(QUEUE_NAMES.SUPPLY_FORECAST, 'supply-forecast-weekly', {},
  { jobId: 'supply-forecast-mon-4am', cron: '0 4 * * 1', attempts: 3 });

// Search sync — every 10 min
scheduleRepeatable(QUEUE_NAMES.SEARCH_SYNC, 'search-sync-incremental', {},
  { jobId: 'search-sync-10m', repeatEvery: 10 * 60_000 });

// ─── Prometheus /metrics HTTP server ─────────────────────────────────────────

const METRICS_PORT = Number(process.env['METRICS_PORT'] ?? 9090);

// /metrics auth: same mechanism as API — IP allowlist or Basic Auth
function isMetricsAuthorized(clientIp: string, authHeader: string | undefined): boolean {
  const allowed = (process.env['METRICS_ALLOWED_IPS'] ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length > 0 && allowed.includes(clientIp)) return true;

  const user = process.env['METRICS_USERNAME'];
  const pass = process.env['METRICS_PASSWORD'];
  if (user && pass && authHeader?.startsWith('Basic ')) {
    const decoded  = Buffer.from(authHeader.slice(6), 'base64').toString();
    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) return false;
    return decoded.slice(0, colonIdx) === user && decoded.slice(colonIdx + 1) === pass;
  }
  return false;
}

const metricsServer = http.createServer((req, res) => {
  const clientIp = req.socket.remoteAddress ?? '';
  const authHeader = req.headers['authorization'];

  if (req.method === 'GET' && req.url === '/metrics') {
    if (!isMetricsAuthorized(clientIp, authHeader)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden' }));
      return;
    }
    const body = formatPrometheus();
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
    res.end(body);
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', workers: workers.length }));
  } else if (req.method === 'GET' && req.url === '/ready') {
    // Readiness of this worker process (liveness of BullMQ workers)
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', workers: workers.length }));
  } else if (req.method === 'GET' && req.url === '/ready/workers') {
    // Per-job staleness check based on job_last_success_timestamp
    const statuses = getWorkerStatuses();
    const hasStale = Object.values(statuses).some((s) => s === 'stale');
    res.writeHead(hasStale ? 200 : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ workers: statuses }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

metricsServer.listen(METRICS_PORT, () => {
  logger.info({ port: METRICS_PORT }, 'Metrics server listening on /metrics');
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

const SHUTDOWN_TIMEOUT_MS = 30_000;

async function shutdown(signal: string) {
  logger.info({ signal }, 'Worker shutting down — pausing all workers');

  // Stop accepting new jobs
  await Promise.all(workers.map((w) => w.pause().catch(() => undefined)));

  // Wait up to 30s for in-flight jobs to complete
  const shutdownPromise = Promise.all(workers.map((w) => w.close()));
  const timeoutPromise  = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error('shutdown_timeout')), SHUTDOWN_TIMEOUT_MS),
  );

  try {
    await Promise.race([shutdownPromise, timeoutPromise]);
    logger.info('All workers closed cleanly');
  } catch {
    logger.warn(
      { activeWorkers: workers.filter((w) => !w.closing).length },
      'Graceful shutdown timed out (30s) — forcing close; some jobs may need reprocessing',
    );
    await Promise.all(workers.map((w) => w.close(true).catch(() => undefined)));
  }

  // Close queue producer connections
  await Promise.all([
    ...queues.map((q) => q.close().catch(() => undefined)),
  ]);

  // Close Redis lock client
  await lockRedis.quit().catch(() => undefined);

  // Close remaining resources
  await workerDb.end().catch(() => undefined);
  await pubRedis.quit().catch(() => undefined);
  await queueConnection.quit().catch(() => undefined);
  await redisConnection.quit().catch(() => undefined);

  metricsServer.close();

  logger.info('Worker shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT',  () => void shutdown('SIGINT'));

logger.info(
  { queues: Object.values(QUEUE_NAMES), metricsPort: METRICS_PORT },
  'DermaOS Worker started — listening for jobs',
);
