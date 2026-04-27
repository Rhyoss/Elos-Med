import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import { registerMovementSchema } from '@dermaos/shared';
import { registerMovement } from './movements.service.js';

export const movementsRouter = router({
  register: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(registerMovementSchema)
    .mutation(async ({ input, ctx }) => {
      return registerMovement(input, {
        clinicId: ctx.clinicId!,
        userId:   ctx.user!.sub,
        ipOrigin: ctx.req.ip ?? null,
      });
    }),
});
