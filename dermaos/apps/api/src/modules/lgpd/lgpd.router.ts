import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requireRoles } from '../../trpc/middleware/rbac.middleware.js';
import {
  requestExport,
  anonymizePatient,
  registerConsent,
  revokeConsent,
  getActiveConsent,
  getCurrentPrivacyNotice,
} from './lgpd.service.js';
import { checkLgpdExportLimit } from '../../lib/rate-limit.js';

const consentTypeSchema = z.enum(['dados_pessoais', 'marketing', 'pesquisa', 'imagens']);
const consentChannelSchema = z.enum(['web', 'whatsapp', 'in_person', 'portal', 'paper']);

export const lgpdRouter = router({
  /** Solicita exportação assíncrona dos dados do paciente. */
  requestExport: protectedProcedure
    .input(z.object({
      patientId:      z.string().uuid(),
      justification:  z.string().min(5).max(500).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Rate limit: 2/hora por usuário
      const limit = await checkLgpdExportLimit(ctx.user.sub);
      if (!limit.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `Limite de exportações atingido. Tente novamente em ${Math.ceil(limit.retryAfterSec / 60)} min.`,
        });
      }

      // Apenas admin/dpo/owner podem exportar dados de outro paciente.
      // Paciente comum no portal usa endpoint próprio (portal.plugin.ts).
      const role = ctx.user.role;
      if (!['owner', 'admin'].includes(role)) {
        // Verifica se está usando role 'dpo' (custom permission)
        const isDpo = (await ctx.db.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count
             FROM shared.users
            WHERE id = $1 AND clinic_id = $2 AND permissions ? 'dpo'`,
          [ctx.user.sub, ctx.clinicId],
        )).rows[0]?.count;
        if (!isDpo) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Apenas owner, admin ou DPO podem solicitar exportação',
          });
        }
      }

      const { jobId } = await requestExport({
        db: ctx.db,
        clinicId: ctx.clinicId!,
        patientId: input.patientId,
        requestedBy: ctx.user.sub,
        requestedRole: role === 'owner' ? 'admin' : (role as 'admin'),
        ip: ctx.req.ip ?? null,
        ...(input.justification !== undefined && { justification: input.justification }),
      });

      return { jobId, status: 'pending' as const };
    }),

  /** Status do job de exportação. */
  exportStatus: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const result = await ctx.db.query<{
        id: string; status: string; created_at: Date; completed_at: Date | null;
        download_url_expires_at: Date | null; failed_reason: string | null;
      }>(
        `SELECT id, status, created_at, completed_at, download_url_expires_at, failed_reason
           FROM shared.lgpd_export_jobs
          WHERE id = $1 AND clinic_id = $2`,
        [input.jobId, ctx.clinicId],
      );
      const row = result.rows[0];
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Export não encontrado' });
      return row;
    }),

  /**
   * Anonimização irreversível. Apenas owner/dpo. Exige confirmação literal.
   */
  anonymizePatient: protectedProcedure
    .use(requireRoles('owner'))
    .input(z.object({
      patientId:    z.string().uuid(),
      reason:       z.string().min(10).max(1000),
      confirm:      z.string(),               // deve = "ANONIMIZAR <patient_id>"
      approvedBy:   z.string().uuid().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await anonymizePatient({
        db: ctx.db,
        redis: ctx.redis,
        clinicId: ctx.clinicId!,
        patientId: input.patientId,
        performedBy: ctx.user.sub,
        performedRole: 'owner',
        ...(input.approvedBy !== undefined && { approvedBy: input.approvedBy }),
        reason: input.reason,
        confirmation: input.confirm,
        ip: ctx.req.ip ?? null,
      });
      return { ok: true };
    }),

  /** Registra consentimento (granted=true). Append-only. */
  registerConsent: protectedProcedure
    .input(z.object({
      patientId:    z.string().uuid(),
      consentType:  consentTypeSchema,
      version:      z.string().min(1).max(50),
      channel:      consentChannelSchema,
      evidence:     z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return registerConsent({
        db: ctx.db,
        clinicId: ctx.clinicId!,
        patientId: input.patientId,
        consentType: input.consentType,
        version: input.version,
        channel: input.channel,
        ip: ctx.req.ip ?? null,
        collectedBy: ctx.user.sub,
        ...(input.evidence !== undefined && { evidence: input.evidence }),
      });
    }),

  /** Revoga consentimento (gera novo registro com is_revocation=true). */
  revokeConsent: protectedProcedure
    .input(z.object({
      patientId:    z.string().uuid(),
      consentType:  consentTypeSchema,
      version:      z.string().min(1).max(50),
      channel:      consentChannelSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      return revokeConsent(ctx.db, {
        db: ctx.db,
        clinicId: ctx.clinicId!,
        patientId: input.patientId,
        consentType: input.consentType,
        version: input.version,
        channel: input.channel,
        ip: ctx.req.ip ?? null,
        collectedBy: ctx.user.sub,
      });
    }),

  /** Verifica se existe consentimento ativo para um tipo. */
  hasActiveConsent: protectedProcedure
    .input(z.object({
      patientId:    z.string().uuid(),
      consentType:  consentTypeSchema,
    }))
    .query(async ({ input, ctx }) => {
      const active = await getActiveConsent(
        ctx.db, ctx.clinicId!, input.patientId, input.consentType,
      );
      return { active };
    }),

  /** Retorna política de privacidade — público (sem auth). */
  privacyNotice: publicProcedure
    .input(z.object({ clinicId: z.string().uuid().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const clinicId = input?.clinicId ?? null;
      // Header de cache no público — 1 hora
      try { ctx.res.header('Cache-Control', 'public, max-age=3600'); } catch { /* noop */ }
      return getCurrentPrivacyNotice(ctx.db, clinicId);
    }),
});
