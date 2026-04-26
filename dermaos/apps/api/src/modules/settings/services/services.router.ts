import { z } from 'zod';
import { router } from '../../../trpc/trpc.js';
import { protectedProcedure } from '../../../trpc/middleware/auth.middleware.js';
import { requireRoles } from '../../../trpc/middleware/rbac.middleware.js';
import {
  createSettingsServiceSchema,
  updateSettingsServiceSchema,
  deleteSettingsServiceSchema,
} from '@dermaos/shared';
import {
  listServices,
  createService,
  updateService,
  softDeleteService,
  getServicePriceHistory,
} from './services.service.js';

const ownerOrAdmin = requireRoles('owner', 'admin');

export const servicesSettingsRouter = router({
  list: protectedProcedure
    .use(ownerOrAdmin)
    .input(z.object({ includeInactive: z.boolean().optional() }))
    .query(async ({ ctx, input }) => listServices(ctx.clinicId, input.includeInactive)),

  create: protectedProcedure
    .use(ownerOrAdmin)
    .input(createSettingsServiceSchema)
    .mutation(async ({ ctx, input }) => createService(ctx.clinicId, ctx.user.sub, input)),

  update: protectedProcedure
    .use(ownerOrAdmin)
    .input(updateSettingsServiceSchema)
    .mutation(async ({ ctx, input }) => updateService(ctx.clinicId, ctx.user.sub, input)),

  delete: protectedProcedure
    .use(ownerOrAdmin)
    .input(deleteSettingsServiceSchema)
    .mutation(async ({ ctx, input }) => softDeleteService(ctx.clinicId, ctx.user.sub, input.id)),

  priceHistory: protectedProcedure
    .use(ownerOrAdmin)
    .input(z.object({ serviceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => getServicePriceHistory(ctx.clinicId, input.serviceId)),
});
