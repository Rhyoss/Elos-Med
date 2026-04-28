import { TRPCError } from '@trpc/server';
import { t } from '../trpc.js';
import type { TrpcContext } from '../context.js';

export type AuthenticatedContext = TrpcContext & {
  user: NonNullable<TrpcContext['user']>;
  clinicId: string;
};

/**
 * Middleware que exige JWT válido.
 * Rejeita com UNAUTHORIZED se não há usuário autenticado no contexto.
 */
export const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.user || !ctx.clinicId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Autenticação necessária' });
  }
  const user = ctx.user;
  const clinicId = ctx.clinicId;

  return next({
    ctx: {
      ...ctx,
      user,
      clinicId,
    } satisfies AuthenticatedContext,
  });
});

export const protectedProcedure = t.procedure.use(isAuthenticated);
