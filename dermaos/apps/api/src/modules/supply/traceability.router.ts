import { z } from 'zod';
import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import {
  tracebackByLotSchema,
  tracebackByPatientSchema,
  generateRecallReportSchema,
  downloadRecallReportSchema,
  checkPermission,
  getPermissionsForRole,
  type UserRole,
} from '@dermaos/shared';
import {
  tracebackByLot,
  tracebackByPatient,
  generateRecallReport,
  downloadRecallReport,
  type TraceabilityContext,
} from './traceability.service.js';

function buildTraceCtx(ctx: {
  clinicId: string | null;
  user: { sub: string; role?: string } | null;
  req: { ip: string | null };
}): TraceabilityContext {
  const role = (ctx.user?.role ?? 'readonly') as UserRole;
  const perms = getPermissionsForRole(role);
  const canRecall = checkPermission(perms, 'traceability', 'recall');
  return {
    clinicId:  ctx.clinicId!,
    userId:    ctx.user?.sub ?? null,
    ipOrigin:  ctx.req.ip ?? null,
    canRecall,
  };
}

export const traceabilityRouter = router({
  byLot: protectedProcedure
    .use(requirePermission('traceability', 'read'))
    .input(tracebackByLotSchema)
    .query(async ({ input, ctx }) => tracebackByLot(input, buildTraceCtx(ctx))),

  byPatient: protectedProcedure
    .use(requirePermission('traceability', 'read'))
    .input(tracebackByPatientSchema)
    .query(async ({ input, ctx }) => tracebackByPatient(input, buildTraceCtx(ctx))),

  generateReport: protectedProcedure
    .use(requirePermission('traceability', 'recall'))
    .input(generateRecallReportSchema)
    .mutation(async ({ input, ctx }) => generateRecallReport(input, buildTraceCtx(ctx))),

  downloadReport: protectedProcedure
    .use(requirePermission('traceability', 'recall'))
    .input(downloadRecallReportSchema)
    .query(async ({ input, ctx }) => downloadRecallReport(input.reportId, buildTraceCtx(ctx))),

  listReports: protectedProcedure
    .use(requirePermission('traceability', 'recall'))
    .input(z.object({
      page:  z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(25),
    }))
    .query(async ({ input, ctx }) => {
      const offset = (input.page - 1) * input.limit;
      const r = await ctx.db.query(
        `SELECT id, report_type, scope_lot_id, scope_patient_id,
                sha256_hex, size_bytes, generated_at, generated_by, metadata
           FROM supply.traceability_reports
          WHERE clinic_id = $1
          ORDER BY generated_at DESC
          LIMIT $2 OFFSET $3`,
        [ctx.clinicId, input.limit, offset],
      );
      const c = await ctx.db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM supply.traceability_reports WHERE clinic_id = $1`,
        [ctx.clinicId],
      );
      return { data: r.rows, total: parseInt(c.rows[0]?.count ?? '0', 10) };
    }),
});
