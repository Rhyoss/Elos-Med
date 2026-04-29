import { router } from '../../../trpc/trpc.js';
// SEC-16: PHI router — auditedProcedure registra reads e mutations
import { auditedProcedure as protectedProcedure } from '../../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../../trpc/middleware/rbac.middleware.js';
import {
  createProtocolSchema,
  updateProtocolSchema,
  cancelProtocolSchema,
  pauseProtocolSchema,
  resumeProtocolSchema,
  registerSessionSchema,
  correctSessionSchema,
  suggestNextSessionSchema,
  listProtocolsByPatientSchema,
  getProtocolByIdSchema,
  listProtocolSessionsSchema,
  getProtocolSessionByIdSchema,
} from '@dermaos/shared';
import {
  createProtocol,
  updateProtocol,
  cancelProtocol,
  pauseProtocol,
  resumeProtocol,
  registerSession,
  correctSession,
  suggestNextSession,
  getProtocolById,
  listProtocolsByPatient,
  listActiveProtocols,
  listProtocolSessions,
  getProtocolSessionById,
} from './protocols.service.js';

export const protocolsRouter = router({
  /* ── Protocolo: mutations ────────────────────────────────────────── */

  create: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(createProtocolSchema)
    .mutation(async ({ input, ctx }) => {
      const protocol = await createProtocol(input, ctx.clinicId!, ctx.user.sub);
      return { protocol };
    }),

  update: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(updateProtocolSchema)
    .mutation(async ({ input, ctx }) => {
      const protocol = await updateProtocol(input, ctx.clinicId!, ctx.user.sub);
      return { protocol };
    }),

  cancel: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(cancelProtocolSchema)
    .mutation(async ({ input, ctx }) => {
      const protocol = await cancelProtocol(input, ctx.clinicId!, ctx.user.sub);
      return { protocol };
    }),

  pause: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(pauseProtocolSchema)
    .mutation(async ({ input, ctx }) => {
      const protocol = await pauseProtocol(input, ctx.clinicId!, ctx.user.sub);
      return { protocol };
    }),

  resume: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(resumeProtocolSchema)
    .mutation(async ({ input, ctx }) => {
      const protocol = await resumeProtocol(input.id, ctx.clinicId!, ctx.user.sub);
      return { protocol };
    }),

  /* ── Sessões: mutations ──────────────────────────────────────────── */

  registerSession: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(registerSessionSchema)
    .mutation(async ({ input, ctx }) => {
      const session = await registerSession(input, ctx.clinicId!, ctx.user.sub);
      return { session };
    }),

  correctSession: protectedProcedure
    .use(requirePermission('clinical', 'sign'))
    .input(correctSessionSchema)
    .mutation(async ({ input, ctx }) => {
      const session = await correctSession(input, ctx.clinicId!, ctx.user.sub);
      return { session };
    }),

  /* ── Queries ─────────────────────────────────────────────────────── */

  getById: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(getProtocolByIdSchema)
    .query(async ({ input, ctx }) => {
      const protocol = await getProtocolById(input.id, ctx.clinicId!);
      return { protocol };
    }),

  listByPatient: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(listProtocolsByPatientSchema)
    .query(async ({ input, ctx }) => {
      const protocols = await listProtocolsByPatient(input, ctx.clinicId!);
      return { protocols };
    }),

  listActive: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .query(async ({ ctx }) => {
      const protocols = await listActiveProtocols(ctx.clinicId!);
      return { protocols };
    }),

  listSessions: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(listProtocolSessionsSchema)
    .query(async ({ input, ctx }) => {
      const sessions = await listProtocolSessions(input.protocolId, ctx.clinicId!);
      return { sessions };
    }),

  getSessionById: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(getProtocolSessionByIdSchema)
    .query(async ({ input, ctx }) => {
      const session = await getProtocolSessionById(input.sessionId, ctx.clinicId!);
      return { session };
    }),

  suggestNextSession: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(suggestNextSessionSchema)
    .query(async ({ input, ctx }) => {
      return suggestNextSession(input.protocolId, ctx.clinicId!);
    }),
});
