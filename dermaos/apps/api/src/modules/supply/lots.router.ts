import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import {
  listLotsSchema,
  changeLotStatusSchema,
  quarantineLotSchema,
  fefoSuggestionSchema,
} from '@dermaos/shared';
import {
  listLotsGlobal,
  changeLotStatus,
  quarantineLot,
  fefoSuggest,
} from './lots.service.js';

export const lotsRouter = router({
  list: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(listLotsSchema)
    .query(async ({ input, ctx }) => {
      return listLotsGlobal(input, ctx.clinicId!);
    }),

  changeStatus: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(changeLotStatusSchema)
    .mutation(async ({ input, ctx }) => {
      return changeLotStatus(input, ctx.clinicId!, ctx.user!.sub);
    }),

  quarantine: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(quarantineLotSchema)
    .mutation(async ({ input, ctx }) => {
      return quarantineLot(input, ctx.clinicId!, ctx.user!.sub);
    }),

  fefoSuggest: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(fefoSuggestionSchema)
    .query(async ({ input, ctx }) => {
      return fefoSuggest(input, ctx.clinicId!);
    }),
});
