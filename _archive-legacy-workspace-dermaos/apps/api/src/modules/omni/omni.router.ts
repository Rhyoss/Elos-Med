import { z } from 'zod';
import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import {
  listConversationsSchema,
  listMessagesSchema,
  sendMessageSchema,
  assignConversationSchema,
  escalateConversationSchema,
  resolveConversationSchema,
  markReadSchema,
  retryMessageSchema,
  typingIndicatorSchema,
  linkContactToPatientSchema,
} from '@dermaos/shared';
import {
  listConversations,
  getConversationById,
  listMessages,
  sendMessage,
  retrySendMessage,
  assignConversation,
  escalateConversation,
  resolveConversation,
  markConversationRead,
  getContactContext,
  updateContactTags,
  linkContactToPatient,
  listChannels,
  getUnreadCount,
} from './omni.service.js';
import { emitTyping } from './omni.realtime.js';

export const omniRouter = router({
  /* ── Canais ───────────────────────────────────────────────────────────── */
  listChannels: protectedProcedure
    .use(requirePermission('omni', 'read'))
    .query(async ({ ctx }) => {
      const channels = await listChannels(ctx.clinicId!);
      return { channels };
    }),

  /* ── Conversas ────────────────────────────────────────────────────────── */
  listConversations: protectedProcedure
    .use(requirePermission('omni', 'read'))
    .input(listConversationsSchema)
    .query(async ({ input, ctx }) => {
      return listConversations(input, ctx.clinicId!, ctx.user.sub);
    }),

  getConversation: protectedProcedure
    .use(requirePermission('omni', 'read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const conversation = await getConversationById(input.id, ctx.clinicId!);
      return { conversation };
    }),

  listMessages: protectedProcedure
    .use(requirePermission('omni', 'read'))
    .input(listMessagesSchema)
    .query(async ({ input, ctx }) => {
      return listMessages(input, ctx.clinicId!);
    }),

  /* ── Envio ────────────────────────────────────────────────────────────── */
  sendMessage: protectedProcedure
    .use(requirePermission('omni', 'write'))
    .input(sendMessageSchema)
    .mutation(async ({ input, ctx }) => {
      const message = await sendMessage(input, ctx.clinicId!, ctx.user.sub);
      return { message };
    }),

  retryMessage: protectedProcedure
    .use(requirePermission('omni', 'write'))
    .input(retryMessageSchema)
    .mutation(async ({ input, ctx }) => {
      const message = await retrySendMessage(input.messageId, ctx.clinicId!, ctx.user.sub);
      return { message };
    }),

  /* ── Atribuição ───────────────────────────────────────────────────────── */
  assignConversation: protectedProcedure
    .use(requirePermission('omni', 'write'))
    .input(assignConversationSchema)
    .mutation(async ({ input, ctx }) => {
      const conversation = await assignConversation(input, ctx.clinicId!, ctx.user.sub);
      return { conversation };
    }),

  escalateConversation: protectedProcedure
    .use(requirePermission('omni', 'write'))
    .input(escalateConversationSchema)
    .mutation(async ({ input, ctx }) => {
      const conversation = await escalateConversation(input, ctx.clinicId!, ctx.user.sub);
      return { conversation };
    }),

  resolveConversation: protectedProcedure
    .use(requirePermission('omni', 'write'))
    .input(resolveConversationSchema)
    .mutation(async ({ input, ctx }) => {
      const conversation = await resolveConversation(input, ctx.clinicId!, ctx.user.sub);
      return { conversation };
    }),

  markRead: protectedProcedure
    .use(requirePermission('omni', 'read'))
    .input(markReadSchema)
    .mutation(async ({ input, ctx }) => {
      await markConversationRead(input, ctx.clinicId!);
      return { success: true };
    }),

  /* ── Typing indicator (throttled server-side) ────────────────────────── */
  typing: protectedProcedure
    .use(requirePermission('omni', 'write'))
    .input(typingIndicatorSchema)
    .mutation(async ({ input, ctx }) => {
      await emitTyping(ctx.clinicId!, input.conversationId, ctx.user.sub, ctx.user.name ?? 'Atendente');
      return { success: true };
    }),

  /* ── Contato / contexto do painel direito ────────────────────────────── */
  getContactContext: protectedProcedure
    .use(requirePermission('omni', 'read'))
    .input(z.object({ contactId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const context = await getContactContext(input.contactId, ctx.clinicId!);
      return { context };
    }),

  updateContactTags: protectedProcedure
    .use(requirePermission('omni', 'write'))
    .input(z.object({
      contactId: z.string().uuid(),
      tags:      z.array(z.string().trim().min(1).max(50)).max(20),
    }))
    .mutation(async ({ input, ctx }) => {
      const tags = await updateContactTags(input.contactId, input.tags, ctx.clinicId!);
      return { tags };
    }),

  linkContactToPatient: protectedProcedure
    .use(requirePermission('omni', 'write'))
    .input(linkContactToPatientSchema)
    .mutation(async ({ input, ctx }) => {
      const context = await linkContactToPatient(input.contactId, input.patientId, ctx.clinicId!);
      return { context };
    }),

  /* ── Badge de não-lidas ──────────────────────────────────────────────── */
  unreadCount: protectedProcedure
    .use(requirePermission('omni', 'read'))
    .query(async ({ ctx }) => {
      const count = await getUnreadCount(ctx.clinicId!, ctx.user.sub);
      return { count };
    }),
});
