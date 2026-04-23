import { TRPCError } from '@trpc/server';
import { t } from '../trpc.js';

/**
 * Middleware que exige JWT válido.
 * Rejeita com UNAUTHORIZED se não há usuário autenticado no contexto.
 */
export const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.user || !ctx.clinicId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Autenticação necessária' });
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
