import { z } from 'zod';
import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import {
  createStorageLocationSchema,
  updateStorageLocationSchema,
  listStorageLocationsSchema,
} from '@dermaos/shared';
import {
  listStorageLocations,
  getStorageLocationById,
  createStorageLocation,
  updateStorageLocation,
  deleteStorageLocation,
} from './storage-locations.service.js';

export const storageLocationsRouter = router({
  list: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(listStorageLocationsSchema)
    .query(async ({ input, ctx }) => {
      return listStorageLocations(input, ctx.clinicId!);
    }),

  getById: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return getStorageLocationById(input.id, ctx.clinicId!);
    }),

  create: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(createStorageLocationSchema)
    .mutation(async ({ input, ctx }) => {
      return createStorageLocation(input, ctx.clinicId!, ctx.user!.sub);
    }),

  update: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(updateStorageLocationSchema)
    .mutation(async ({ input, ctx }) => {
      return updateStorageLocation(input, ctx.clinicId!, ctx.user!.sub);
    }),

  delete: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await deleteStorageLocation(input.id, ctx.clinicId!, ctx.user!.sub);
      return { success: true };
    }),
});
