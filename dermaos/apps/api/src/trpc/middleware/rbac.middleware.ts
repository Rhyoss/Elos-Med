import { TRPCError } from '@trpc/server';
import { t } from '../trpc.js';
import {
  type UserRole,
  type Resource,
  type Action,
  checkPermission,
  getPermissionsForRole,
} from '@dermaos/shared';
import { db } from '../../db/client.js';
import { logger } from '../../lib/logger.js';

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

    return next({ ctx });
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

    return next({ ctx });
  });
}

/**
 * Registra acesso a recursos sensíveis em audit.access_log.
 * Deve ser composto após isAuthenticated.
 */
export const withAudit = t.middleware(async ({ ctx, path, next }) => {
  const result = await next({ ctx });

  if (ctx.user && ctx.clinicId) {
    setImmediate(async () => {
      try {
        await db.query(
          `INSERT INTO audit.access_log
             (clinic_id, user_id, resource_type, resource_id, action, ip_address, request_path)
           VALUES ($1, $2, $3, $4, $5, $6::inet, $7)`,
          [
            ctx.clinicId,
            ctx.user?.sub,
            path.split('.')[0] ?? 'trpc',
            ctx.user?.sub ?? 'unknown',
            result.ok ? 'read' : 'error',
            ctx.req.ip,
            path,
          ],
        );
      } catch (err) {
        logger.error({ err, path }, 'Audit log write failed');
      }
    });
  }

  return result;
});
