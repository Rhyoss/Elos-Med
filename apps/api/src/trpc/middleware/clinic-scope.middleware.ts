import { TRPCError } from '@trpc/server';
import { t } from '../trpc.js';
import { withClinicContext } from '../../db/client.js';

/**
 * SEC-02 — middleware que abre uma transação com `SET LOCAL
 * app.current_clinic_id` e publica o client no AsyncLocalStorage. Toda
 * chamada `db.query(...)` (via o proxy em `db/client.ts`) feita dentro
 * desta procedure é roteada para o client scoped, garantindo que RLS
 * isole o tenant.
 *
 * Composto automaticamente em `protectedProcedure`. Procedures públicas
 * (sem clinicId no JWT) NÃO ganham scope — devem usar funções
 * `SECURITY DEFINER` para tocar tabelas com RLS.
 */
export const withClinicScope = t.middleware(async ({ ctx, next }) => {
  if (!ctx.clinicId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'withClinicScope exige clinicId — combine com isAuthenticated',
    });
  }

  return withClinicContext(ctx.clinicId, async () => {
    return next({ ctx });
  });
});
