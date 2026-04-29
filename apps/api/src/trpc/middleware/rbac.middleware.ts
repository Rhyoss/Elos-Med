import { TRPCError } from '@trpc/server';
import { t } from '../trpc.js';
import {
  type UserRole,
  type Resource,
  type Action,
  checkPermission,
  getPermissionsForRole,
} from '@dermaos/shared';
import { withClinicContext } from '../../db/client.js';
import { logger } from '../../lib/logger.js';
import type { AuthenticatedContext } from './auth.middleware.js';

/**
 * Exige que o usuário tenha um dos roles especificados.
 * Sempre combinar com isAuthenticated.
 */
export function requireRoles(...roles: UserRole[]) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    if (!roles.includes(ctx.user.role as UserRole)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Acesso restrito. Papéis permitidos: ${roles.join(', ')}`,
      });
    }

    return next({ ctx: ctx as AuthenticatedContext });
  });
}

/**
 * Exige permissão granular resource+action.
 * Sempre combinar com isAuthenticated.
 */
export function requirePermission(resource: Resource, action: Action) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    const role = ctx.user.role as UserRole;
    const permMap = getPermissionsForRole(role);

    if (!checkPermission(permMap, resource, action)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Permissão insuficiente: ${resource}.${action}`,
      });
    }

    return next({ ctx: ctx as AuthenticatedContext });
  });
}

/**
 * Registra acesso a recursos sensíveis em audit.access_log.
 * Deve ser composto após isAuthenticated.
 *
 * SEC-02: o write do audit acontece em `setImmediate` para não bloquear a
 * resposta — mas isso quebra o AsyncLocalStorage da request original.
 * Capturamos os valores localmente e abrimos um NOVO `withClinicContext`
 * (transação curta + SET LOCAL app.current_clinic_id) para o INSERT.
 */
export const withAudit = t.middleware(async ({ ctx, path, next }) => {
  const result = await next({ ctx });

  if (ctx.user && ctx.clinicId) {
    // Capturar tudo localmente — `ctx` pode ser GC'd antes do setImmediate rodar.
    const clinicId    = ctx.clinicId;
    const userId      = ctx.user.sub;
    const resourceType = path.split('.')[0] ?? 'trpc';
    const action      = result.ok ? 'read' : 'error';
    const ipAddress   = ctx.req.ip;
    const requestPath = path;

    setImmediate(async () => {
      try {
        await withClinicContext(clinicId, async (client) => {
          await client.query(
            `INSERT INTO audit.access_log
               (clinic_id, user_id, resource_type, resource_id, action, ip_address, request_path)
             VALUES ($1, $2, $3, $4, $5, $6::inet, $7)`,
            [clinicId, userId, resourceType, userId, action, ipAddress, requestPath],
          );
        });
      } catch (err) {
        logger.error({ err, path: requestPath }, 'Audit log write failed');
      }
    });
  }

  return result;
});
