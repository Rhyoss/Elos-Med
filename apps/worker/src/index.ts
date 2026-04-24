import 'dotenv/config';
import { Worker, Queue, type Processor } from 'bullmq';
import Redis from 'ioredis';
import { Pool } from 'pg';
import pino from 'pino';
import { buildLesionImageProcessor } from './processors/lesion-image.processor.js';
import { buildOmniInboundProcessor } from './processors/omni-inbound.processor.js';
import { buildAuroraReasoningProcessor } from './processors/aurora-reasoning.processor.js';
import { buildAuroraEmbedProcessor } from './processors/aurora-embed.processor.js';
import { buildOmniOutboundProcessor } from './processors/omni-outbound.processor.js';
import { buildSchedulingHoldsCleanupProcessor } from './schedules/scheduling-holds-cleanup.js';
import { buildAutomationsProcessor, buildBirthdayCronProcessor } from './processors/automations.processor.js';
import { buildSupplyAlertsProcessor } from './processors/supply-alerts.processor.js';
import { buildSupplyConsumptionProcessor } from './processors/supply-consumption.processor.js';

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  ...(process.env['NODE_ENV'] === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
});

const redisConnection = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // BullMQ requer null para blocking commands
  enableReadyCheck: false,
});

redisConnection.on('error', (err) => logger.error({ err }, 'Redis connection error'));
redisConnection.on('ready', () => logger.info('Worker Redis connected'));

// ─── Job queues ────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  NOTIFICATIONS:              'notifications',
  REMINDERS:                  'appointment-reminders',
  REPORTS:                    'reports',
  SEARCH_INDEX:               'search-indexing',
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
  SUPPLY_STOCK_DAILY:         'supply-stock-daily',
  SUPPLY_CONSUMPTION:         'supply-consumption',
} as const;

// Pool de DB dedicado ao worker (ideal para jobs persistentes — não depende da API).
const workerDb = new Pool({
  connectionString: process.env['DATABASE_URL'],
  max: 10,
  idleTimeoutMillis: 30_000,
});

workerDb.on('error', (err) => logger.error({ err }, 'Worker pg pool error'));

// Cliente Redis separado para PUBLISH (pub/sub não pode misturar com blocking commands).
const pubRedis = redisConnection.duplicate({ maxRetriesPerRequest: 3 });
pubRedis.on('error', (err) => logger.error({ err }, 'Worker pub Redis error'));

// ─── Workers ───────────────────────────────────────────────────────────────

const workers: Worker[] = [];

function registerWorker<T = unknown>(
  queueName: string,
  processor: Processor<T>,
  concurrency = 5,
) {
  const worker = new Worker(queueName, processor, {
    connection: redisConnection.duplicate(),
    concurrency,
    removeOnComplete: { count: 1000, age: 86_400 },  // mantém 24h de logs
    removeOnFail: { count: 5000, age: 7 * 86_400 },   // mantém 7 dias de falhas
  });

  worker.on('completed', (job) => {
    logger.debug({ queue: queueName, jobId: job.id }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ queue: queueName, jobId: job?.id, err }, 'Job failed');
  });

  worker.on('error', (err) => {
    logger.error({ queue: queueName, err }, 'Worker error');
  });

  workers.push(worker);
  logger.info({ queue: queueName, concurrency }, 'Worker registered');
  return worker;
}

// ─── Registro de processors ────────────────────────────────────────────────

registerWorker(QUEUE_NAMES.EMAIL, async (job) => {
  const { to, subject, html } = job.data as { to: string; subject: string; html: string };
  logger.info({ queue: QUEUE_NAMES.EMAIL, to, subject }, 'Processing email job');
  // Implementação do envio de email via SMTP/SES
  // TODO no próximo prompt: EmailProcessor completo
});

registerWorker(QUEUE_NAMES.REMINDERS, async (job) => {
  const { appointmentId, type } = job.data as { appointmentId: string; type: '24h' | '2h' };
  logger.info({ queue: QUEUE_NAMES.REMINDERS, appointmentId, type }, 'Processing reminder');
  // TODO no próximo prompt: ReminderProcessor — envia WhatsApp/SMS/email
}, 10);

registerWorker(QUEUE_NAMES.SEARCH_INDEX, async (job) => {
  const { collection, operation, document } = job.data as {
    collection: string;
    operation: 'upsert' | 'delete';
    document: Record<string, unknown>;
  };
  logger.info({ queue: QUEUE_NAMES.SEARCH_INDEX, collection, operation }, 'Processing search index');
  // TODO no próximo prompt: TypesenseIndexProcessor
});

registerWorker(
  QUEUE_NAMES.LESION_IMAGE,
  buildLesionImageProcessor(logger),
  3, // concurrency baixa — Sharp consome CPU
);

// ─── Filas usadas para enfileirar a partir dos processors (producers) ──────
const queueConnection = redisConnection.duplicate({ maxRetriesPerRequest: null });
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

registerWorker(
  QUEUE_NAMES.OMNI_INBOUND,
  buildOmniInboundProcessor({
    db:                   workerDb,
    redis:                pubRedis,
    logger,
    auroraReasoningQueue,
    omniOutboundQueue,
  }),
  10, // mensagens são leves — permite paralelismo
);

// Aurora reasoning — LLM calls são caras; concurrency baixa.
const AURORA_USER_ID = process.env['AURORA_USER_ID'] ?? '00000000-0000-0000-0000-000000000000';
const ANTHROPIC_API_KEY = process.env['CLAUDE_API_KEY'] ?? null;
const OLLAMA_BASE_URL = process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434';

registerWorker(
  QUEUE_NAMES.AURORA_REASONING,
  buildAuroraReasoningProcessor({
    db:                workerDb,
    redis:             pubRedis,
    logger,
    outboundQueue:     omniOutboundQueue,
    anthropicApiKey:   ANTHROPIC_API_KEY,
    ollamaBaseUrl:     OLLAMA_BASE_URL,
    auroraUserId:      AURORA_USER_ID,
  }),
  5,
);

// Aurora embeddings — Ollama `nomic-embed-text` → pgvector (Fase 4 §1.3).
registerWorker(
  QUEUE_NAMES.AURORA_EMBED,
  buildAuroraEmbedProcessor({
    db:            workerDb,
    logger,
    ollamaBaseUrl: OLLAMA_BASE_URL,
  }),
  3,
);

// Outbound — apenas HTTP, paralelismo mais alto é barato.
registerWorker(
  QUEUE_NAMES.OMNI_OUTBOUND,
  buildOmniOutboundProcessor({
    db:     workerDb,
    logger,
  }),
  10,
);

registerWorker(
  QUEUE_NAMES.SCHEDULING_HOLDS_CLEANUP,
  buildSchedulingHoldsCleanupProcessor(workerDb, logger),
  1, // job de manutenção — concurrency 1 é suficiente
);

// Agenda o job repetível de limpeza de holds (1 min) — Anexo A §A.2.3.
// Idempotente: BullMQ deduplica por jobId fixo.
{
  const cleanupQueue = new Queue(QUEUE_NAMES.SCHEDULING_HOLDS_CLEANUP, {
    connection: redisConnection.duplicate({ maxRetriesPerRequest: null }),
  });
  void cleanupQueue
    .add(
      'cleanup-expired-holds',
      {},
      {
        jobId: 'scheduling-holds-cleanup-1m',
        repeat: { every: 60_000, immediately: true },
        removeOnComplete: true,
        removeOnFail:     { count: 500, age: 86_400 },
      },
    )
    .then(() => logger.info({ queue: QUEUE_NAMES.SCHEDULING_HOLDS_CLEANUP }, 'Repeatable cleanup job registered'))
    .catch((err) => logger.error({ err }, 'Failed to register scheduling-holds-cleanup repeatable'));
}

// ─── Automações ────────────────────────────────────────────────────────────

const automationsJobQueue = new Queue(QUEUE_NAMES.AUTOMATIONS, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff:  { type: 'exponential', delay: 10_000 },
    removeOnComplete: { count: 1_000, age:  7 * 86_400 },
    removeOnFail:     { count: 5_000, age: 30 * 86_400 },
  },
});

registerWorker(
  QUEUE_NAMES.AUTOMATIONS,
  buildAutomationsProcessor({ db: workerDb, logger }),
  10, // IO-bound (DB + HTTP) — paralelismo adequado
);

registerWorker(
  QUEUE_NAMES.AUTOMATIONS_BIRTHDAY_CRON,
  buildBirthdayCronProcessor({ db: workerDb, logger }, automationsJobQueue),
  1, // job de varredura — concurrency 1
);

// Agenda o cron de aniversários (a cada hora, idempotente por jobId fixo)
{
  const birthdayCronQueue = new Queue(QUEUE_NAMES.AUTOMATIONS_BIRTHDAY_CRON, {
    connection: redisConnection.duplicate({ maxRetriesPerRequest: null }),
  });
  void birthdayCronQueue
    .add(
      'birthday-scan',
      {},
      {
        jobId:  'automations-birthday-cron-1h',
        repeat: { every: 3_600_000, immediately: true },
        removeOnComplete: true,
        removeOnFail: { count: 500, age: 86_400 },
      },
    )
    .then(() => logger.info({ queue: QUEUE_NAMES.AUTOMATIONS_BIRTHDAY_CRON }, 'Birthday cron job registered'))
    .catch((err) => logger.error({ err }, 'Failed to register birthday cron'));
}

// ─── Supply alerts (Prompt 12.C) ───────────────────────────────────────────

registerWorker(
  QUEUE_NAMES.SUPPLY_STOCK_DAILY,
  buildSupplyAlertsProcessor({ db: workerDb, redis: pubRedis, logger }),
  1, // varredura global — concurrency 1 é suficiente
);

// Agenda o sweep diário (24h) — idempotente por jobId fixo.
{
  const supplyAlertsQueue = new Queue(QUEUE_NAMES.SUPPLY_STOCK_DAILY, {
    connection: redisConnection.duplicate({ maxRetriesPerRequest: null }),
  });
  void supplyAlertsQueue
    .add(
      'supply-stock-daily-scan',
      { triggeredAt: new Date().toISOString() },
      {
        jobId:  'supply-stock-daily-24h',
        repeat: { every: 86_400_000, immediately: true },
        attempts: 3,
        backoff:  { type: 'exponential', delay: 30_000 },
        removeOnComplete: true,
        removeOnFail:     { count: 100, age: 7 * 86_400 },
      },
    )
    .then(() => logger.info({ queue: QUEUE_NAMES.SUPPLY_STOCK_DAILY }, 'Supply alerts daily job registered'))
    .catch((err) => logger.error({ err }, 'Failed to register supply alerts daily'));
}

// ─── Supply consumption (Prompt 14) ────────────────────────────────────────

registerWorker(
  QUEUE_NAMES.SUPPLY_CONSUMPTION,
  buildSupplyConsumptionProcessor({ db: workerDb, redis: pubRedis, logger }),
  5, // consumos podem rodar em paralelo (locks por lote + UNIQUE idempotency)
);

registerWorker(QUEUE_NAMES.ANALYTICS, async (job) => {
  const { clinicId, metric, date } = job.data as {
    clinicId: string;
    metric: string;
    date: string;
  };
  logger.info({ queue: QUEUE_NAMES.ANALYTICS, clinicId, metric, date }, 'Processing analytics');
  // TODO no próximo prompt: AnalyticsAggregator
}, 2);

// ─── Graceful shutdown ─────────────────────────────────────────────────────

async function shutdown(signal: string) {
  logger.info({ signal }, 'Worker shutting down');

  await Promise.all(workers.map((w) => w.close()));
  await Promise.all([
    auroraReasoningQueue.close().catch(() => undefined),
    omniOutboundQueue.close().catch(() => undefined),
    automationsJobQueue.close().catch(() => undefined),
  ]);
  await workerDb.end();
  await pubRedis.quit();
  await queueConnection.quit().catch(() => undefined);
  await redisConnection.quit();

  logger.info('Worker shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

logger.info(
  { queues: Object.values(QUEUE_NAMES) },
  'DermaOS Worker started — listening for jobs',
);
