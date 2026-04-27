import crypto from 'node:crypto';
import { redis } from '../../db/redis.js';
import { logger } from '../../lib/logger.js';

const DEFAULT_TTL_SECONDS = 300;

export function makeCacheKey(parts: Array<string | undefined | null>): string {
  const safe = parts.filter((p): p is string => Boolean(p)).join(':');
  return `dashboard:${safe}`;
}

export function hashRange(start: string, end: string): string {
  return crypto.createHash('sha1').update(`${start}|${end}`).digest('hex').slice(0, 12);
}

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn({ err, key }, 'dashboard cache read failed — falling back to DB');
    return null;
  }
}

export async function writeCache<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn({ err, key }, 'dashboard cache write failed');
  }
}

export async function invalidateByPrefix(prefix: string): Promise<void> {
  try {
    const stream = redis.scanStream({ match: `${prefix}*`, count: 100 });
    const pipeline = redis.pipeline();
    let toDelete = 0;
    for await (const keys of stream) {
      for (const k of keys as string[]) {
        pipeline.del(k);
        toDelete++;
      }
    }
    if (toDelete > 0) await pipeline.exec();
  } catch (err) {
    logger.warn({ err, prefix }, 'dashboard cache invalidation failed');
  }
}

export async function invalidateClinicScope(
  clinicId: string,
  scopes: Array<'doctor' | 'reception' | 'admin' | 'analytics'>,
): Promise<void> {
  await Promise.all(
    scopes.map((scope) => invalidateByPrefix(`dashboard:${scope}:${clinicId}:`)),
  );
}

export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<{ data: T; cached: boolean }> {
  const cached = await readCache<T>(key);
  if (cached) return { data: cached, cached: true };
  const data = await loader();
  await writeCache(key, data, ttlSeconds);
  return { data, cached: false };
}
