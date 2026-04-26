import { router } from '../../trpc/trpc.js';
import { protectedProcedure } from '../../trpc/middleware/auth.middleware.js';
import { requireRoles } from '../../trpc/middleware/rbac.middleware.js';
import {
  doctorDashboardInput,
  receptionDashboardInput,
  adminDashboardInput,
} from '@dermaos/shared';
import {
  getDoctorDashboard,
  getReceptionDashboard,
  getAdminDashboard,
  getReceptionWaitQueue,
} from './dashboard.service.js';

/**
 * Dashboard Router — endpoints contextuais por papel.
 *
 * Enforcement de papéis no servidor (defesa em profundidade — UI também restringe):
 *  - doctor:     dermatologist | nurse
 *  - reception:  receptionist | admin | owner
 *  - admin:      admin | owner | financial
 *  - waitQueue:  receptionist | admin | owner | dermatologist | nurse (somente leitura)
 *
 * O serviço aplica RLS via withClinicContext, evitando vazamento entre tenants.
 * Endpoints financeiros embutidos no admin retornam null para roles sem permissão financeira
 * (ver canViewFinancials no service).
 */
export const dashboardRouter = router({
  /** Dashboard do médico/enfermeiro — agenda, biópsias, protocolos, pacientes sem retorno. */
  doctor: protectedProcedure
    .use(requireRoles('dermatologist', 'nurse'))
    .input(doctorDashboardInput)
    .query(async ({ ctx, input }) =>
      getDoctorDashboard(ctx.user.sub, ctx.clinicId, input.date),
    ),

  /** Dashboard da recepção — agenda agregada, alertas (débitos, confirmações, aniversários). */
  reception: protectedProcedure
    .use(requireRoles('receptionist', 'admin', 'owner'))
    .input(receptionDashboardInput)
    .query(async ({ ctx, input }) =>
      getReceptionDashboard(ctx.clinicId, input.date),
    ),

  /** Dashboard do gestor — KPIs financeiros e operacionais com tendências e gráficos. */
  admin: protectedProcedure
    .use(requireRoles('admin', 'owner', 'financial'))
    .input(adminDashboardInput)
    .query(async ({ ctx, input }) =>
      getAdminDashboard(ctx.clinicId, { start: input.start, end: input.end }, ctx.user.role),
    ),

  /**
   * Fila de espera em tempo real — sempre vai ao banco, nunca ao cache.
   * Retornado também via Socket.io ao receber appointment.checked_in.
   */
  waitQueue: router({
    list: protectedProcedure
      .use(
        requireRoles(
          'receptionist',
          'admin',
          'owner',
          'dermatologist',
          'nurse',
        ),
      )
      .query(async ({ ctx }) => getReceptionWaitQueue(ctx.clinicId)),
  }),
});
