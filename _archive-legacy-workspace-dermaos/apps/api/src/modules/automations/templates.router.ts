import { z } from 'zod';
import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import {
  createTemplateSchema,
  updateTemplateSchema,
  listTemplatesSchema,
  previewTemplateSchema,
} from '@dermaos/shared';
import {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  restoreDefaultTemplate,
  seedDefaultTemplates,
  previewTemplate,
} from './templates.service.js';

export const templatesRouter = router({
  /* ── Listagem ──────────────────────────────────────────────────────────── */
  list: protectedProcedure
    .use(requirePermission('omni', 'read'))
    .input(listTemplatesSchema)
    .query(async ({ input, ctx }) => {
      return listTemplates(input, ctx.clinicId!);
    }),

  getById: protectedProcedure
    .use(requirePermission('omni', 'read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const template = await getTemplateById(input.id, ctx.clinicId!);
      return { template };
    }),

  /* ── Criação / edição ──────────────────────────────────────────────────── */
  create: protectedProcedure
    .use(requirePermission('omni', 'write'))
    .input(createTemplateSchema)
    .mutation(async ({ input, ctx }) => {
      const template = await createTemplate(input, ctx.clinicId!, ctx.user!.sub);
      return { template };
    }),

  update: protectedProcedure
    .use(requirePermission('omni', 'write'))
    .input(updateTemplateSchema)
    .mutation(async ({ input, ctx }) => {
      const template = await updateTemplate(input, ctx.clinicId!, ctx.user!.sub);
      return { template };
    }),

  /* ── Exclusão ──────────────────────────────────────────────────────────── */
  delete: protectedProcedure
    .use(requirePermission('omni', 'write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await deleteTemplate(input.id, ctx.clinicId!, ctx.user!.sub);
      return { success: true };
    }),

  /* ── Restaurar padrão ──────────────────────────────────────────────────── */
  restoreDefault: protectedProcedure
    .use(requirePermission('omni', 'write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const template = await restoreDefaultTemplate(input.id, ctx.clinicId!, ctx.user!.sub);
      return { template };
    }),

  /* ── Seed (chamado no setup inicial do tenant) ─────────────────────────── */
  seedDefaults: protectedProcedure
    .use(requirePermission('omni', 'write'))
    .mutation(async ({ ctx }) => {
      const count = await seedDefaultTemplates(ctx.clinicId!, ctx.user!.sub);
      return { created: count };
    }),

  /* ── Preview com dados fictícios ───────────────────────────────────────── */
  preview: protectedProcedure
    .use(requirePermission('omni', 'read'))
    .input(previewTemplateSchema)
    .mutation(({ input }) => {
      return { preview: previewTemplate(input.body) };
    }),
});
