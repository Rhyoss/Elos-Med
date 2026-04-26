/**
 * Distributed lock via Redis SET NX PX.
 *
 * Acquire returns an opaque token (random UUID) when the lock is granted,
 * or null if another holder owns it.  Release uses a Lua CAS to ensure
 * only the original acquirer can delete the key — prevents accidental
 * early release after a TTL expiry.
 *
 * Usage:
 *   const lock = new RedisLock(redis);
 *   const token = await lock.acquire('lock:my-job:tenant1', 30 * 60_000);
 *   if (!token) { logger.info('lock held by another instance — skipping'); return; }
 *   try { ... } finally { await lock.release('lock:my-job:tenant1', token); }
 */

import type Redis from 'ioredis';
import crypto from 'node:crypto';

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

export class RedisLock {
  constructor(private readonly redis: Redis) {}

  /**
   * Tries to acquire the lock.
   * @returns token string if acquired, null if lock is already held.
   */
  async acquire(key: string, ttlMs: number): Promise<string | null> {
    const token = crypto.randomUUID();
    const result = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? token : null;
  }

  /**
   * Releases the lock only if the token matches (atomic CAS via Lua).
   * Safe to call even if the lock has already expired.
   */
  async release(key: string, token: string): Promise<void> {
    await this.redis.eval(RELEASE_SCRIPT, 1, key, token).catch(() => undefined);
  }
}
