import { router } from '../../../trpc/trpc.js';
import { protectedProcedure } from '../../../trpc/middleware/auth.middleware.js';
import { requireRoles } from '../../../trpc/middleware/rbac.middleware.js';
import {
  updateCredentialSchema,
  testConnectionSchema,
  regenerateWebhookSecretSchema,
} from '@dermaos/shared';
import {
  listIntegrations,
  updateCredential,
  testConnection,
  getWebhookConfig,
  regenerateWebhookSecret,
} from './integrations.service.js';
import { env } from '../../../config/env.js';

const ownerOnly = requireRoles('owner');

function resolveBaseUrl(): string {
  return env.NODE_ENV === 'production'
    ? 'https://api.dermaos.com.br'
    : 'http://localhost:3001';
}

export const integrationsSettingsRouter = router({
  list: protectedProcedure
    .use(ownerOnly)
    .query(async ({ ctx }) => listIntegrations(ctx.clinicId!, resolveBaseUrl())),

  updateCredential: protectedProcedure
    .use(ownerOnly)
    .input(updateCredentialSchema)
    .mutation(async ({ ctx, input }) => updateCredential(ctx.clinicId!, ctx.user!.sub, input)),

  testConnection: protectedProcedure
    .use(ownerOnly)
    .input(testConnectionSchema)
    .mutation(async ({ ctx, input }) => testConnection(ctx.clinicId!, input.channel)),

  getWebhookConfig: protectedProcedure
    .use(ownerOnly)
    .input(regenerateWebhookSecretSchema)
    .query(async ({ ctx, input }) => getWebhookConfig(ctx.clinicId!, input.channel)),

  regenerateWebhookSecret: protectedProcedure
    .use(ownerOnly)
    .input(regenerateWebhookSecretSchema)
    .mutation(async ({ ctx, input }) =>
      regenerateWebhookSecret(ctx.clinicId!, ctx.user!.sub, input.channel),
    ),
});
