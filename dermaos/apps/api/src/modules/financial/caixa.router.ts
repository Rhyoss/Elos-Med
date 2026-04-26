import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import { caixaQuerySchema } from '@dermaos/shared';
import { getCaixaDoDia } from './caixa.service.js';

export const caixaRouter = router({
  getDia: protectedProcedure
    .use(requirePermission('financial', 'read'))
    .input(caixaQuerySchema)
    .query(async ({ input, ctx }) =>
      getCaixaDoDia(ctx.clinicId!, input.date),
    ),
});
