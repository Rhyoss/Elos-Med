import { z } from 'zod';
import { TRPCError } from '@trpc/server';
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

  // SEC-04: presigned URL é derivada de productId (não de objectKey arbitrário).
  // O objectKey é resolvido no banco com filtro por clinic_id, garantindo
  // que o produto pertence ao tenant do solicitante (impede IDOR cross-tenant).
  photoUrl: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(z.object({ productId: z.string().uuid() }))
    .query(async ({ input, ctx }): Promise<{ url: string | null }> => {
      const r = await ctx.db.query<{ photo_object_key: string | null }>(
        `SELECT photo_object_key
           FROM supply.products
          WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL
          LIMIT 1`,
        [input.productId, ctx.clinicId!],
      );
      const product = r.rows[0];
      if (!product) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Produto não encontrado.' });
      }
      if (!product.photo_object_key) {
        return { url: null };
      }
      const url = await presignGet(
        product.photo_object_key,
        PHOTO_URL_TTL_SECONDS,
        PRODUCT_IMAGES_BUCKET,
      );
      return { url };
    }),
});
