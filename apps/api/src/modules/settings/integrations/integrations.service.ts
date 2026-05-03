import crypto from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { withClinicContext } from '../../../db/client.js';
import { encryptChannelConfig, decryptChannelConfig } from '../../omni/channels/channel-config.js';
import { logger } from '../../../lib/logger.js';
import type { Channel, UpdateCredentialInput } from '@dermaos/shared';
import { CHANNELS } from '@dermaos/shared';

const WEBHOOK_BASE_PATH = '/api/v1/webhooks';

/**
 * Mapa do canal "público" (settings) para o `omni.channel_type` do banco.
 * Telegram não tem enum próprio — reusa o slot `sms`.
 */
type OmniChannelType = 'whatsapp' | 'instagram' | 'sms' | 'email';
function toOmniType(c: Channel): OmniChannelType {
  if (c === 'telegram') return 'sms';
  return c;
}

function maskTokenSuffix(token: string | undefined | null): string | null {
  if (!token || token.length < 4) return null;
  return token.slice(-4);
}

/**
 * URL do webhook. Os handlers em omni/webhooks.route.ts são globais por
 * tipo (`/api/v1/webhooks/whatsapp`) — a clínica é resolvida pelo
 * phoneNumberId/pageId do payload, não pela URL.
 */
function getWebhookUrl(channel: Channel, baseUrl: string): string {
  return `${baseUrl}${WEBHOOK_BASE_PATH}/${channel}`;
}

interface ChannelRecord {
  id:                string;
  type:              OmniChannelType;
  name:              string;
  is_active:         boolean;
  config:            Record<string, unknown>;
  updated_at:        Date;
}

async function fetchChannelByType(client: { query: <T = unknown>(sql: string, params: unknown[]) => Promise<{ rows: T[] }> }, clinicId: string, type: OmniChannelType): Promise<ChannelRecord | null> {
  const { rows } = await client.query<ChannelRecord>(
    `SELECT id, type, name, is_active, config, updated_at
       FROM omni.channels
      WHERE clinic_id = $1 AND type = $2
      ORDER BY updated_at DESC
      LIMIT 1`,
    [clinicId, type],
  );
  return rows[0] ?? null;
}

/* ───────────────────────────────────────────────────────────────────────── */

export async function listIntegrations(clinicId: string, baseUrl: string) {
  return withClinicContext(clinicId, async (client) => {
    const { rows } = await client.query<ChannelRecord>(
      `SELECT id, type, name, is_active, config, updated_at
         FROM omni.channels
        WHERE clinic_id = $1`,
      [clinicId],
    );

    const byType = new Map<OmniChannelType, ChannelRecord>();
    for (const r of rows) {
      // Mantém apenas o mais recente por tipo (caso a clínica tenha múltiplos)
      const existing = byType.get(r.type);
      if (!existing || r.updated_at > existing.updated_at) byType.set(r.type, r);
    }

    return CHANNELS.map((ch) => {
      const omniType = toOmniType(ch);
      const row = byType.get(omniType);
      const config = row ? decryptChannelConfig(row.config) : {};

      // tokenPreview = últimos 4 chars do principal token do canal
      let tokenValue: string | undefined;
      switch (ch) {
        case 'whatsapp':
        case 'instagram':
          tokenValue = config['accessToken'] as string | undefined;
          break;
        case 'telegram':
          tokenValue = config['botToken'] as string | undefined;
          break;
        case 'email':
          tokenValue = config['pass'] as string | undefined;
          break;
      }

      const secretValue = config['webhookSecret'] as string | undefined;
      const lastVerifiedAt = (config['_lastVerifiedAt'] as string | undefined) ?? null;
      const lastError      = (config['_lastError'] as string | undefined) ?? null;

      return {
        channel:        ch,
        isActive:       row?.is_active ?? false,
        tokenPreview:   maskTokenSuffix(tokenValue),
        lastVerifiedAt: lastVerifiedAt ? new Date(lastVerifiedAt) : null,
        lastError,
        webhookUrl:     getWebhookUrl(ch, baseUrl),
        secretPreview:  maskTokenSuffix(secretValue),
        hasWebhook:     !!secretValue,
      };
    });
  });
}

/* ───────────────────────────────────────────────────────────────────────── */

/** Mapeia a entrada por canal para a config plain do omni.channels. */
function buildPlainConfig(input: UpdateCredentialInput): Record<string, unknown> {
  switch (input.channel) {
    case 'whatsapp':
      return {
        phoneNumberId: input.phoneNumberId,
        accessToken:   input.accessToken,
        appSecret:     input.appSecret,
        verifyToken:   input.verifyToken,
        mode:          'live',
      };
    case 'instagram':
      return {
        pageId:        input.pageId,
        accessToken:   input.accessToken,
        appSecret:     input.appSecret,
        verifyToken:   input.verifyToken,
        mode:          'live',
      };
    case 'telegram':
      return { botToken: input.botToken };
    case 'email':
      return { host: input.host, port: input.port, user: input.user, pass: input.pass };
  }
}

/**
 * Health-check sintético — em desenvolvimento valida apenas presença dos
 * campos. Em produção, cada canal chama a API do provedor.
 */
function quickValidate(input: UpdateCredentialInput): { ok: boolean; error?: string } {
  if (input.channel === 'whatsapp' && (!input.accessToken || !input.phoneNumberId)) {
    return { ok: false, error: 'WhatsApp exige phoneNumberId e accessToken.' };
  }
  if (input.channel === 'instagram' && (!input.accessToken || !input.pageId)) {
    return { ok: false, error: 'Instagram exige pageId e accessToken.' };
  }
  if (input.channel === 'telegram' && !input.botToken) {
    return { ok: false, error: 'Telegram exige botToken.' };
  }
  if (input.channel === 'email' && (!input.host || !input.user || !input.pass)) {
    return { ok: false, error: 'SMTP exige host, user e pass.' };
  }
  return { ok: true };
}

export async function updateCredential(
  clinicId: string,
  userId: string,
  input: UpdateCredentialInput,
) {
  const validation = quickValidate(input);
  if (!validation.ok) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: validation.error ?? 'Credenciais inválidas.' });
  }

  return withClinicContext(clinicId, async (client) => {
    const omniType = toOmniType(input.channel);
    const existing = await fetchChannelByType(client, clinicId, omniType);

    const plain = buildPlainConfig(input);
    plain['_lastVerifiedAt'] = new Date().toISOString();
    plain['_lastError']      = null;

    // Preserva webhookSecret existente se houver
    if (existing) {
      const oldDecrypted = decryptChannelConfig(existing.config);
      if (oldDecrypted['webhookSecret']) {
        plain['webhookSecret'] = oldDecrypted['webhookSecret'];
      }
    }

    const encrypted = encryptChannelConfig(plain);
    const channelName = `${input.channel}-default`;

    if (existing) {
      await client.query(
        `UPDATE omni.channels
            SET config     = $1,
                is_active  = true,
                updated_at = NOW()
          WHERE id = $2`,
        [JSON.stringify(encrypted), existing.id],
      );
    } else {
      await client.query(
        `INSERT INTO omni.channels (clinic_id, type, name, is_active, config)
         VALUES ($1, $2::omni.channel_type, $3, true, $4)
         ON CONFLICT (clinic_id, name)
         DO UPDATE SET config = EXCLUDED.config, is_active = true, updated_at = NOW()`,
        [clinicId, omniType, channelName, JSON.stringify(encrypted)],
      );
    }

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

    logger.info({ clinicId, channel: input.channel }, 'Integration credentials saved');
    return { channel: input.channel, connected: true };
  });
}

/* ───────────────────────────────────────────────────────────────────────── */

export async function testConnection(clinicId: string, channel: Channel): Promise<{
  connected:      boolean;
  lastVerifiedAt: Date | null;
  error:          string | null;
}> {
  return withClinicContext(clinicId, async (client) => {
    const row = await fetchChannelByType(client, clinicId, toOmniType(channel));
    if (!row) {
      return { connected: false, lastVerifiedAt: null, error: 'Canal não configurado.' };
    }

    const config = decryptChannelConfig(row.config);
    let ok = false;
    let err: string | null = null;

    switch (channel) {
      case 'whatsapp':
        ok = !!config['accessToken'] && !!config['phoneNumberId'];
        if (!ok) err = 'accessToken/phoneNumberId ausente.';
        break;
      case 'instagram':
        ok = !!config['accessToken'] && !!config['pageId'];
        if (!ok) err = 'accessToken/pageId ausente.';
        break;
      case 'telegram':
        ok = !!config['botToken'];
        if (!ok) err = 'botToken ausente.';
        break;
      case 'email':
        ok = !!config['host'] && !!config['user'];
        if (!ok) err = 'host/user ausente.';
        break;
    }

    const now = new Date();
    config['_lastVerifiedAt'] = now.toISOString();
    config['_lastError']      = err;

    await client.query(
      `UPDATE omni.channels
          SET config     = $1,
              is_active  = $2,
              updated_at = NOW()
        WHERE id = $3`,
      [JSON.stringify(encryptChannelConfig(config)), ok, row.id],
    );

    return { connected: ok, lastVerifiedAt: now, error: err };
  });
}

/* ───────────────────────────────────────────────────────────────────────── */

export async function getWebhookConfig(clinicId: string, channel: Channel) {
  return withClinicContext(clinicId, async (client) => {
    const row = await fetchChannelByType(client, clinicId, toOmniType(channel));
    const config = row ? decryptChannelConfig(row.config) : {};
    const secret = config['webhookSecret'] as string | undefined;
    return {
      channel,
      webhookUrl:    `${WEBHOOK_BASE_PATH}/${channel}`,
      secretPreview: maskTokenSuffix(secret),
      hasSecret:     !!secret,
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

  return withClinicContext(clinicId, async (client) => {
    const omniType = toOmniType(channel);
    const existing = await fetchChannelByType(client, clinicId, omniType);

    if (!existing) {
      throw new TRPCError({
        code:    'BAD_REQUEST',
        message: 'Configure as credenciais do canal antes de gerar o segredo do webhook.',
      });
    }

    const config = decryptChannelConfig(existing.config);
    config['webhookSecret'] = rawSecret;
    const encrypted = encryptChannelConfig(config);

    await client.query(
      `UPDATE omni.channels SET config = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(encrypted), existing.id],
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

    return { channel, secret: rawSecret, preview };
  });
}

/**
 * Desconecta o canal: marca is_active=false e LIMPA toda credencial. O
 * registro é mantido (para preservar histórico de conversas), mas
 * mensagens novas pelo webhook não serão mais aceitas (HMAC falhará por
 * falta de appSecret) e a UI volta para "Não conectado".
 */
export async function disconnectChannel(
  clinicId: string,
  userId: string,
  channel: Channel,
): Promise<{ channel: Channel; disconnected: boolean }> {
  return withClinicContext(clinicId, async (client) => {
    const omniType = toOmniType(channel);
    const row = await fetchChannelByType(client, clinicId, omniType);
    if (!row) {
      return { channel, disconnected: true };
    }

    await client.query(
      `UPDATE omni.channels
          SET is_active  = false,
              config     = '{}'::jsonb,
              updated_at = NOW()
        WHERE id = $1`,
      [row.id],
    );

    await client.query(
      `INSERT INTO audit.domain_events
         (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'settings', $1::uuid, 'settings.integration_disconnected', $2, $3)`,
      [
        clinicId,
        JSON.stringify({ channel }),
        JSON.stringify({ user_id: userId }),
      ],
    );

    logger.info({ clinicId, channel }, 'Integration disconnected');
    return { channel, disconnected: true };
  });
}

/**
 * Usado pelo handler de webhook para validar HMAC (canais não-WhatsApp/IG).
 * Para WhatsApp/Instagram, o appSecret é decifrado no fluxo via channel-config.
 */
export async function getWebhookSecretForChannel(
  clinicId: string,
  channel: Channel,
): Promise<string | null> {
  return withClinicContext(clinicId, async (client) => {
    const row = await fetchChannelByType(client, clinicId, toOmniType(channel));
    if (!row) return null;
    const config = decryptChannelConfig(row.config);
    return (config['webhookSecret'] as string | undefined) ?? null;
  });
}
