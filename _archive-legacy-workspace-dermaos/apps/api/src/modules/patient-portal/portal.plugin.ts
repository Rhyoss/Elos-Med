import type { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { registerPortalAuthRoutes }         from './portal-auth.routes.js';
import { registerPortalHomeRoutes }          from './portal-home.routes.js';
import { registerPortalAppointmentRoutes }   from './portal-appointments.routes.js';
import { registerPortalPrescriptionRoutes }  from './portal-prescriptions.routes.js';
import { registerPortalResultsRoutes }       from './portal-results.routes.js';
import { registerPortalMessageRoutes }       from './portal-messages.routes.js';
import { registerPortalProfileRoutes }       from './portal-profile.routes.js';
import { registerPortalPushRoutes }          from './portal-push.routes.js';

async function portalPlugin(app: FastifyInstance): Promise<void> {
  // Todas as rotas do portal sob /portal/
  await app.register(async (portal) => {
    await registerPortalAuthRoutes(portal);
    await registerPortalHomeRoutes(portal);
    await registerPortalAppointmentRoutes(portal);
    await registerPortalPrescriptionRoutes(portal);
    await registerPortalResultsRoutes(portal);
    await registerPortalMessageRoutes(portal);
    await registerPortalProfileRoutes(portal);
    await registerPortalPushRoutes(portal);
  }, { prefix: '/portal' });
}

// fastify-plugin: não encapsula em scope isolado — herda JWT, cookies, etc. do app principal
export const registerPortalPlugin = fastifyPlugin(portalPlugin, {
  fastify: '>=5.0.0',
  name:    'portal',
});
