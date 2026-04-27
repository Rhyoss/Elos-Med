import { z } from 'zod';
import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  checkSkuSchema,
} from '@dermaos/shared';
import {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  checkSkuAvailability,
  searchProducts,
} from './products.service.js';
import { presignGet } from '../../lib/minio.js';
import { PRODUCT_IMAGES_BUCKET } from '../../lib/minio.js';

const PHOTO_URL_TTL_SECONDS = 3600; // 1 hora

export const productsRouter = router({
  list: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(listProductsSchema)
    .query(async ({ input, ctx }) => {
      return listProducts(input, ctx.clinicId!);
    }),

  getById: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const product = await getProductById(input.id, ctx.clinicId!);
      return product;
    }),

  create: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(createProductSchema)
    .mutation(async ({ input, ctx }) => {
      return createProduct(input, ctx.clinicId!, ctx.user!.sub);
    }),

  update: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(updateProductSchema)
    .mutation(async ({ input, ctx }) => {
      return updateProduct(input, ctx.clinicId!, ctx.user!.sub);
    }),

  delete: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await deleteProduct(input.id, ctx.clinicId!, ctx.user!.sub);
      return { success: true };
    }),

  checkSku: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(checkSkuSchema)
    .query(async ({ input, ctx }) => {
      return checkSkuAvailability(input, ctx.clinicId!);
    }),

  search: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(z.object({
      query:   z.string().min(2).max(200),
      page:    z.number().int().positive().default(1),
      perPage: z.number().int().positive().max(50).default(20),
    }))
    .query(async ({ input, ctx }) => {
      return searchProducts(input.query, ctx.clinicId!, input.page, input.perPage);
    }),

  photoUrl: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(z.object({ objectKey: z.string().min(1) }))
    .query(async ({ input }) => {
      const url = await presignGet(input.objectKey, PHOTO_URL_TTL_SECONDS, PRODUCT_IMAGES_BUCKET);
      return { url };
    }),
});
