import crypto from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { withClinicContext } from '../../../db/client.js';
import { encrypt, decrypt } from '../../../lib/crypto.js';
import { logger } from '../../../lib/logger.js';
import type { Channel, UpdateCredentialInput } from '@dermaos/shared';
import { CHANNELS } from '@dermaos/shared';

const WEBHOOK_BASE_PATH = '/api/v1/webhooks';

function maskToken(token: string): string {
  if (token.length <= 4) return '****';
  return '****' + token.slice(-4);
}

function getWebhookUrl(clinicSlug: string, channel: Channel, baseUrl: string): string {
  return `${baseUrl}${WEBHOOK_BASE_PATH}/${channel}/${clinicSlug}`;
}

/** Simulates a health-check against the external service. */
async function checkChannelHealth(channel: Channel, credentials: Record<string, string>): Promise<{
  connected: boolean;
  error?: string;
}> {
  // Placeholder health checks per channel — real impl calls provider-specific APIs
  try {
    switch (channel) {
      case 'whatsapp': {
        if (!credentials['accessToken']) return { connected: false, error: 'Access token ausente.' };
        // Real: call Meta Graph API /me endpoint
        return { connected: true };
      }
      case 'instagram': {
        if (!credentials['accessToken']) return { connected: false, error: 'Access token ausente.' };
        return { connected: true };
      }
      case 'telegram': {
        if (!credentials['botToken']) return { connected: false, error: 'Bot token ausente.' };
        return { connected: true };
      }
      case 'email': {
        if (!credentials['host']) return { connected: false, error: 'Host SMTP ausente.' };
        return { connected: true };
      }
      default:
        return { connected: false, error: 'Canal desconhecido.' };
    }
  } catch (err) {
    logger.error({ err, channel }, 'Health check failed');
    return { connected: false, error: 'Falha ao verificar conexão.' };
  }
}

export async function listIntegrations(clinicId: string, baseUrl: string) {
  return withClinicContext(clinicId, async (client) => {
    const { rows: clinic } = await client.query(
      `SELECT slug FROM shared.clinics WHERE id = $1`,
      [clinicId],
    );
    const slug = clinic[0]?.slug ?? clinicId;

    const { rows: creds } = await client.query(
      `SELECT channel, token_preview, is_active, last_verified_at, last_error
         FROM shared.integration_credentials
         WHERE clinic_id = $1`,
      [clinicId],
    );

    const { rows: webhooks } = await client.query(
      `SELECT channel, secret_preview FROM shared.webhook_configs WHERE clinic_id = $1`,
      [clinicId],
    );

    const credMap = Object.fromEntries(creds.map((c) => [c.channel, c]));
    const webhookMap = Object.fromEntries(webhooks.map((w) => [w.channel, w]));

    return CHANNELS.map((ch) => {
      const cred = credMap[ch];
      const wh   = webhookMap[ch];
      return {
        channel:         ch,
        isActive:        cred?.is_active ?? false,
        tokenPreview:    cred?.token_preview ?? null,
        lastVerifiedAt:  cred?.last_verified_at ?? null,
        lastError:       cred?.last_error ?? null,
        webhookUrl:      getWebhookUrl(slug, ch, baseUrl),
        secretPreview:   wh?.secret_preview ?? null,
        hasWebhook:      !!wh,
      };
    });
  });
}

export async function updateCredential(
  clinicId: string,
  userId: string,
  input: UpdateCredentialInput,
) {
  return withClinicContext(clinicId, async (client) => {
    // Validate before saving
    const credentials: Record<string, string> = {};
    switch (input.channel) {
      case 'whatsapp':
      case 'instagram':
        credentials['accessToken'] = input.token;
        break;
      case 'telegram':
        credentials['botToken'] = input.token;
        break;
      case 'email':
        credentials['smtpPassword'] = input.token;
        break;
    }

    const health = await checkChannelHealth(input.channel, credentials);
    if (!health.connected) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Token inválido: ${health.error ?? 'falha na verificação.'}`,
      });
    }

    const credentialsEnc = encrypt(JSON.stringify(credentials));
    const tokenPreview   = maskToken(input.token).slice(-4);

    await client.query(
      `INSERT INTO shared.integration_credentials
         (clinic_id, channel, credentials_enc, token_preview, is_active, last_verified_at)
       VALUES ($1, $2, $3, $4, true, NOW())
       ON CONFLICT (clinic_id, channel)
       DO UPDATE SET credentials_enc   = EXCLUDED.credentials_enc,
                     token_preview     = EXCLUDED.token_preview,
                     is_active         = true,
                     last_verified_at  = NOW(),
                     last_error        = NULL`,
      [clinicId, input.channel, credentialsEnc, tokenPreview],
    );

    // Audit: never log the token value
    await client.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'settings', $1::uuid, 'settings.integration_updated', $2, $3)`,
      [
        clinicId,
        JSON.stringify({ channel: input.channel, changed: true }),
        JSON.stringify({ user_id: userId }),
      ],
    );

    return { channel: input.channel, connected: true };
  });
}

export async function testConnection(clinicId: string, channel: Channel): Promise<{
  connected: boolean;
  lastVerifiedAt: Date | null;
  error: string | null;
}> {
  return withClinicContext(clinicId, async (client) => {
    const { rows } = await client.query(
      `SELECT credentials_enc, is_active FROM shared.integration_credentials
         WHERE clinic_id = $1 AND channel = $2`,
      [clinicId, channel],
    );

    if (!rows[0]) {
      return { connected: false, lastVerifiedAt: null, error: 'Nenhuma credencial configurada.' };
    }

    let credentials: Record<string, string> = {};
    try {
      credentials = JSON.parse(decrypt(rows[0].credentials_enc)) as Record<string, string>;
    } catch {
      return { connected: false, lastVerifiedAt: null, error: 'Credencial corrompida.' };
    }

    const health = await checkChannelHealth(channel, credentials);
    const now = new Date();

    await client.query(
      `UPDATE shared.integration_credentials
         SET last_verified_at = $1, last_error = $2, is_active = $3
         WHERE clinic_id = $4 AND channel = $5`,
      [now, health.error ?? null, health.connected, clinicId, channel],
    );

    return {
      connected:      health.connected,
      lastVerifiedAt: now,
      error:          health.error ?? null,
    };
  });
}

export async function getWebhookConfig(clinicId: string, channel: Channel) {
  return withClinicContext(clinicId, async (client) => {
    const { rows: clinic } = await client.query(
      `SELECT slug FROM shared.clinics WHERE id = $1`,
      [clinicId],
    );
    const slug = clinic[0]?.slug ?? clinicId;

    const { rows } = await client.query(
      `SELECT secret_preview, created_at FROM shared.webhook_configs
         WHERE clinic_id = $1 AND channel = $2`,
      [clinicId, channel],
    );

    return {
      channel,
      webhookUrl:    `${WEBHOOK_BASE_PATH}/${channel}/${slug}`,
      secretPreview: rows[0]?.secret_preview ?? null,
      hasSecret:     !!rows[0],
    };
  });
}

export async function regenerateWebhookSecret(
  clinicId: string,
  userId: string,
  channel: Channel,
): Promise<{ channel: Channel; secret: string; preview: string }> {
  const rawSecret = crypto.randomBytes(32).toString('hex');
  const preview   = rawSecret.slice(-4);
  const secretEnc = encrypt(rawSecret);

  return withClinicContext(clinicId, async (client) => {
    await client.query(
      `INSERT INTO shared.webhook_configs (clinic_id, channel, webhook_secret_enc, secret_preview)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (clinic_id, channel)
       DO UPDATE SET webhook_secret_enc = EXCLUDED.webhook_secret_enc,
                     secret_preview     = EXCLUDED.secret_preview`,
      [clinicId, channel, secretEnc, preview],
    );

    await client.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'settings', $1::uuid, 'settings.webhook_regenerated', $2, $3)`,
      [
        clinicId,
        JSON.stringify({ channel }),
        JSON.stringify({ user_id: userId }),
      ],
    );

    // Return plaintext secret ONCE — caller must show it to the user
    return { channel, secret: rawSecret, preview };
  });
}

/** Used internally by the webhook handler to validate HMAC signatures. */
export async function getWebhookSecretForChannel(
  clinicId: string,
  channel: Channel,
): Promise<string | null> {
  const { rows } = await withClinicContext(clinicId, async (client) =>
    client.query(
      `SELECT webhook_secret_enc FROM shared.webhook_configs
         WHERE clinic_id = $1 AND channel = $2`,
      [clinicId, channel],
    ),
  );
  if (!rows[0]) return null;
  try {
    return decrypt(rows[0].webhook_secret_enc);
  } catch {
    return null;
  }
}
