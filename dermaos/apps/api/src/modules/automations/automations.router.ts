import { z } from 'zod';
import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import {
  createAutomationSchema,
  updateAutomationSchema,
  toggleAutomationSchema,
  listAutomationsSchema,
  listExecutionLogSchema,
} from '@dermaos/shared';
import {
  listAutomations,
  getAutomationById,
  createAutomation,
  updateAutomation,
  toggleAutomation,
  deleteAutomation,
  listExecutionLog,
} from './automations.service.js';

export const automationsRouter = router({
  /* ── Listagem ──────────────────────────────────────────────────────────── */
  list: protectedProcedure
    .use(requirePermission('omni', 'read'))
    .input(listAutomationsSchema)
    .query(async ({ input, ctx }) => {
      return listAutomations(input, ctx.clinicId!);
    }),

  getById: protectedProcedure
    .use(requirePermission('omni', 'read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const automation = await getAutomationById(input.id, ctx.clinicId!);
      return { automation };
    }),

  /* ── Criação / edição ──────────────────────────────────────────────────── */
  create: protectedProcedure
    .use(requirePermission('omni', 'write'))
    .input(createAutomationSchema)
    .mutation(async ({ input, ctx }) => {
      const automation = await createAutomation(input, ctx.clinicId!, ctx.user!.sub);
      return { automation };
    }),

  update: protectedProcedure
    .use(requirePermission('omni', 'write'))
    .input(updateAutomationSchema)
    .mutation(async ({ input, ctx }) => {
      const automation = await updateAutomation(input, ctx.clinicId!, ctx.user!.sub);
      return { automation };
    }),

  /* ── Ativar / desativar ────────────────────────────────────────────────── */
  toggle: protectedProcedure
    .use(requirePermission('omni', 'write'))
    .input(toggleAutomationSchema)
    .mutation(async ({ input, ctx }) => {
      const automation = await toggleAutomation(
        input.id, input.isActive, ctx.clinicId!, ctx.user!.sub,
      );
      return { automation };
    }),

  /* ── Exclusão ──────────────────────────────────────────────────────────── */
  delete: protectedProcedure
    .use(requirePermission('omni', 'write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await deleteAutomation(input.id, ctx.clinicId!, ctx.user!.sub);
      return { success: true };
    }),

  /* ── Log de execuções ──────────────────────────────────────────────────── */
  executionLog: protectedProcedure
    .use(requirePermission('omni', 'read'))
    .input(listExecutionLogSchema)
    .query(async ({ input, ctx }) => {
      return listExecutionLog(input, ctx.clinicId!);
    }),
});
