import { z } from 'zod';
import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import {
  createServiceSchema,
  updateServiceSchema,
  listServicesSchema,
} from '@dermaos/shared';
import {
  listServices,
  getServiceById,
  getServicePriceHistory,
  createService,
  updateService,
  deactivateService,
} from './catalog.service.js';

export const catalogRouter = router({
  list: protectedProcedure
    .use(requirePermission('financial', 'read'))
    .input(listServicesSchema)
    .query(async ({ input, ctx }) =>
      listServices(input, ctx.clinicId!),
    ),

  getById: protectedProcedure
    .use(requirePermission('financial', 'read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) =>
      getServiceById(input.id, ctx.clinicId!),
    ),

  priceHistory: protectedProcedure
    .use(requirePermission('financial', 'read'))
    .input(z.object({ serviceId: z.string().uuid() }))
    .query(async ({ input, ctx }) =>
      getServicePriceHistory(input.serviceId, ctx.clinicId!),
    ),

  create: protectedProcedure
    .use(requirePermission('financial', 'write'))
    .input(createServiceSchema)
    .mutation(async ({ input, ctx }) =>
      createService(input, ctx.clinicId!, ctx.user!.sub),
    ),

  update: protectedProcedure
    .use(requirePermission('financial', 'write'))
    .input(updateServiceSchema)
    .mutation(async ({ input, ctx }) =>
      updateService(input, ctx.clinicId!, ctx.user!.sub),
    ),

  deactivate: protectedProcedure
    .use(requirePermission('financial', 'write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await deactivateService(input.id, ctx.clinicId!, ctx.user!.sub);
      return { success: true };
    }),
});
