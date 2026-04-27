import { TRPCError } from '@trpc/server';
import { t } from '../trpc.js';
import { withClinicContext } from '../../db/client.js';
import type { PoolClient } from 'pg';

/**
 * Garante que clinicId está presente e injeta helper withClinic no contexto.
 * Deve ser composto após isAuthenticated.
 */
export const injectClinic = t.middleware(({ ctx, next }) => {
  if (!ctx.clinicId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Contexto de clínica não encontrado no token',
    });
  }

  const clinicId = ctx.clinicId;

  return next({
    ctx: {
      ...ctx,
      clinicId,
      // Conveniência para procedures que precisam de RLS garantido
      withClinic: <T>(callback: (client: PoolClient) => Promise<T>) =>
        withClinicContext(clinicId, callback),
    },
  });
});

export type ClinicContext = {
  clinicId: string;
  withClinic: <T>(callback: (client: PoolClient) => Promise<T>) => Promise<T>;
};
