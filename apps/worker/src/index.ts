import 'dotenv/config';
import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';

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
  NOTIFICATIONS:     'notifications',
  REMINDERS:         'appointment-reminders',
  REPORTS:           'reports',
  SEARCH_INDEX:      'search-indexing',
  EMAIL:             'email',
  ANALYTICS:         'analytics-aggregation',
  PATIENT_LTV:       'patient-ltv',
} as const;

// ─── Workers ───────────────────────────────────────────────────────────────

const workers: Worker[] = [];

function registerWorker(
  queueName: string,
  processor: Parameters<typeof Worker>[1],
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
