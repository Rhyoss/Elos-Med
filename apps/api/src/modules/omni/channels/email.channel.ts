import crypto from 'node:crypto';
import { logger } from '../../../lib/logger.js';
import type { IMessageChannel, SendMessagePayload, SendMessageResult } from './channel.interface.js';
import type { ChannelRow } from '../omni.types.js';

interface EmailConfig {
  /** Se true, aceita inbound webhooks via SendGrid/Mailgun com assinatura */
  provider?: 'sendgrid' | 'mailgun' | 'smtp';
  signingKey?: string;
  mode?: 'mock' | 'live';
}

function readConfig(channel: ChannelRow): EmailConfig {
  return (channel.config ?? {}) as EmailConfig;
}

export const emailChannel: IMessageChannel = {
  type: 'email',

  async send(channel, payload: SendMessagePayload): Promise<SendMessageResult> {
    const cfg = readConfig(channel);
    if (cfg.mode !== 'live') {
      logger.info({ channelId: channel.id, to: payload.toExternalId }, 'Email mock send — persisting only');
      return { externalMessageId: `mock-${crypto.randomUUID()}`, initialStatus: 'sent' };
    }
    // Envio real via SMTP/provedor é responsabilidade do worker de email — aqui só persiste.
    return { externalMessageId: null, initialStatus: 'pending' };
  },

  verifyWebhookSignature(channel, rawBody, headers): boolean {
    const cfg = readConfig(channel);
    // SEC-03 (fail-closed): rejeita sem signingKey, mesmo em modo mock.
    if (!cfg.signingKey) {
      logger.warn(
        { channelId: channel.id, channelType: 'email' },
        'Email webhook rejected — signingKey missing (SEC-03)',
      );
      return false;
    }

    // SendGrid: X-Twilio-Email-Event-Webhook-Signature (ECDSA) não suportamos aqui.
    // Mailgun: assinatura HMAC simples em timestamp + token.
    const ts    = headers['x-mailgun-timestamp'];
    const token = headers['x-mailgun-token'];
    const sig   = headers['x-mailgun-signature'];

    if (typeof ts === 'string' && typeof token === 'string' && typeof sig === 'string') {
      const expected = crypto
        .createHmac('sha256', cfg.signingKey)
        .update(`${ts}${token}`)
        .digest('hex');
      if (expected.length !== sig.length) return false;
      return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
    }

    // Fallback genérico: header X-Signature com HMAC do corpo
    const genericHeader = headers['x-signature'];
    const generic = Array.isArray(genericHeader) ? genericHeader[0] : genericHeader;
    if (!generic || typeof generic !== 'string') return false;

    const expected = crypto.createHmac('sha256', cfg.signingKey).update(rawBody).digest('hex');
    if (expected.length !== generic.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(generic, 'hex'));
  },
};
