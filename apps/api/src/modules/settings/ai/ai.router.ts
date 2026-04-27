import { router } from '../../../trpc/trpc.js';
import { protectedProcedure } from '../../../trpc/middleware/auth.middleware.js';
import { requireRoles } from '../../../trpc/middleware/rbac.middleware.js';
import {
  updateAISettingsSchema,
  updateSystemPromptSchema,
} from '@dermaos/shared';
import {
  getAISettings,
  updateAISettings,
  updateSystemPrompt,
  getPromptHistory,
} from './ai.service.js';

const ownerOrAdmin = requireRoles('owner', 'admin');

export const aiSettingsRouter = router({
  get: protectedProcedure
    .use(ownerOrAdmin)
    .query(async ({ ctx }) => getAISettings(ctx.clinicId!)),

  update: protectedProcedure
    .use(ownerOrAdmin)
    .input(updateAISettingsSchema)
    .mutation(async ({ ctx, input }) => updateAISettings(ctx.clinicId!, ctx.user!.sub, input)),

  updatePrompt: protectedProcedure
    .use(ownerOrAdmin)
    .input(updateSystemPromptSchema)
    .mutation(async ({ ctx, input }) => updateSystemPrompt(ctx.clinicId!, ctx.user!.sub, input)),

  promptHistory: protectedProcedure
    .use(ownerOrAdmin)
    .query(async ({ ctx }) => getPromptHistory(ctx.clinicId!)),
});
