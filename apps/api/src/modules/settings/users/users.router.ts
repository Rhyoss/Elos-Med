import { router } from '../../../trpc/trpc.js';
import { protectedProcedure } from '../../../trpc/middleware/auth.middleware.js';
import { requireRoles } from '../../../trpc/middleware/rbac.middleware.js';
import {
  listUsersSchema,
  createUserSchema,
  setUserPermissionsSchema,
  deactivateUserSchema,
  reactivateUserSchema,
  initiatePasswordResetSchema,
} from '@dermaos/shared';
import {
  listUsers,
  createUser,
  setUserPermissions,
  deactivateUser,
  reactivateUser,
  initiatePasswordReset,
} from './users.service.js';

const ownerOrAdmin = requireRoles('owner', 'admin');

export const usersSettingsRouter = router({
  list: protectedProcedure
    .use(ownerOrAdmin)
    .input(listUsersSchema)
    .query(async ({ ctx, input }) => listUsers(ctx.clinicId!, input)),

  create: protectedProcedure
    .use(ownerOrAdmin)
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) =>
      createUser(ctx.clinicId!, ctx.user!.sub, input),
    ),

  setPermissions: protectedProcedure
    .use(ownerOrAdmin)
    .input(setUserPermissionsSchema)
    .mutation(async ({ ctx, input }) =>
      setUserPermissions(ctx.clinicId!, ctx.user!.sub, ctx.user!.role, input),
    ),

  deactivate: protectedProcedure
    .use(ownerOrAdmin)
    .input(deactivateUserSchema)
    .mutation(async ({ ctx, input }) =>
      deactivateUser(ctx.clinicId!, ctx.user!.sub, ctx.user!.role, input),
    ),

  reactivate: protectedProcedure
    .use(ownerOrAdmin)
    .input(reactivateUserSchema)
    .mutation(async ({ ctx, input }) =>
      reactivateUser(ctx.clinicId!, ctx.user!.sub, ctx.user!.role, input.userId),
    ),

  initiatePasswordReset: protectedProcedure
    .use(ownerOrAdmin)
    .input(initiatePasswordResetSchema)
    .mutation(async ({ ctx, input }) =>
      initiatePasswordReset(
        ctx.clinicId!,
        ctx.user!.sub,
        ctx.req.ip ?? null,
        input.userId,
      ),
    ),
});
