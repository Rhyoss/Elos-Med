import { router } from './trpc.js';
import { authRouter }       from '../modules/auth/auth.router.js';
import { patientsRouter }   from '../modules/patients/patients.router.js';
import { schedulingRouter } from '../modules/scheduling/scheduling.router.js';
import { clinicalRouter }   from '../modules/clinical/clinical.router.js';
import { omniRouter }         from '../modules/omni/omni.router.js';
import { auroraAdminRouter }  from '../modules/aurora/admin/aurora-admin.router.js';
import { automationsRouter }  from '../modules/automations/automations.router.js';
import { templatesRouter }    from '../modules/automations/templates.router.js';
import { supplyRouter }       from '../modules/supply/supply.router.js';

export const appRouter = router({
  auth:       authRouter,
  patients:   patientsRouter,
  scheduling: schedulingRouter,
  clinical:   clinicalRouter,
  omni:       omniRouter,
  automations: automationsRouter,
  templates:   templatesRouter,
  aurora:     router({
    admin:    auroraAdminRouter,
  }),
  supply:     supplyRouter,
  // financial: financialRouter,
  // analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
