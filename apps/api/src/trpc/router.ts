import { router } from './trpc.js';
import { authRouter }       from '../modules/auth/auth.router.js';
import { patientsRouter }   from '../modules/patients/patients.router.js';
import { schedulingRouter } from '../modules/scheduling/scheduling.router.js';
import { clinicalRouter }   from '../modules/clinical/clinical.router.js';

export const appRouter = router({
  auth:       authRouter,
  patients:   patientsRouter,
  scheduling: schedulingRouter,
  clinical:   clinicalRouter,
  // omni: omniRouter,
  // supply: supplyRouter,
  // financial: financialRouter,
  // analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
