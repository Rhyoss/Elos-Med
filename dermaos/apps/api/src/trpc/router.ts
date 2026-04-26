import { router } from './trpc.js';
import { settingsRouter }   from '../modules/settings/settings.router.js';
import { authRouter }       from '../modules/auth/auth.router.js';
import { patientsRouter }   from '../modules/patients/patients.router.js';
import { schedulingRouter } from '../modules/scheduling/scheduling.router.js';
import { clinicalRouter }   from '../modules/clinical/clinical.router.js';
import { omniRouter }         from '../modules/omni/omni.router.js';
import { auroraAdminRouter }  from '../modules/aurora/admin/aurora-admin.router.js';
import { automationsRouter }  from '../modules/automations/automations.router.js';
import { templatesRouter }    from '../modules/automations/templates.router.js';
import { supplyRouter }       from '../modules/supply/supply.router.js';
import { financialRouter }    from '../modules/financial/financial.router.js';
import { dashboardRouter }    from '../modules/dashboard/dashboard.router.js';
import { analyticsRouter }    from '../modules/analytics/analytics.router.js';
import { lgpdRouter }            from '../modules/lgpd/lgpd.router.js';
import { notificationsRouter }   from '../modules/notifications/notifications.router.js';

export const appRouter = router({
  settings:   settingsRouter,
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
  financial:  financialRouter,
  dashboard:  dashboardRouter,
  analytics:      analyticsRouter,
  lgpd:           lgpdRouter,
  notifications:  notificationsRouter,
});

export type AppRouter = typeof appRouter;
