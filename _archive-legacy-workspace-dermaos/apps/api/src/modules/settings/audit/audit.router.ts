import { router } from '../../../trpc/trpc.js';
import { protectedProcedure } from '../../../trpc/middleware/auth.middleware.js';
import { requireRoles } from '../../../trpc/middleware/rbac.middleware.js';
import {
  listAuditLogsSchema,
  getAuditLogDetailSchema,
  exportAuditLogsSchema,
} from '@dermaos/shared';
import {
  listAuditLogs,
  getAuditLogDetail,
  exportAuditLogs,
} from './audit.service.js';

const ownerOrAdmin = requireRoles('owner', 'admin');

export const auditSettingsRouter = router({
  list: protectedProcedure
    .use(ownerOrAdmin)
    .input(listAuditLogsSchema)
    .query(async ({ ctx, input }) => listAuditLogs(ctx.clinicId, input)),

  detail: protectedProcedure
    .use(ownerOrAdmin)
    .input(getAuditLogDetailSchema)
    .query(async ({ ctx, input }) => getAuditLogDetail(ctx.clinicId, input.eventId)),

  exportCsv: protectedProcedure
    .use(ownerOrAdmin)
    .input(exportAuditLogsSchema)
    .mutation(async ({ ctx, input }) =>
      exportAuditLogs(ctx.clinicId, ctx.user.sub, input),
    ),
});
