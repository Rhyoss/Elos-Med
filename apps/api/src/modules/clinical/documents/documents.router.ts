import { router } from '../../../trpc/trpc.js';
// SEC-16: PHI router — auditedProcedure registra reads e mutations
import { auditedProcedure as protectedProcedure } from '../../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../../trpc/middleware/rbac.middleware.js';
import {
  createDocumentSchema,
  updateDocumentSchema,
  signDocumentSchema,
  revokeDocumentSchema,
  getDocumentByIdSchema,
  requestDocumentPdfSchema,
  listDocumentsByPatientSchema,
  listDocumentsSchema,
  createConsentTermSchema,
  signConsentTermSchema,
  revokeConsentTermSchema,
  listConsentTermsByPatientSchema,
} from '@dermaos/shared';
import {
  createDocument,
  updateDocument,
  signDocument,
  revokeDocument,
  getDocumentById,
  listDocumentsByPatient,
  listDocuments,
  listDocumentsByPrescription,
  createConsentTerm,
  signConsentTerm,
  revokeConsentTerm,
  listConsentTermsByPatient,
  countPendingDocuments,
  countPendingConsentTerms,
} from './documents.service.js';
import { z } from 'zod';

export const documentsRouter = router({
  /* ── Document mutations ──────────────────────────────────────────── */

  create: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(createDocumentSchema)
    .mutation(async ({ input, ctx }) => {
      const document = await createDocument(input, ctx.clinicId!, ctx.user.sub);
      return { document };
    }),

  update: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(updateDocumentSchema)
    .mutation(async ({ input, ctx }) => {
      const document = await updateDocument(input, ctx.clinicId!, ctx.user.sub);
      return { document };
    }),

  sign: protectedProcedure
    .use(requirePermission('clinical', 'sign'))
    .input(signDocumentSchema)
    .mutation(async ({ input, ctx }) => {
      const document = await signDocument(input.id, ctx.clinicId!, ctx.user.sub);
      return { document };
    }),

  revoke: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(revokeDocumentSchema)
    .mutation(async ({ input, ctx }) => {
      const document = await revokeDocument(input, ctx.clinicId!, ctx.user.sub);
      return { document };
    }),

  /* ── Document queries ────────────────────────────────────────────── */

  getById: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(getDocumentByIdSchema)
    .query(async ({ input, ctx }) => {
      const document = await getDocumentById(input.id, ctx.clinicId!);
      return { document };
    }),

  listByPatient: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(listDocumentsByPatientSchema)
    .query(async ({ input, ctx }) => {
      return listDocumentsByPatient(input, ctx.clinicId!);
    }),

  list: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(listDocumentsSchema)
    .query(async ({ input, ctx }) => {
      return listDocuments(input, ctx.clinicId!);
    }),

  listByPrescription: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(requestDocumentPdfSchema)
    .query(async ({ input, ctx }) => {
      const documents = await listDocumentsByPrescription(input.id, ctx.clinicId!);
      return { documents };
    }),

  /* ── Consent Term mutations ──────────────────────────────────────── */

  createConsentTerm: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(createConsentTermSchema)
    .mutation(async ({ input, ctx }) => {
      const term = await createConsentTerm(input, ctx.clinicId!, ctx.user.sub);
      return { term };
    }),

  signConsentTerm: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(signConsentTermSchema)
    .mutation(async ({ input, ctx }) => {
      const term = await signConsentTerm(input, ctx.clinicId!, ctx.user.sub);
      return { term };
    }),

  revokeConsentTerm: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(revokeConsentTermSchema)
    .mutation(async ({ input, ctx }) => {
      const term = await revokeConsentTerm(input, ctx.clinicId!, ctx.user.sub);
      return { term };
    }),

  /* ── Consent Term queries ────────────────────────────────────────── */

  listConsentTermsByPatient: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(listConsentTermsByPatientSchema)
    .query(async ({ input, ctx }) => {
      return listConsentTermsByPatient(input, ctx.clinicId!);
    }),

  /* ── Counters (badge / summary) ──────────────────────────────────── */

  pendingCounts: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(z.object({}))
    .query(async ({ ctx }) => {
      const [documents, consentTerms] = await Promise.all([
        countPendingDocuments(ctx.clinicId!),
        countPendingConsentTerms(ctx.clinicId!),
      ]);
      return { documents, consentTerms };
    }),
});
