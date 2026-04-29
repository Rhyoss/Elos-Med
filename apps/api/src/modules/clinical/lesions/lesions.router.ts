import { router } from '../../../trpc/trpc.js';
// SEC-16: lesões são PHI — auditedProcedure registra leituras E mutations.
import { auditedProcedure as protectedProcedure } from '../../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../../trpc/middleware/rbac.middleware.js';
import {
  createLesionSchema,
  updateLesionSchema,
  resolveLesionSchema,
  reactivateLesionSchema,
  setMonitoringLesionSchema,
  deleteLesionSchema,
  listLesionsByPatientSchema,
  getLesionByIdSchema,
  listLesionImagesSchema,
  listPatientImagesSchema,
  requestImageUrlSchema,
  retryImageProcessingSchema,
} from '@dermaos/shared';
import {
  createLesion,
  updateLesion,
  resolveLesion,
  reactivateLesion,
  setMonitoring,
  softDeleteLesion,
  getLesionById,
  listLesionsByPatient,
} from './lesions.service.js';
import {
  listImagesByLesion,
  listImagesByPatient,
  getImageById,
  requestPresignedUrl,
  retryProcessing,
} from './lesion-images.service.js';

export const lesionsRouter = router({
  /* ── Lesions CRUD ─────────────────────────────────────────────────── */
  create: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(createLesionSchema)
    .mutation(({ input, ctx }) => createLesion(input, ctx.clinicId!, ctx.user.sub)),

  update: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(updateLesionSchema)
    .mutation(({ input, ctx }) => updateLesion(input, ctx.clinicId!, ctx.user.sub)),

  resolve: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(resolveLesionSchema)
    .mutation(({ input, ctx }) => resolveLesion(input.id, input.reason, ctx.clinicId!, ctx.user.sub)),

  reactivate: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(reactivateLesionSchema)
    .mutation(({ input, ctx }) => reactivateLesion(input.id, input.reason, ctx.clinicId!, ctx.user.sub)),

  setMonitoring: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(setMonitoringLesionSchema)
    .mutation(({ input, ctx }) => setMonitoring(input.id, input.reason, ctx.clinicId!, ctx.user.sub)),

  softDelete: protectedProcedure
    .use(requirePermission('clinical', 'delete'))
    .input(deleteLesionSchema)
    .mutation(({ input, ctx }) => softDeleteLesion(input.id, input.reason, ctx.clinicId!, ctx.user.sub)),

  /* ── Queries ─────────────────────────────────────────────────────── */
  getById: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(getLesionByIdSchema)
    .query(({ input, ctx }) => getLesionById(input.id, ctx.clinicId!)),

  listByPatient: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(listLesionsByPatientSchema)
    .query(({ input, ctx }) => listLesionsByPatient(input, ctx.clinicId!)),

  /* ── Imagens ─────────────────────────────────────────────────────── */
  listImages: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(listLesionImagesSchema)
    .query(({ input, ctx }) => listImagesByLesion(input, ctx.clinicId!)),

  listPatientImages: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(listPatientImagesSchema)
    .query(({ input, ctx }) => listImagesByPatient(input, ctx.clinicId!)),

  getImageById: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(requestImageUrlSchema.pick({ imageId: true }))
    .query(({ input, ctx }) => getImageById(input.imageId, ctx.clinicId!)),

  requestImageUrl: protectedProcedure
    .use(requirePermission('clinical', 'read'))
    .input(requestImageUrlSchema)
    .mutation(({ input, ctx }) =>
      requestPresignedUrl(input.imageId, input.variant, ctx.clinicId!),
    ),

  retryImageProcessing: protectedProcedure
    .use(requirePermission('clinical', 'write'))
    .input(retryImageProcessingSchema)
    .mutation(({ input, ctx }) => retryProcessing(input.imageId, ctx.clinicId!)),
});
