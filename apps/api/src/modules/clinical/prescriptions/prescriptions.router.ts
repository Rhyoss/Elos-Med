import { router } from '../../../trpc/trpc.js';
import { protectedProcedure } from '../../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../../trpc/middleware/rbac.middleware.js';
import {
  createPrescriptionSchema,
  updatePrescriptionSchema,
  signPrescriptionSchema,
  cancelPrescriptionSchema,
  duplicatePrescriptionSchema,
  sendPrescriptionSchema,
  listPrescriptionsByPatientSchema,
  getPrescriptionByIdSchema,
  requestPrescriptionPdfSchema,
} from '@dermaos/shared';
import {
  createPrescription,
  updatePrescription,
  signPrescription,
  cancelPrescription,
  duplicatePrescription,
  sendPrescription,
  getPrescriptionById,
  listPrescriptionsByPatient,
  listDeliveryHistory,
} from './prescriptions.service.js';
import {
  getOrGeneratePrescriptionPdf,
  getPrescriptionPdfUrl,
} from './prescription-pdf.service.js';

export const prescriptionsRouter = router({
  /* ── Mutations ───────────────────────────────────────────────────── */

  create: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(createPrescriptionSchema)
    .mutation(async ({ input, ctx }) => {
      const prescription = await createPrescription(input, ctx.clinicId!, ctx.user.sub);
      return { prescription };
    }),

  update: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(updatePrescriptionSchema)
    .mutation(async ({ input, ctx }) => {
      const prescription = await updatePrescription(input, ctx.clinicId!, ctx.user.sub);
      return { prescription };
    }),

  sign: protectedProcedure
    .use(requirePermission('clinical', 'sign'))
    .input(signPrescriptionSchema)
    .mutation(async ({ input, ctx }) => {
      const prescription = await signPrescription(input.id, ctx.clinicId!, ctx.user.sub);
      return { prescription };
    }),

  cancel: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(cancelPrescriptionSchema)
    .mutation(async ({ input, ctx }) => {
      const prescription = await cancelPrescription(input, ctx.clinicId!, ctx.user.sub);
      return { prescription };
    }),

  duplicate: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(duplicatePrescriptionSchema)
    .mutation(async ({ input, ctx }) => {
      const prescription = await duplicatePrescription(input.id, ctx.clinicId!, ctx.user.sub);
      return { prescription };
    }),

  send: protectedProcedure
    .use(requirePermission('clinical', 'sign'))
    .input(sendPrescriptionSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await sendPrescription(input, ctx.clinicId!, ctx.user.sub);
      return result;
    }),

  /* ── PDF ─────────────────────────────────────────────────────────── */

  requestPdf: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(requestPrescriptionPdfSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await getOrGeneratePrescriptionPdf(input.id, ctx.clinicId!, ctx.user.sub);
      return result;
    }),

  getPdfUrl: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(requestPrescriptionPdfSchema)
    .query(async ({ input, ctx }) => {
      const url = await getPrescriptionPdfUrl(input.id, ctx.clinicId!);
      return { url };
    }),

  /* ── Queries ─────────────────────────────────────────────────────── */

  getById: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(getPrescriptionByIdSchema)
    .query(async ({ input, ctx }) => {
      const prescription = await getPrescriptionById(input.id, ctx.clinicId!);
      return { prescription };
    }),

  listByPatient: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(listPrescriptionsByPatientSchema)
    .query(async ({ input, ctx }) => {
      return listPrescriptionsByPatient(input, ctx.clinicId!);
    }),

  deliveryHistory: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(getPrescriptionByIdSchema)
    .query(async ({ input, ctx }) => {
      const entries = await listDeliveryHistory(input.id, ctx.clinicId!);
      return { entries };
    }),
});
