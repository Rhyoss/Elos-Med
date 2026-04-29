import { z } from 'zod';
import { router } from '../../trpc/trpc.js';
// SEC-16: PHI router — auditedProcedure registra reads e mutations
import { auditedProcedure as protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import {
  getSlotsInputSchema,
  createAppointmentInputSchema,
  confirmInputSchema,
  cancelInputSchema,
  rescheduleInputSchema,
  agendaDayInputSchema,
  agendaWeekInputSchema,
} from './scheduling.schema.js';
import {
  getAvailableSlots,
  createAppointment,
  confirmAppointment,
  checkInAppointment,
  startAppointment,
  completeAppointment,
  cancelAppointment,
  markNoShow,
  rescheduleAppointment,
  getAgendaDay,
  getAgendaWeek,
  getWaitQueue,
  listProviders,
  listServices,
} from './scheduling.service.js';

export const schedulingRouter = router({
  /* ── Slots & agenda ──────────────────────────────────────────────── */
  getSlots: protectedProcedure
    .use(requirePermission('appointments', 'read'))
    .input(getSlotsInputSchema)
    .query(async ({ input, ctx }) => {
      const slots = await getAvailableSlots(
        input.providerId,
        input.date,
        input.durationMin,
        ctx.clinicId!,
      );
      return { slots };
    }),

  agendaDay: protectedProcedure
    .use(requirePermission('appointments', 'read'))
    .input(agendaDayInputSchema)
    .query(async ({ input, ctx }) => {
      const appointments = await getAgendaDay(
        ctx.clinicId!,
        input.date,
        input.providerId,
      );
      return { appointments };
    }),

  agendaWeek: protectedProcedure
    .use(requirePermission('appointments', 'read'))
    .input(agendaWeekInputSchema)
    .query(async ({ input, ctx }) => {
      const appointments = await getAgendaWeek(
        ctx.clinicId!,
        input.startDate,
        input.providerId,
      );
      return { appointments };
    }),

  waitQueue: protectedProcedure
    .use(requirePermission('appointments', 'read'))
    .query(async ({ ctx }) => {
      const queue = await getWaitQueue(ctx.clinicId!);
      return { queue };
    }),

  /* ── Listagens auxiliares ────────────────────────────────────────── */
  listProviders: protectedProcedure
    .use(requirePermission('appointments', 'read'))
    .query(async ({ ctx }) => {
      const providers = await listProviders(ctx.clinicId!);
      return { providers };
    }),

  listServices: protectedProcedure
    .use(requirePermission('appointments', 'read'))
    .query(async ({ ctx }) => {
      const services = await listServices(ctx.clinicId!);
      return { services };
    }),

  /* ── Mutations de ciclo de vida ──────────────────────────────────── */
  create: protectedProcedure
    .use(requirePermission('appointments', 'write'))
    .input(createAppointmentInputSchema)
    .mutation(async ({ input, ctx }) => {
      const appointment = await createAppointment(input, ctx.clinicId!, ctx.user.sub);
      return { appointment };
    }),

  confirm: protectedProcedure
    .use(requirePermission('appointments', 'write'))
    .input(confirmInputSchema)
    .mutation(async ({ input, ctx }) => {
      const appointment = await confirmAppointment(input, ctx.clinicId!, ctx.user.sub);
      return { appointment };
    }),

  checkIn: protectedProcedure
    .use(requirePermission('appointments', 'write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const appointment = await checkInAppointment(input.id, ctx.clinicId!, ctx.user.sub);
      return { appointment };
    }),

  start: protectedProcedure
    .use(requirePermission('appointments', 'write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const appointment = await startAppointment(input.id, ctx.clinicId!, ctx.user.sub);
      return { appointment };
    }),

  complete: protectedProcedure
    .use(requirePermission('appointments', 'write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const appointment = await completeAppointment(input.id, ctx.clinicId!, ctx.user.sub);
      return { appointment };
    }),

  cancel: protectedProcedure
    .use(requirePermission('appointments', 'write'))
    .input(cancelInputSchema)
    .mutation(async ({ input, ctx }) => {
      const appointment = await cancelAppointment(input, ctx.clinicId!, ctx.user.sub);
      return { appointment };
    }),

  noShow: protectedProcedure
    .use(requirePermission('appointments', 'write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const appointment = await markNoShow(input.id, ctx.clinicId!, ctx.user.sub);
      return { appointment };
    }),

  reschedule: protectedProcedure
    .use(requirePermission('appointments', 'write'))
    .input(rescheduleInputSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await rescheduleAppointment(input, ctx.clinicId!, ctx.user.sub);
      return result;
    }),
});
