import { TRPCError } from '@trpc/server';
import { t } from '../trpc.js';
import { withClinicScope } from './clinic-scope.middleware.js';
import { auditPHIAccess, auditMutation } from './audit.middleware.js';
import type { TrpcContext } from '../context.js';

/**
 * Tipo do contexto após `isAuthenticated` — `user` e `clinicId` deixaram
 * de ser nulláveis. Usado por `requireRoles`/`requirePermission` para
 * estreitar o tipo sem `as` em cada middleware.
 */
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

/**
 * Procedure protegida — exige JWT válido E aplica o scope multi-tenant.
 *
 * SEC-02: o `withClinicScope` abre uma transação com `SET LOCAL
 * app.current_clinic_id` e publica o client via AsyncLocalStorage. Toda
 * `db.query(...)` dentro da procedure passa por esse client, ativando RLS
 * automaticamente.
 *
 * Para rotas que não exigem scope (raras: e.g. login, refresh), use
 * `publicProcedure` direto e funções SECURITY DEFINER para acessos
 * pré-auth. Veja `db/init/100_security_definer_functions.sql`.
 */
export const protectedProcedure = t.procedure
  .use(isAuthenticated)
  .use(withClinicScope);

/**
 * Procedure protegida + audit trail completo (LGPD art. 37, CFM):
 *   - `auditMutation`: registra mutations em `audit.domain_events`.
 *   - `auditPHIAccess`: registra leituras de PHI em `audit.access_log`.
 *
 * SEC-16: usar este procedure em routers que tocam dados clínicos
 * (clinical/*, patients/*, prescriptions/*, lesions/*, scheduling/*).
 * Ambos os middlewares fazem o write em setImmediate via
 * `withClinicContext` próprio — não bloqueiam a resposta.
 */
export const auditedProcedure = t.procedure
  .use(isAuthenticated)
  .use(withClinicScope)
  .use(auditPHIAccess)
  .use(auditMutation);
