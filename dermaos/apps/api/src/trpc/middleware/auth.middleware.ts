import { TRPCError } from '@trpc/server';
import { t } from '../trpc.js';
import { redis } from '../../db/redis.js';

/**
 * Middleware que exige JWT válido.
 * Também verifica se o usuário está no blacklist de desativação (Redis).
 */
export const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.clinicId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Autenticação necessária' });
  }

  // Rejeita imediatamente usuários desativados — Redis blacklist com TTL = 30d
  const deactivated = await redis.get(`dermaos:deactivated:${ctx.user.sub}`).catch(() => null);
  if (deactivated) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Conta desativada. Entre em contato com o administrador da clínica.',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      clinicId: ctx.clinicId,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthenticated);
