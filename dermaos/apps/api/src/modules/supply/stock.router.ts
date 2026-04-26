import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import {
  listStockPositionSchema,
  adjustStockSchema,
  listProductLotsSchema,
  listProductMovementsSchema,
} from '@dermaos/shared';
import {
  listStockPosition,
  listProductLots,
  listProductMovements,
  adjustStock,
} from './stock.service.js';

export const stockRouter = router({
  position: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(listStockPositionSchema)
    .query(async ({ input, ctx }) => {
      return listStockPosition(input, ctx.clinicId!);
    }),

  lots: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(listProductLotsSchema)
    .query(async ({ input, ctx }) => {
      return listProductLots(input, ctx.clinicId!);
    }),

  movements: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(listProductMovementsSchema)
    .query(async ({ input, ctx }) => {
      return listProductMovements(input, ctx.clinicId!);
    }),

  adjust: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(adjustStockSchema)
    .mutation(async ({ input, ctx }) => {
      return adjustStock(input, ctx.clinicId!, ctx.user!.sub);
    }),
});
