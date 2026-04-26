import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import type { Pool } from 'pg';
import type Redis from 'ioredis';
import { logger } from '../../lib/logger.js';

const BCRYPT_ROUNDS = 12;
const ACCESS_TTL_SEC  = 15 * 60;         // 15 minutos
const REFRESH_TTL_SEC = 7 * 24 * 3600;  // 7 dias
const MAGIC_TTL_SEC   = 24 * 3600;      // 24 horas

// Lockout progressivo: {falhas: segundos}
const LOCKOUT_MAP: [number, number][] = [
  [5,  15 * 60],    // 5 falhas  → 15 min
  [10,  1 * 3600],  // 10 falhas → 1h
  [15, 24 * 3600],  // 15+ falhas → 24h
];

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

function getLockoutSeconds(attempts: number): number {
  for (let i = LOCKOUT_MAP.length - 1; i >= 0; i--) {
    if (attempts >= LOCKOUT_MAP[i]![0]) return LOCKOUT_MAP[i]![1]!;
  }
  return 0;
}

// ─── Password ─────────────────────────────────────────────────────────────────

export async function hashPortalPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPortalPassword(hash: string, password: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Login com proteção contra timing attack ──────────────────────────────────

export interface PortalPatientRow {
  id:                      string;
  clinic_id:               string;
  portal_email:            string | null;
  portal_password_hash:    string | null;
  portal_enabled:          boolean;
  portal_email_verified:   boolean;
  portal_failed_attempts:  number;
  portal_locked_until:     Date | null;
  portal_captcha_required: boolean;
  status:                  string;
}

export async function findPortalPatient(
  db: Pool,
  email: string,
  clinicSlug: string,
): Promise<PortalPatientRow | null> {
  const r = await db.query<PortalPatientRow>(
    `SELECT p.id, p.clinic_id, p.portal_email, p.portal_password_hash,
            p.portal_enabled, p.portal_email_verified, p.portal_failed_attempts,
            p.portal_locked_until, p.portal_captcha_required, p.status
     FROM shared.patients p
     JOIN shared.clinics  c ON c.id = p.clinic_id
     WHERE c.slug = $1
       AND p.portal_email = $2
       AND p.deleted_at IS NULL
     LIMIT 1`,
    [clinicSlug, email.toLowerCase().trim()],
  );
  return r.rows[0] ?? null;
}

export async function recordLoginAttempt(
  db: Pool,
  identifier: string,
  identifierType: 'email' | 'ip',
  success: boolean,
  ip: string | null,
): Promise<void> {
  await db.query(
    `INSERT INTO portal.login_attempts (identifier, identifier_type, success, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [identifier, identifierType, success, ip],
  );
}

export async function updateFailedAttempts(
  db: Pool,
  patientId: string,
  attempts: number,
): Promise<void> {
  const lockoutSec = getLockoutSeconds(attempts);
  const lockedUntil = lockoutSec > 0
    ? new Date(Date.now() + lockoutSec * 1000)
    : null;
  const captchaRequired = attempts >= 3;

  await db.query(
    `UPDATE shared.patients
     SET portal_failed_attempts  = $1,
         portal_locked_until     = $2,
         portal_captcha_required = $3,
         updated_at              = NOW()
     WHERE id = $4`,
    [attempts, lockedUntil, captchaRequired, patientId],
  );
}

export async function resetFailedAttempts(
  db: Pool,
  patientId: string,
  ip: string | null,
): Promise<void> {
  await db.query(
    `UPDATE shared.patients
     SET portal_failed_attempts  = 0,
         portal_locked_until     = NULL,
         portal_captcha_required = FALSE,
         portal_last_login_at    = NOW(),
         portal_last_login_ip    = $2,
         updated_at              = NOW()
     WHERE id = $1`,
    [patientId, ip],
  );
}

// ─── Magic Links ──────────────────────────────────────────────────────────────

export async function createMagicLink(
  db: Pool,
  patientId: string,
  purpose: 'first_access' | 'password_reset' | 'email_change' | 'account_unlock' | 'email_verify',
  metadata: Record<string, unknown> = {},
  ip: string | null = null,
): Promise<string> {
  // Invalida links anteriores do mesmo purpose
  await db.query(
    `UPDATE portal.magic_links SET used_at = NOW()
     WHERE patient_id = $1 AND purpose = $2 AND used_at IS NULL`,
    [patientId, purpose],
  );

  const token = randomToken(32);
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + MAGIC_TTL_SEC * 1000);

  await db.query(
    `INSERT INTO portal.magic_links (patient_id, token_hash, purpose, metadata, expires_at, created_by_ip)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [patientId, tokenHash, purpose, JSON.stringify(metadata), expiresAt, ip],
  );

  return token;
}

export async function consumeMagicLink(
  db: Pool,
  token: string,
  purpose: string,
): Promise<{ patientId: string; metadata: Record<string, unknown> } | null> {
  const tokenHash = sha256(token);

  const r = await db.query<{
    id: string; patient_id: string; metadata: Record<string, unknown>;
  }>(
    `SELECT id, patient_id, metadata
     FROM portal.magic_links
     WHERE token_hash = $1
       AND purpose    = $2
       AND used_at    IS NULL
       AND expires_at > NOW()
     FOR UPDATE SKIP LOCKED`,
    [tokenHash, purpose],
  );

  if (!r.rows[0]) return null;

  await db.query(
    'UPDATE portal.magic_links SET used_at = NOW() WHERE id = $1',
    [r.rows[0].id],
  );

  return { patientId: r.rows[0].patient_id, metadata: r.rows[0].metadata ?? {} };
}

// ─── Refresh Token Rotation ───────────────────────────────────────────────────

export async function createRefreshToken(
  db: Pool,
  patientId: string,
  family: string | null,
  ip: string | null,
  userAgent: string | null,
): Promise<string> {
  const token = randomToken(48);
  const tokenHash = sha256(token);
  const tokenFamily = family ?? randomToken(16);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);

  await db.query(
    `INSERT INTO portal.refresh_tokens
       (patient_id, token_hash, family, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [patientId, tokenHash, tokenFamily, expiresAt, ip, userAgent],
  );

  return token;
}

export async function rotateRefreshToken(
  db: Pool,
  oldToken: string,
  ip: string | null,
  userAgent: string | null,
): Promise<{ patientId: string; newToken: string } | null> {
  const oldHash = sha256(oldToken);

  const r = await db.query<{
    id: string; patient_id: string; family: string; revoked_at: Date | null;
  }>(
    `SELECT id, patient_id, family, revoked_at
     FROM portal.refresh_tokens
     WHERE token_hash = $1 AND expires_at > NOW()
     FOR UPDATE SKIP LOCKED`,
    [oldHash],
  );

  const row = r.rows[0];
  if (!row) return null;

  // Detecção de roubo: token da mesma família já foi revogado → invalida TODOS
  if (row.revoked_at !== null) {
    logger.warn({ patientId: row.patient_id, family: row.family }, 'Portal: refresh token theft detected — revoking all tokens');
    await db.query(
      `UPDATE portal.refresh_tokens SET revoked_at = NOW()
       WHERE patient_id = $1 AND revoked_at IS NULL`,
      [row.patient_id],
    );
    return null;
  }

  // Revogar token atual
  await db.query(
    'UPDATE portal.refresh_tokens SET revoked_at = NOW() WHERE id = $1',
    [row.id],
  );

  // Emitir novo token na mesma família
  const newToken = await createRefreshToken(db, row.patient_id, row.family, ip, userAgent);

  return { patientId: row.patient_id, newToken };
}

export async function revokeAllRefreshTokens(
  db: Pool,
  patientId: string,
): Promise<void> {
  await db.query(
    'UPDATE portal.refresh_tokens SET revoked_at = NOW() WHERE patient_id = $1 AND revoked_at IS NULL',
    [patientId],
  );
}

// ─── Blacklist de tokens (Redis) para o período de 15min do access token ──────

export async function blacklistAccessToken(
  redis: Redis,
  jti: string,
): Promise<void> {
  await redis.set(`portal:blacklist:${jti}`, '1', 'EX', ACCESS_TTL_SEC);
}

export async function isAccessTokenBlacklisted(
  redis: Redis,
  jti: string,
): Promise<boolean> {
  return (await redis.exists(`portal:blacklist:${jti}`)) === 1;
}

// ─── Captcha rate-limit key (Redis) ──────────────────────────────────────────

export async function isCaptchaRequiredForIp(redis: Redis, ip: string): Promise<boolean> {
  const attempts = await redis.get(`portal:ip:${ip}`);
  return parseInt(attempts ?? '0', 10) >= 3;
}

export async function incrementIpAttempts(redis: Redis, ip: string): Promise<void> {
  const key = `portal:ip:${ip}`;
  await redis.incr(key);
  await redis.expire(key, 3600);
}

export async function resetIpAttempts(redis: Redis, ip: string): Promise<void> {
  await redis.del(`portal:ip:${ip}`);
}

// ─── Definição do shape do JWT do portal ─────────────────────────────────────

export interface PortalJwtPayload {
  sub:       string;   // patient_id
  clinicId:  string;
  aud:       string;   // 'patient-portal' — rejeitar qualquer outro
  jti:       string;   // ID único do token para blacklist
  iat:       number;
  exp:       number;
}
