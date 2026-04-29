import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../../../trpc/trpc.js';
// SEC-16: PHI router — auditedProcedure registra reads e mutations
import { auditedProcedure as protectedProcedure } from '../../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../../trpc/middleware/rbac.middleware.js';
import {
  createEncounterSchema,
  updateEncounterSchema,
  autoSaveEncounterSchema,
  signEncounterSchema,
  correctEncounterSchema,
  encounterListByPatientSchema,
  getEncounterByIdSchema,
  aiSuggestCidsSchema,
  aiSuggestSoapSchema,
} from '@dermaos/shared';
import {
  createEncounterFromAppointment,
  updateEncounter,
  autoSaveEncounter,
  signEncounter,
  correctEncounter,
  getEncounterById,
  listEncountersByPatient,
  searchCid10,
} from './encounters.service.js';
import { suggestCIDs, suggestSOAP } from './ai-suggestions.service.js';

export const encountersRouter = router({
  /* ── Lifecycle ───────────────────────────────────────────────────── */
  create: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(createEncounterSchema)
    .mutation(async ({ input, ctx }) => {
      const encounter = await createEncounterFromAppointment(
        input.appointmentId,
        ctx.clinicId!,
        ctx.user.sub,
      );
      return { encounter };
    }),

  update: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(z.object({ id: z.string().uuid(), data: updateEncounterSchema }))
    .mutation(async ({ input, ctx }) => {
      const encounter = await updateEncounter(input.id, input.data, ctx.clinicId!, ctx.user.sub);
      return { encounter };
    }),

  autoSave: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(z.object({ id: z.string().uuid(), data: autoSaveEncounterSchema }))
    .mutation(async ({ input, ctx }) => {
      const result = await autoSaveEncounter(input.id, input.data, ctx.clinicId!, ctx.user.sub);
      return result;
    }),

  sign: protectedProcedure
    .use(requirePermission('clinical', 'sign'))
    .input(signEncounterSchema)
    .mutation(async ({ input, ctx }) => {
      // provider assinante é o próprio usuário com permissão `clinical.sign`
      const encounter = await signEncounter(input.id, ctx.user.sub, ctx.clinicId!, ctx.user.sub);
      return { encounter };
    }),

  correct: protectedProcedure
    .use(requirePermission('clinical', 'sign'))
    .input(correctEncounterSchema)
    .mutation(async ({ input, ctx }) => {
      const encounter = await correctEncounter(input, ctx.clinicId!, ctx.user.sub);
      return { encounter };
    }),

  /* ── Queries ─────────────────────────────────────────────────────── */
  getById: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(getEncounterByIdSchema)
    .query(async ({ input, ctx }) => {
      const encounter = await getEncounterById(input.id, ctx.clinicId!);
      return { encounter };
    }),

  getByPatient: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(encounterListByPatientSchema)
    .query(async ({ input, ctx }) => {
      return listEncountersByPatient(input, ctx.clinicId!);
    }),

  /* ── CID-10 autocomplete ─────────────────────────────────────────── */
  searchCid: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(z.object({
      query: z.string().min(1).max(200),
      limit: z.number().int().min(1).max(30).default(15),
    }))
    .query(async ({ input }) => {
      const results = await searchCid10(input.query, input.limit);
      return { results };
    }),

  /* ── AI assistants ───────────────────────────────────────────────── */
  aiSuggestCids: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(aiSuggestCidsSchema)
    .mutation(async ({ input }) => {
      const suggestions = await suggestCIDs(input.soapText);
      return { suggestions };
    }),

  aiSuggestSoap: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(aiSuggestSoapSchema)
    .mutation(async ({ input }) => {
      const draft = await suggestSOAP(input.chiefComplaint, input.patientHistory);
      if (!draft) {
        throw new TRPCError({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Assistente de IA indisponível. Tente novamente em instantes.',
        });
      }
      return { draft };
    }),
});
