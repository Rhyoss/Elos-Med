import { z } from 'zod';
import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import {
  listNotifications,
  countUnread,
  markAsRead,
  markAllAsRead,
} from './notifications.service.js';

export const notificationsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
        unreadOnly: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user, clinicId } = ctx;
      return listNotifications(user.sub, clinicId, input);
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const { user, clinicId } = ctx;
    const count = await countUnread(user.sub, clinicId);
    return { count };
  }),

  markAsRead: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const { user, clinicId } = ctx;
      const updated = await markAsRead(input.ids, user.sub, clinicId);
      return { updated };
    }),

  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const { user, clinicId } = ctx;
    const updated = await markAllAsRead(user.sub, clinicId);
    return { updated };
  }),
});
