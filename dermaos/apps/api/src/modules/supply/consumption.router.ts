import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requirePermission } from '../../trpc/middleware/rbac.middleware.js';
import {
  consumeKitSchema,
  listConsumptionsSchema,
  todayAppointmentsWithKitsSchema,
} from '@dermaos/shared';
import {
  consumeKit,
  listConsumptions,
} from './consumption.service.js';
import { withClinicContext } from '../../db/client.js';

export const consumptionRouter = router({
  consume: protectedProcedure
    .use(requirePermission('supply', 'write'))
    .input(consumeKitSchema)
    .mutation(async ({ input, ctx }) => {
      return consumeKit(input, {
        clinicId: ctx.clinicId!,
        userId:   ctx.user!.sub,
        ipOrigin: ctx.req.ip ?? null,
        source:   input.source,
      });
    }),

  list: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(listConsumptionsSchema)
    .query(async ({ input, ctx }) => listConsumptions(input, ctx.clinicId!)),

  todayAgenda: protectedProcedure
    .use(requirePermission('supply', 'read'))
    .input(todayAppointmentsWithKitsSchema)
    .query(async ({ input, ctx }) => {
      return withClinicContext(ctx.clinicId!, async (client) => {
        const targetDate = input.date ?? new Date().toISOString().slice(0, 10);
        const conds: string[] = [
          `a.clinic_id = $1`,
          `(a.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date = $2::date`,
          `a.status NOT IN ('cancelled','no_show')`,
        ];
        const params: unknown[] = [ctx.clinicId, targetDate];
        let p = 3;
        if (input.providerId) {
          conds.push(`a.provider_id = $${p++}`);
          params.push(input.providerId);
        }

        const r = await client.query(
          `SELECT a.id            AS appointment_id,
                  a.scheduled_at,
                  a.status,
                  a.patient_id,
                  pt.name         AS patient_name,
                  a.service_id,
                  s.name          AS service_name,
                  kt.id           AS kit_id,
                  kt.name         AS kit_name,
                  kt.version      AS kit_version,
                  (SELECT COUNT(*)::int FROM supply.kit_items ki WHERE ki.kit_template_id = kt.id) AS kit_items_count,
                  e.id            AS encounter_id,
                  e.status        AS encounter_status
             FROM shared.appointments a
             JOIN shared.patients pt        ON pt.id = a.patient_id
        LEFT JOIN shared.services s         ON s.id  = a.service_id
        LEFT JOIN supply.kit_templates kt   ON kt.procedure_type_id = a.service_id
                                            AND kt.clinic_id = a.clinic_id
                                            AND kt.status = 'active'
                                            AND kt.deleted_at IS NULL
        LEFT JOIN clinical.encounters e     ON e.appointment_id = a.id
            WHERE ${conds.join(' AND ')}
            ORDER BY a.scheduled_at ASC`,
          params,
        );
        return { data: r.rows };
      });
    }),
});
