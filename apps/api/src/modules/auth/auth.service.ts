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

// SEC-14: refresh tokens indexados por (userId, jti) — múltiplas sessões
// por usuário (mobile + desktop), cada uma com TTL próprio. Rotação é
// pontual: revogar o jti expirado não derruba as outras sessões.

function rtKey(userId: string, jti: string): string {
  return `rt:${userId}:${jti}`;
}

export async function storeRefreshToken(
  redis: Redis,
  userId: string,
  jti: string,
  token: string,
): Promise<void> {
  await redis.set(rtKey(userId, jti), hashToken(token), 'EX', REFRESH_TTL_SEC);
  // Set de jtis ativos do usuário para listar/revogar sessões.
  await redis.sadd(`rt_index:${userId}`, jti);
  await redis.expire(`rt_index:${userId}`, REFRESH_TTL_SEC);
}

export async function validateAndRevokeRefreshToken(
  redis: Redis,
  userId: string,
  jti: string,
  token: string,
): Promise<boolean> {
  const stored = await redis.get(rtKey(userId, jti));
  if (!stored || stored !== hashToken(token)) return false;
  // Rotação atômica — token usado não pode ser reapresentado.
  await redis.del(rtKey(userId, jti));
  await redis.srem(`rt_index:${userId}`, jti);
  return true;
}

export async function revokeRefreshToken(
  redis: Redis,
  userId: string,
  jti?: string,
): Promise<void> {
  if (jti) {
    await redis.del(rtKey(userId, jti));
    await redis.srem(`rt_index:${userId}`, jti);
    return;
  }
  // Sem jti = revogação global (logout-all-devices, password reset).
  const all = await redis.smembers(`rt_index:${userId}`);
  if (all.length > 0) {
    await redis.del(...all.map((j) => rtKey(userId, j)));
  }
  await redis.del(`rt_index:${userId}`);
}

export async function changePassword(
  db: Pool,
  redis: Redis,
  userId: string,
  clinicId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  // SEC-02: chamada DENTRO de procedure protegida — `db` aqui já é o proxy
  // scoped (RLS aplicada). O filtro `clinic_id = $2` adiciona defense in depth.
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

  // SEC-02: a função SD `apply_password_reset` reseta hash, lockout e
  // failed_attempts atomicamente — mesmo caminho de resetPassword.
  await db.query(`SELECT shared.apply_password_reset($1, $2)`, [userId, newHash]);

  await revokeRefreshToken(redis, userId);
}

export async function forgotPassword(db: Pool, redis: Redis, email: string): Promise<void> {
  // SEC-02: rota pré-tenant — usa função SECURITY DEFINER.
  const result = await db.query<{ id: string; name: string }>(
    `SELECT * FROM shared.find_user_id_by_email($1)`,
    [email],
  );

  // Resposta silenciosa — não vaza se email existe
  if (!result.rows[0]) return;

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);

  await redis.set(`pwd_reset:${tokenHash}`, result.rows[0].id, 'EX', RESET_TTL_SEC);

  // SEC-19: NUNCA logamos o token em texto plano. Em dev, configurar
  // mailer (MailHog/Mailpit) para inspecionar o email. O token é hashado
  // no Redis (TTL 15 min). Falha de email é silenciosa — não vaza
  // existência do email.
  const resetUrl = `${process.env['APP_URL'] ?? 'http://localhost:3000'}/auth/reset?token=${encodeURIComponent(token)}`;
  try {
    const { sendPasswordResetEmail } = await import('../../lib/mailer.js');
    await sendPasswordResetEmail(email, '', resetUrl);
  } catch {
    // ignore
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

  // SEC-02: rota pré-tenant — usa função SECURITY DEFINER.
  await db.query(`SELECT shared.apply_password_reset($1, $2)`, [userId, newHash]);

  await redis.del(`pwd_reset:${tokenHash}`);
  await revokeRefreshToken(redis, userId);
}
