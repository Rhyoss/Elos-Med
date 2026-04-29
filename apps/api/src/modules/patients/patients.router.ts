import { z } from 'zod';
import { router } from '../../trpc/trpc.js';
// SEC-16: PHI router — auditedProcedure registra reads e mutations
import { auditedProcedure as protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission, requireRoles } from '../../trpc/middleware/rbac.middleware.js';
import {
  createPatientSchema,
  updatePatientSchema,
  patientListQuerySchema,
  searchPatientSchema,
  mergePatientSchema,
} from './patients.schema.js';
import {
  createPatient,
  updatePatient,
  getPatientById,
  listPatients,
  searchPatients,
  softDeletePatient,
  mergePatients,
  getDuplicatePatients,
  getPatientActivity,
} from './patients.service.js';
import { ensurePatientCollection } from '../../lib/typesense.js';

// Inicializa a collection do Typesense de forma assíncrona no boot do módulo
void ensurePatientCollection();

export const patientsRouter = router({
  create: protectedProcedure
    .use(requirePermission('patients', 'write'))
    .input(createPatientSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await createPatient(input, ctx.clinicId!, ctx.user.sub);
      return result;
    }),

  update: protectedProcedure
    .use(requirePermission('patients', 'write'))
    .input(z.object({ id: z.string().uuid(), data: updatePatientSchema }))
    .mutation(async ({ input, ctx }) => {
      const patient = await updatePatient(input.id, input.data, ctx.clinicId!, ctx.user.sub);
      return { patient };
    }),

  getById: protectedProcedure
    .use(requirePermission('patients', 'read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const patient = await getPatientById(input.id, ctx.clinicId!);
      return { patient };
    }),

  list: protectedProcedure
    .use(requirePermission('patients', 'read'))
    .input(patientListQuerySchema)
    .query(async ({ input, ctx }) => {
      return listPatients(input, ctx.clinicId!);
    }),

  search: protectedProcedure
    .use(requirePermission('patients', 'read'))
    .input(searchPatientSchema)
    .query(async ({ input, ctx }) => {
      return searchPatients(input, ctx.clinicId!);
    }),

  delete: protectedProcedure
    .use(requirePermission('patients', 'delete'))
    .input(z.object({
      id:     z.string().uuid(),
      reason: z.string().min(1, 'Motivo obrigatório').max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      await softDeletePatient(input.id, input.reason, ctx.clinicId!, ctx.user.sub);
      return { success: true };
    }),

  merge: protectedProcedure
    .use(requireRoles('owner', 'admin'))
    .input(mergePatientSchema)
    .mutation(async ({ input, ctx }) => {
      const patient = await mergePatients(input, ctx.clinicId!, ctx.user.sub);
      return { patient };
    }),

  getDuplicates: protectedProcedure
    .use(requireRoles('owner', 'admin'))
    .query(async ({ ctx }) => {
      const duplicates = await getDuplicatePatients(ctx.clinicId!);
      return { duplicates };
    }),

  getActivity: protectedProcedure
    .use(requirePermission('patients', 'read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const activity = await getPatientActivity(input.id, ctx.clinicId!);
      return { activity };
    }),
});
