import { TRPCError } from '@trpc/server';
import { router } from '../../../trpc/trpc.js';
import { protectedProcedure } from '../../../trpc/middleware/auth.middleware.js';
import { requireRoles } from '../../../trpc/middleware/rbac.middleware.js';
import {
  updateClinicSchema,
  updateTimezoneSchema,
  updateBusinessHoursSchema,
} from '@dermaos/shared';
import {
  getClinic,
  updateClinic,
  getBusinessHours,
  updateBusinessHours,
  updateTimezone,
} from './clinic.service.js';

const ownerOrAdmin = requireRoles('owner', 'admin');
const ownerOnly    = requireRoles('owner');

export const clinicSettingsRouter = router({
  /** Retorna dados da clínica — campos privados apenas para owner/admin */
  get: protectedProcedure
    .query(async ({ ctx }) => {
      const isPrivileged = ctx.user!.role === 'owner' || ctx.user!.role === 'admin';
      return getClinic(ctx.clinicId!, isPrivileged);
    }),

  /** Atualiza dados cadastrais da clínica */
  update: protectedProcedure
    .use(ownerOrAdmin)
    .input(updateClinicSchema)
    .mutation(async ({ ctx, input }) =>
      updateClinic(ctx.clinicId!, ctx.user!.sub, input),
    ),

  /** Atualiza horários de funcionamento */
  updateBusinessHours: protectedProcedure
    .use(ownerOrAdmin)
    .input(updateBusinessHoursSchema)
    .mutation(async ({ ctx, input }) =>
      updateBusinessHours(ctx.clinicId!, ctx.user!.sub, input),
    ),

  /** Retorna horários de funcionamento */
  getBusinessHours: protectedProcedure
    .query(async ({ ctx }) => getBusinessHours(ctx.clinicId!)),

  /** Atualiza timezone — exclusivo do owner, exige confirmação no frontend */
  updateTimezone: protectedProcedure
    .use(ownerOnly)
    .input(updateTimezoneSchema)
    .mutation(async ({ ctx, input }) =>
      updateTimezone(ctx.clinicId!, ctx.user!.sub, input),
    ),
});
