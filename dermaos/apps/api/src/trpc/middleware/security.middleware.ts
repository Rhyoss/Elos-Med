import { TRPCError } from '@trpc/server';
import { t } from '../trpc.js';
import { db } from '../../db/client.js';
import { redis } from '../../db/redis.js';
import {
  isJtiBlacklisted,
  getCurrentPasswordVersion,
  isSessionActive,
  touchActivity,
} from '../../modules/security/session.service.js';

/**
 * Hardening de sessão (Prompt 20):
 *   1. JTI no blacklist  → 401
 *   2. password_version diverge → 401 (todas as sessões anteriores invalidadas)
 *   3. idle timeout esgotado → 401 (re-autenticação)
 *   Toca last_activity em Redis a cada request bem-sucedido.
 */
export const sessionHardening = t.middleware(async ({ ctx, next }) => {
  const user = ctx.user;
  if (!user || !user.sub) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Autenticação necessária' });
  }

  const jti = (user as { jti?: string }).jti;
  if (jti && (await isJtiBlacklisted(redis, jti))) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sessão invalidada' });
  }

  const tokenVersion = (user as { pv?: number }).pv ?? 1;
  const currentVersion = await getCurrentPasswordVersion(redis, db, user.sub);
  if (tokenVersion !== currentVersion) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Sua senha foi alterada. Faça login novamente.',
    });
  }

  // Idle timeout — só aplica se já houver entrada (login original criou).
  // Heartbeat do frontend deve evitar expirar durante upload/edição ativa.
  const active = await isSessionActive(redis, user.sub);
  if (!active) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Sessão expirada por inatividade. Faça login novamente.',
    });
  }

  await touchActivity(redis, user.sub);

  return next({ ctx });
});

export const securedProcedure = t.procedure.use(sessionHardening);
