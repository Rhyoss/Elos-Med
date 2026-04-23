import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

function createRedisClient(name: string): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
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
