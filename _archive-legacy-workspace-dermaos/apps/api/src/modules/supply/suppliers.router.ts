import { z } from 'zod';
import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import {
  createSupplierSchema,
  updateSupplierSchema,
  listSuppliersSchema,
} from '@dermaos/shared';
import {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  checkCnpjAvailability,
} from './suppliers.service.js';

export const suppliersRouter = router({
  list: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(listSuppliersSchema)
    .query(async ({ input, ctx }) => {
      return listSuppliers(input, ctx.clinicId!);
    }),

  getById: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return getSupplierById(input.id, ctx.clinicId!);
    }),

  create: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(createSupplierSchema)
    .mutation(async ({ input, ctx }) => {
      return createSupplier(input, ctx.clinicId!, ctx.user!.sub);
    }),

  update: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(updateSupplierSchema)
    .mutation(async ({ input, ctx }) => {
      return updateSupplier(input, ctx.clinicId!, ctx.user!.sub);
    }),

  delete: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await deleteSupplier(input.id, ctx.clinicId!, ctx.user!.sub);
      return { success: true };
    }),

  checkCnpj: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(z.object({ cnpj: z.string().min(14), excludeId: z.string().uuid().optional() }))
    .query(async ({ input, ctx }) => {
      return checkCnpjAvailability(input.cnpj, ctx.clinicId!, input.excludeId);
    }),
});
