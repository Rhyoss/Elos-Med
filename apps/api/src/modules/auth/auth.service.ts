import argon2 from 'argon2';
import crypto from 'node:crypto';
import { TRPCError } from '@trpc/server';
import type { Pool } from 'pg';
import type Redis from 'ioredis';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

const REFRESH_TTL_SEC = 60 * 60 * 24 * 7; // 7 dias
const RESET_TTL_SEC = 60 * 15;             // 15 minutos

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export async function registerUser(
  db: Pool,
  data: {
    clinicId: string;
    name: string;
    email: string;
    password: string;
    role: string;
  },
) {
  const existing = await db.query(
    'SELECT id FROM shared.users WHERE email = $1 AND clinic_id = $2',
    [data.email, data.clinicId],
  );

  if (existing.rows[0]) {
    throw new TRPCError({ code: 'CONFLICT', message: 'Email já cadastrado nesta clínica' });
  }

  const passwordHash = await hashPassword(data.password);

  const result = await db.query<{
    id: string; clinic_id: string; name: string; email: string; role: string;
  }>(
    `INSERT INTO shared.users (clinic_id, name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, clinic_id, name, email, role`,
    [data.clinicId, data.name, data.email, passwordHash, data.role],
  );

  return result.rows[0]!;
}

export async function storeRefreshToken(
  redis: Redis,
  userId: string,
  token: string,
): Promise<void> {
  await redis.set(`rt:${userId}`, hashToken(token), 'EX', REFRESH_TTL_SEC);
}

export async function validateAndRevokeRefreshToken(
  redis: Redis,
  userId: string,
  token: string,
): Promise<boolean> {
  const stored = await redis.get(`rt:${userId}`);
  if (!stored || stored !== hashToken(token)) return false;
  // Revoke immediately (rotation — cannot reuse)
  await redis.del(`rt:${userId}`);
  return true;
}

export async function revokeRefreshToken(redis: Redis, userId: string): Promise<void> {
  await redis.del(`rt:${userId}`);
}

export async function changePassword(
  db: Pool,
  redis: Redis,
  userId: string,
  clinicId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const result = await db.query<{ password_hash: string }>(
    'SELECT password_hash FROM shared.users WHERE id = $1 AND clinic_id = $2 AND is_active = TRUE',
    [userId, clinicId],
  );

  const user = result.rows[0];
  if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });

  const valid = await verifyPassword(user.password_hash, currentPassword);
  if (!valid) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Senha atual incorreta' });
  }

  const newHash = await hashPassword(newPassword);

  await db.query(
    `UPDATE shared.users
     SET password_hash = $1, password_changed_at = NOW(), failed_login_attempts = 0
     WHERE id = $2`,
    [newHash, userId],
  );

  await revokeRefreshToken(redis, userId);
}

export async function forgotPassword(db: Pool, redis: Redis, email: string): Promise<void> {
  const result = await db.query<{ id: string; name: string }>(
    'SELECT id, name FROM shared.users WHERE email = $1 AND is_active = TRUE LIMIT 1',
    [email],
  );

  // Resposta silenciosa — não vaza se email existe
  if (!result.rows[0]) return;

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);

  await redis.set(`pwd_reset:${tokenHash}`, result.rows[0].id, 'EX', RESET_TTL_SEC);

  // TODO: integrar com serviço de email (SMTP / SendGrid)
  if (process.env['NODE_ENV'] !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`[DEV] Reset token para ${email}: ${token}`);
  }
}

export async function resetPassword(
  db: Pool,
  redis: Redis,
  token: string,
  newPassword: string,
): Promise<void> {
  const tokenHash = hashToken(token);
  const userId = await redis.get(`pwd_reset:${tokenHash}`);

  if (!userId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Token inválido ou expirado' });
  }

  const newHash = await hashPassword(newPassword);

  await db.query(
    `UPDATE shared.users
     SET password_hash = $1, password_changed_at = NOW(), failed_login_attempts = 0, locked_until = NULL
     WHERE id = $2`,
    [newHash, userId],
  );

  await redis.del(`pwd_reset:${tokenHash}`);
  await revokeRefreshToken(redis, userId);
}
