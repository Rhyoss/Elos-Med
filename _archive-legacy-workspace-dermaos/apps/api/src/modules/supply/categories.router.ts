import { z } from 'zod';
import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import {
  createCategorySchema,
  updateCategorySchema,
  listCategoriesSchema,
} from '@dermaos/shared';
import {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from './categories.service.js';

export const categoriesRouter = router({
  list: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(listCategoriesSchema)
    .query(async ({ input, ctx }) => {
      return listCategories(input, ctx.clinicId!);
    }),

  getById: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return getCategoryById(input.id, ctx.clinicId!);
    }),

  create: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(createCategorySchema)
    .mutation(async ({ input, ctx }) => {
      return createCategory(input, ctx.clinicId!, ctx.user!.sub);
    }),

  update: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(updateCategorySchema)
    .mutation(async ({ input, ctx }) => {
      return updateCategory(input, ctx.clinicId!, ctx.user!.sub);
    }),

  delete: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await deleteCategory(input.id, ctx.clinicId!, ctx.user!.sub);
      return { success: true };
    }),
});
