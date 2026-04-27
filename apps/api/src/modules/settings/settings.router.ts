import { router } from '../../trpc/trpc.js';
import { usersSettingsRouter }         from './users/users.router.js';
import { servicesSettingsRouter }      from './services/services.router.js';
import { integrationsSettingsRouter }  from './integrations/integrations.router.js';
import { aiSettingsRouter }            from './ai/ai.router.js';
import { auditSettingsRouter }         from './audit/audit.router.js';

export const settingsRouter = router({
  users:        usersSettingsRouter,
  services:     servicesSettingsRouter,
  integrations: integrationsSettingsRouter,
  ai:           aiSettingsRouter,
  audit:        auditSettingsRouter,
});
