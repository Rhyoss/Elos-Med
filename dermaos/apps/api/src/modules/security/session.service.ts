import crypto from 'node:crypto';
import type { Pool } from 'pg';
import type Redis from 'ioredis';
import { env } from '../../config/env.js';
import { hashIp } from '../../lib/encryption.js';
import { logger } from '../../lib/logger.js';

/**
 * Sessão segura — Prompt 20:
 *   • password_version: invalida todos os tokens em troca de senha
 *   • known_ip_hashes:  detecta IP novo → emite security_event 'login.new_ip'
 *   • idle timeout:     refresh de last_activity em Redis com TTL
 *   • token blacklist:  jti adicionado ao Redis ao logout (TTL = exp - now)
 */

const KNOWN_IPS_LIMIT = 5;
const SECURITY_QUEUE_PREFIX = 'dermaos:security:event-pending';

// ─── Token blacklist ─────────────────────────────────────────────────────────

function blacklistKey(jti: string): string {
  return `dermaos:jwt:blacklisted:${jti}`;
}

/**
 * Adiciona JTI ao blacklist com TTL = tempo restante até expiração.
 * Uso: logout, troca de senha, desativação de conta.
 */
export async function blacklistJti(redis: Redis, jti: string, expSeconds: number): Promise<void> {
  const ttl = Math.max(60, expSeconds);
  await redis.set(blacklistKey(jti), '1', 'EX', ttl);
}

export async function isJtiBlacklisted(redis: Redis, jti: string): Promise<boolean> {
  const value = await redis.get(blacklistKey(jti));
  return value === '1';
}

// ─── Password version ────────────────────────────────────────────────────────

const PWD_VERSION_CACHE_PREFIX = 'dermaos:user:pwdver';

export async function getCurrentPasswordVersion(
  redis: Redis,
  db: Pool,
  userId: string,
): Promise<number> {
  const cacheKey = `${PWD_VERSION_CACHE_PREFIX}:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached !== null) return Number(cached);

  const result = await db.query<{ password_version: number }>(
    'SELECT password_version FROM shared.users WHERE id = $1',
    [userId],
  );
  const version = result.rows[0]?.password_version ?? 1;
  await redis.set(cacheKey, String(version), 'EX', 60); // cache curto — invalidado em troca
  return version;
}

/** Incrementa password_version; invalida cache; remove refresh token. */
export async function bumpPasswordVersion(
  redis: Redis,
  db: Pool,
  userId: string,
): Promise<number> {
  const result = await db.query<{ password_version: number }>(
    `UPDATE shared.users
       SET password_version = password_version + 1,
           password_changed_at = NOW()
     WHERE id = $1
     RETURNING password_version`,
    [userId],
  );
  const newVersion = result.rows[0]?.password_version ?? 2;
  await redis.del(`${PWD_VERSION_CACHE_PREFIX}:${userId}`);
  // Refresh tokens vivos não conseguem mais renovar — versão diverge.
  await redis.del(`rt:${userId}`);
  return newVersion;
}

// ─── Idle timeout (sliding) ──────────────────────────────────────────────────

const ACTIVITY_KEY_PREFIX = 'dermaos:user:lastactivity';

/** Atualiza last_activity em Redis com TTL = SESSION_IDLE_TIMEOUT_SEC. */
export async function touchActivity(redis: Redis, userId: string): Promise<void> {
  await redis.set(
    `${ACTIVITY_KEY_PREFIX}:${userId}`,
    Date.now().toString(),
    'EX',
    env.SESSION_IDLE_TIMEOUT_SEC,
  );
}

/** True se sessão ainda ativa (within idle window). */
export async function isSessionActive(redis: Redis, userId: string): Promise<boolean> {
  const last = await redis.get(`${ACTIVITY_KEY_PREFIX}:${userId}`);
  return last !== null;
}

export async function clearActivity(redis: Redis, userId: string): Promise<void> {
  await redis.del(`${ACTIVITY_KEY_PREFIX}:${userId}`);
}

// ─── IP detection ────────────────────────────────────────────────────────────

interface IpDetectionResult {
  isNewIp: boolean;
  ipHash:  string;
}

/**
 * Verifica se o IP é conhecido para o usuário. Retorna isNewIp=true quando
 * for o primeiro hit (caller deve disparar email de alerta + audit event).
 *
 * Mantém últimos KNOWN_IPS_LIMIT IPs em known_ip_hashes (LIFO via array_remove
 * + array_prepend — feito atomicamente no UPDATE).
 */
export async function recordLoginIp(
  db: Pool,
  userId: string,
  ip: string,
): Promise<IpDetectionResult> {
  const ipHash = hashIp(ip);

  // Lê estado anterior, decide isNewIp, depois faz update na lista.
  const prev = await db.query<{ known_ip_hashes: string[] }>(
    'SELECT known_ip_hashes FROM shared.users WHERE id = $1',
    [userId],
  );
  const known = prev.rows[0]?.known_ip_hashes ?? [];
  const isNewIp = !known.includes(ipHash);

  // LIFO: remove ipHash existente (se houver), prepend, trunca a KNOWN_IPS_LIMIT.
  const next = [ipHash, ...known.filter((h) => h !== ipHash)].slice(0, KNOWN_IPS_LIMIT);
  await db.query(
    'UPDATE shared.users SET known_ip_hashes = $2 WHERE id = $1',
    [userId, next],
  );

  return { isNewIp, ipHash };
}

// ─── Geo lookup (placeholder) ────────────────────────────────────────────────

/**
 * Lookup de geolocalização. Em produção, MaxMind GeoLite2 local (sem call externa).
 * Aqui devolvemos vazio — caller registra apenas IP no security_event.
 */
export function geoLookup(_ip: string): { city?: string; country?: string; asn?: string } {
  return {};
}

// ─── Security events ─────────────────────────────────────────────────────────

interface SecurityEventInput {
  clinicId:       string;
  userId:         string | null;
  eventType:      string;            // ex: 'login.new_ip', 'login.password_invalidated'
  severity?:      'info' | 'warning' | 'critical';
  ip?:            string | null;
  userAgent?:     string | null;
  metadata?:      Record<string, unknown>;
  correlationId?: string;
}

export async function recordSecurityEvent(
  db: Pool,
  input: SecurityEventInput,
): Promise<void> {
  try {
    await db.query(
      `SELECT audit.log_security_event($1, $2, $3, $4, $5::inet, $6, $7::jsonb, $8::uuid)`,
      [
        input.clinicId,
        input.userId,
        input.eventType,
        input.severity ?? 'info',
        input.ip ?? null,
        input.userAgent ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.correlationId ?? null,
      ],
    );
  } catch (err) {
    logger.error({ err, eventType: input.eventType }, '[security] failed to record event');
  }
}

/** Gera JTI determinístico para JWTs (caller assina o token com payload contendo `jti`). */
export function newJti(): string {
  return crypto.randomUUID();
}

export const SECURITY = {
  KNOWN_IPS_LIMIT,
  SECURITY_QUEUE_PREFIX,
};
