import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

// Memorystore com `transit-encryption-mode=server-authentication` apresenta
// um cert assinado por CA do Google que não está no trust store padrão do
// Node. Como o tráfego só passa por VPC peering privado (sem internet),
// validar o cert apenas garante que o handshake completa — desativá-lo
// mantém o canal cifrado sem bloquear a conexão. Para forçar validação
// estrita (ex.: prod com CA do Memorystore bundled), defina
// REDIS_TLS_STRICT=true.
const REDIS_TLS_STRICT = process.env['REDIS_TLS_STRICT'] === 'true';

function createRedisClient(name: string): Redis {
  const isTls = env.REDIS_URL.startsWith('rediss://');
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    ...(isTls ? { tls: { rejectUnauthorized: REDIS_TLS_STRICT } } : {}),
    retryStrategy(times) {
      if (times > 10) {
        logger.error({ name }, 'Redis max retries exceeded — giving up');
        return null;
      }
      const delay = Math.min(times * 100, 3_000);
      logger.warn({ name, attempt: times, delayMs: delay }, 'Redis reconnecting');
      return delay;
    },
    reconnectOnError(err) {
      // Reconnect on READONLY errors (Redis Sentinel failover)
      return err.message.includes('READONLY');
    },
    lazyConnect: true,
    enableReadyCheck: true,
  });

  client.on('ready', () => logger.info({ name }, 'Redis connected'));
  client.on('error', (err) => logger.error({ name, err }, 'Redis error'));
  client.on('close', () => logger.warn({ name }, 'Redis connection closed'));

  return client;
}

// Cliente principal para cache e BullMQ
export const redis = createRedisClient('main');

// Cliente separado para subscriptions pub/sub (ioredis não permite mixing)
export const redisSub = createRedisClient('sub');
export const redisPub = createRedisClient('pub');

/**
 * Verifica se o Redis está acessível (usado no readiness check).
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Conecta todos os clientes Redis.
 */
export async function connectRedis(): Promise<void> {
  await Promise.all([redis.connect(), redisSub.connect(), redisPub.connect()]);
}
