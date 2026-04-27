import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import {
  analyticsOverviewInput,
  patientJourneyInput,
  supplyIntelligenceInput,
  omniPerformanceInput,
  financialAdvancedInput,
  analyticsExportInput,
} from '@dermaos/shared';
import {
  getOverview,
  getPatientJourney,
  getSupplyIntelligence,
  getOmniPerformance,
  getFinancialAdvanced,
} from './analytics.service.js';
import { generatePdf, generateCsv } from './analytics.exports.js';

/**
 * DermaIQ Analytics — exige `analytics.read` (dermatologistas, gestores e financeiro têm).
 * Exports exigem `analytics.export` (gestores e financeiro).
 */
export const analyticsRouter = router({
  overview: protectedProcedure
    .use(requirePermission('analytics', 'read'))
    .input(analyticsOverviewInput)
    .query(async ({ ctx, input }) => getOverview(ctx.clinicId!, input)),

  journey: protectedProcedure
    .use(requirePermission('analytics', 'read'))
    .input(patientJourneyInput)
    .query(async ({ ctx, input }) => getPatientJourney(ctx.clinicId!, input)),

  supply: protectedProcedure
    .use(requirePermission('analytics', 'read'))
    .input(supplyIntelligenceInput)
    .query(async ({ ctx, input }) => getSupplyIntelligence(ctx.clinicId!, input)),

  omni: protectedProcedure
    .use(requirePermission('analytics', 'read'))
    .input(omniPerformanceInput)
    .query(async ({ ctx, input }) => getOmniPerformance(ctx.clinicId!, input)),

  financial: protectedProcedure
    .use(requirePermission('analytics', 'read'))
    .input(financialAdvancedInput)
    .query(async ({ ctx, input }) => getFinancialAdvanced(ctx.clinicId!, input)),

  /**
   * Exportações auditadas — geram PDF (HTML imprimível) ou CSV com SHA-256
   * registrado em audit.access_log com action='export'.
   * Permissão exigida: analytics.export.
   */
  exportReport: protectedProcedure
    .use(requirePermission('analytics', 'export'))
    .input(analyticsExportInput)
    .mutation(async ({ ctx, input }) => {
      const exportCtx = {
        clinicId: ctx.clinicId!,
        userId:   ctx.user!.sub,
        ip:       ctx.req.ip ?? null,
      };
      if (input.format === 'pdf') {
        return { format: 'pdf' as const, ...(await generatePdf(exportCtx, input)) };
      }
      return { format: 'csv' as const, ...(await generateCsv(exportCtx, input)) };
    }),
});
