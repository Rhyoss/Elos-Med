import { z } from 'zod';
import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import {
  createKitSchema,
  updateKitSchema,
  listKitsSchema,
  archiveKitSchema,
  kitAvailabilitySchema,
} from '@dermaos/shared';
import {
  createKit,
  updateKit,
  archiveKit,
  listKits,
  getKitById,
  checkKitAvailability,
} from './kits.service.js';

export const kitsRouter = router({
  list: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(listKitsSchema)
    .query(async ({ input, ctx }) => listKits(input, ctx.clinicId!)),

  getById: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => getKitById(input.id, ctx.clinicId!)),

  availability: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(kitAvailabilitySchema)
    .query(async ({ input, ctx }) => checkKitAvailability(input, ctx.clinicId!)),

  create: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(createKitSchema)
    .mutation(async ({ input, ctx }) => createKit(input, ctx.clinicId!, ctx.user!.sub)),

  update: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(updateKitSchema)
    .mutation(async ({ input, ctx }) => updateKit(input, ctx.clinicId!, ctx.user!.sub)),

  archive: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(archiveKitSchema)
    .mutation(async ({ input, ctx }) => archiveKit(input.id, ctx.clinicId!, ctx.user!.sub)),
});
