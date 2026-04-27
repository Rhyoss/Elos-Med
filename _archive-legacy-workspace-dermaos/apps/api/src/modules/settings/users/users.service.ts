import crypto from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { withClinicContext, db } from '../../../db/client.js';
import { redis } from '../../../db/redis.js';
import { logger } from '../../../lib/logger.js';
import {
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendDeactivationEmail,
} from '../../../lib/mailer.js';
import type {
  ListUsersInput,
  CreateUserInput,
  SetUserPermissionsInput,
  DeactivateUserInput,
} from '@dermaos/shared';
import { env } from '../../../config/env.js';

const INVITE_TTL_HOURS    = 72;
const RESET_TTL_HOURS     = 1;
const DEACTIVATION_TTL_S  = 30 * 24 * 3600; // 30 dias (max refresh token TTL)

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function deactivationKey(userId: string): string {
  return `dermaos:deactivated:${userId}`;
}

function assertNotSelf(requesterId: string, targetId: string): void {
  if (requesterId === targetId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Você não pode realizar esta operação no seu próprio usuário.' });
  }
}

function assertCanManageTarget(
  requesterRole: string,
  targetRole: string,
): void {
  // Admin não pode alterar outro admin nem o owner
  if (requesterRole === 'admin' && (targetRole === 'admin' || targetRole === 'owner')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Administradores não podem alterar outros administradores ou o proprietário.',
    });
  }
}

export async function listUsers(clinicId: string, input: ListUsersInput) {
  return withClinicContext(clinicId, async (client) => {
    const where: string[] = ['u.clinic_id = $1'];
    const params: unknown[] = [clinicId];
    let idx = 2;

    if (input.role) {
      where.push(`u.role = $${idx}::shared.user_role`);
      params.push(input.role);
      idx++;
    }

    if (input.status === 'active') {
      where.push(`u.is_active = true AND u.locked_until IS NULL`);
    } else if (input.status === 'inactive') {
      where.push(`u.is_active = false`);
    } else if (input.status === 'locked') {
      where.push(`u.locked_until > NOW()`);
    }

    const offset = (input.page - 1) * input.limit;
    params.push(input.limit, offset);

    const { rows } = await client.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active,
              u.failed_login_attempts, u.locked_until, u.last_login_at,
              u.created_at, u.deactivated_at
         FROM shared.users u
         WHERE ${where.join(' AND ')}
         ORDER BY u.name ASC
         LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );

    const { rows: countRows } = await client.query(
      `SELECT COUNT(*) FROM shared.users u WHERE ${where.join(' AND ')}`,
      params.slice(0, -2),
    );

    const total = parseInt(countRows[0]?.count ?? '0', 10);

    return {
      users: rows.map((u) => ({
        ...u,
        status: !u.is_active
          ? 'inactive'
          : u.locked_until && new Date(u.locked_until) > new Date()
            ? 'locked'
            : 'active',
      })),
      total,
      page:  input.page,
      limit: input.limit,
    };
  });
}

export async function createUser(
  clinicId: string,
  requesterId: string,
  input: CreateUserInput,
) {
  return withClinicContext(clinicId, async (client) => {
    // Check email uniqueness within tenant
    const { rows: dup } = await client.query(
      `SELECT id FROM shared.users WHERE clinic_id = $1 AND email = $2`,
      [clinicId, input.email.toLowerCase()],
    );
    if (dup.length > 0) {
      throw new TRPCError({ code: 'CONFLICT', message: 'E-mail já cadastrado nesta clínica.' });
    }

    // Create user with a temporary argon2 placeholder — real password set via invite
    const { rows: newUser } = await client.query(
      `INSERT INTO shared.users
         (clinic_id, name, email, password_hash, role, permissions, created_by, is_email_verified)
       VALUES ($1, $2, $3, 'INVITE_PENDING', $4::shared.user_role, $5, $6, false)
       RETURNING id, name, email, role`,
      [
        clinicId,
        input.name.trim(),
        input.email.toLowerCase(),
        input.role,
        JSON.stringify(input.permissions ?? []),
        requesterId,
      ],
    );
    const user = newUser[0];

    // Generate invitation token
    const token      = crypto.randomUUID();
    const tokenHash  = hashToken(token);
    const expiresAt  = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000);

    await client.query(
      `INSERT INTO shared.user_invitations
         (clinic_id, email, token_hash, role, permissions, invited_by, expires_at)
       VALUES ($1, $2, $3, $4::shared.user_role, $5, $6, $7)`,
      [clinicId, input.email.toLowerCase(), tokenHash, input.role, JSON.stringify(input.permissions ?? []), requesterId, expiresAt],
    );

    await client.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'settings', $2::uuid, 'settings.user_created', $3, $4)`,
      [
        clinicId,
        user.id,
        JSON.stringify({ email: input.email, role: input.role }),
        JSON.stringify({ user_id: requesterId }),
      ],
    );

    // Fetch clinic name for email
    const { rows: clinic } = await client.query(
      `SELECT name FROM shared.clinics WHERE id = $1`,
      [clinicId],
    );
    const clinicName = clinic[0]?.name ?? 'DermaOS';
    const baseUrl = env.NODE_ENV === 'production'
      ? `https://${clinic[0]?.slug ?? 'app'}.dermaos.com.br`
      : 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/convite?token=${token}`;

    setImmediate(() => sendInvitationEmail(input.email, clinicName, inviteUrl));

    return user;
  });
}

export async function setUserPermissions(
  clinicId: string,
  requesterId: string,
  requesterRole: string,
  input: SetUserPermissionsInput,
) {
  assertNotSelf(requesterId, input.userId);

  return withClinicContext(clinicId, async (client) => {
    const { rows } = await client.query(
      `SELECT id, role, permissions FROM shared.users WHERE clinic_id = $1 AND id = $2`,
      [clinicId, input.userId],
    );
    const target = rows[0];
    if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado.' });

    assertCanManageTarget(requesterRole, target.role);

    const oldPerms = target.permissions;
    await client.query(
      `UPDATE shared.users SET permissions = $1 WHERE id = $2 AND clinic_id = $3`,
      [JSON.stringify(input.permissions), input.userId, clinicId],
    );

    // Invalidate permission cache in Redis
    await redis.del(`dermaos:perms:${input.userId}`).catch(() => null);

    await client.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'settings', $2::uuid, 'settings.permissions_updated', $3, $4)`,
      [
        clinicId,
        input.userId,
        JSON.stringify({ old: oldPerms, new: input.permissions }),
        JSON.stringify({ user_id: requesterId }),
      ],
    );

    return { ok: true };
  });
}

export async function deactivateUser(
  clinicId: string,
  requesterId: string,
  requesterRole: string,
  input: DeactivateUserInput,
) {
  assertNotSelf(requesterId, input.userId);

  return withClinicContext(clinicId, async (client) => {
    const { rows } = await client.query(
      `SELECT id, name, email, role, is_active FROM shared.users WHERE clinic_id = $1 AND id = $2`,
      [clinicId, input.userId],
    );
    const target = rows[0];
    if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado.' });
    if (!target.is_active) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Usuário já está inativo.' });

    assertCanManageTarget(requesterRole, target.role);

    await client.query(
      `UPDATE shared.users
         SET is_active = false, deactivation_reason = $1, deactivated_by = $2, deactivated_at = NOW()
         WHERE id = $3 AND clinic_id = $4`,
      [input.reason, requesterId, input.userId, clinicId],
    );

    // Add to Redis deactivation blacklist — tokens rejected until expiry
    await redis.set(deactivationKey(input.userId), '1', 'EX', DEACTIVATION_TTL_S).catch(() => null);

    await client.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'settings', $2::uuid, 'settings.user_deactivated', $3, $4)`,
      [
        clinicId,
        input.userId,
        JSON.stringify({ reason: input.reason }),
        JSON.stringify({ user_id: requesterId }),
      ],
    );

    const { rows: clinic } = await client.query(
      `SELECT name FROM shared.clinics WHERE id = $1`,
      [clinicId],
    );
    setImmediate(() =>
      sendDeactivationEmail(target.email, target.name, clinic[0]?.name ?? 'DermaOS'),
    );

    return { ok: true };
  });
}

export async function reactivateUser(
  clinicId: string,
  requesterId: string,
  requesterRole: string,
  userId: string,
) {
  assertNotSelf(requesterId, userId);

  return withClinicContext(clinicId, async (client) => {
    const { rows } = await client.query(
      `SELECT id, name, email, role, is_active FROM shared.users WHERE clinic_id = $1 AND id = $2`,
      [clinicId, userId],
    );
    const target = rows[0];
    if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado.' });
    if (target.is_active) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Usuário já está ativo.' });

    assertCanManageTarget(requesterRole, target.role);

    await client.query(
      `UPDATE shared.users
         SET is_active = true, deactivation_reason = NULL, deactivated_by = NULL, deactivated_at = NULL
         WHERE id = $1 AND clinic_id = $2`,
      [userId, clinicId],
    );

    // Remove from Redis blacklist
    await redis.del(deactivationKey(userId)).catch(() => null);

    // Generate new invitation token for first login after reactivation
    const token     = crypto.randomUUID();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000);

    await client.query(
      `INSERT INTO shared.user_invitations
         (clinic_id, email, token_hash, role, invited_by, expires_at)
       VALUES ($1, $2, $3, $4::shared.user_role, $5, $6)`,
      [clinicId, target.email, tokenHash, target.role, requesterId, expiresAt],
    );

    await client.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'settings', $2::uuid, 'settings.user_reactivated', '{}', $3)`,
      [clinicId, userId, JSON.stringify({ user_id: requesterId })],
    );

    const { rows: clinic } = await client.query(`SELECT name FROM shared.clinics WHERE id = $1`, [clinicId]);
    const clinicName = clinic[0]?.name ?? 'DermaOS';
    const baseUrl = env.NODE_ENV === 'production'
      ? `https://app.dermaos.com.br`
      : 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/convite?token=${token}`;
    setImmediate(() => sendInvitationEmail(target.email, clinicName, inviteUrl));

    return { ok: true };
  });
}

export async function initiatePasswordReset(
  clinicId: string,
  requesterId: string,
  requesterIp: string | null,
  userId: string,
) {
  return withClinicContext(clinicId, async (client) => {
    const { rows } = await client.query(
      `SELECT id, email, name, is_active FROM shared.users WHERE clinic_id = $1 AND id = $2`,
      [clinicId, userId],
    );
    const target = rows[0];
    if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado.' });
    if (!target.is_active) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Usuário está inativo.' });

    // Invalidate any existing reset tokens
    await client.query(
      `UPDATE shared.password_reset_tokens SET used_at = NOW()
         WHERE user_id = $1 AND clinic_id = $2 AND used_at IS NULL`,
      [userId, clinicId],
    );

    const token     = crypto.randomUUID();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + RESET_TTL_HOURS * 3600 * 1000);

    await client.query(
      `INSERT INTO shared.password_reset_tokens
         (user_id, clinic_id, token_hash, expires_at, requested_by, requested_ip)
       VALUES ($1, $2, $3, $4, $5, $6::inet)`,
      [userId, clinicId, tokenHash, expiresAt, requesterId, requesterIp],
    );

    await client.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'settings', $2::uuid, 'settings.password_reset_initiated', $3, $4)`,
      [
        clinicId,
        userId,
        JSON.stringify({ requested_by: requesterId }),
        JSON.stringify({ user_id: requesterId, ip: requesterIp }),
      ],
    );

    const baseUrl = env.NODE_ENV === 'production'
      ? 'https://app.dermaos.com.br'
      : 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-senha?token=${token}`;
    setImmediate(() => sendPasswordResetEmail(target.email, resetUrl));

    return { ok: true };
  });
}
