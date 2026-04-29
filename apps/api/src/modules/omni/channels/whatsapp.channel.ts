import crypto from 'node:crypto';
import { logger } from '../../../lib/logger.js';
import type { IMessageChannel, SendMessagePayload, SendMessageResult } from './channel.interface.js';
import type { ChannelRow } from '../omni.types.js';

/**
 * Canal WhatsApp Cloud API (Meta).
 * Em fase inicial, opera em modo mock: apenas loga e devolve um ID sintético.
 * Para produção, preencher channel.config com:
 *   - phoneNumberId
 *   - accessToken
 *   - appSecret (HMAC-SHA256 das webhooks)
 *   - verifyToken (challenge GET /webhooks/whatsapp)
 */

interface WhatsAppConfig {
  phoneNumberId?: string;
  accessToken?:   string;
  appSecret?:     string;
  verifyToken?:   string;
  mode?:          'mock' | 'live';
}

function readConfig(channel: ChannelRow): WhatsAppConfig {
  return (channel.config ?? {}) as WhatsAppConfig;
}

export const whatsappChannel: IMessageChannel = {
  type: 'whatsapp',

  async send(channel, payload: SendMessagePayload): Promise<SendMessageResult> {
    const cfg = readConfig(channel);

    if (cfg.mode !== 'live' || !cfg.accessToken || !cfg.phoneNumberId) {
      logger.info(
        { channelId: channel.id, to: payload.toExternalId, contentType: payload.contentType },
        'WhatsApp mock send — persisting only',
      );
      return {
        externalMessageId: `mock-${crypto.randomUUID()}`,
        initialStatus:     'sent',
      };
    }

    const url = `https://graph.facebook.com/v20.0/${cfg.phoneNumberId}/messages`;

    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to:                payload.toExternalId,
      type:              payload.contentType === 'text' ? 'text' : payload.contentType,
    };

    if (payload.contentType === 'text') {
      body['text'] = { body: payload.content ?? '' };
    } else if (payload.mediaUrl) {
      body[payload.contentType] = { link: payload.mediaUrl };
    }

    const response = await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${cfg.accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`WhatsApp send failed ${response.status}: ${errText.slice(0, 500)}`);
    }

    const data = (await response.json()) as { messages?: Array<{ id: string }> };
    const externalId = data.messages?.[0]?.id ?? null;

    return {
      externalMessageId: externalId,
      initialStatus:     'sent',
    };
  },

  verifyWebhookSignature(channel, rawBody, headers): boolean {
    const cfg = readConfig(channel);
    // SEC-03 (fail-closed): sem segredo configurado, REJEITAMOS o webhook
    // independente de mode/mock. Aceitar webhooks sem assinatura abriria a
    // porta para qualquer atacante injetar mensagens em qualquer clínica.
    // O modo mock só simula ENVIO; recepção sempre exige autenticidade.
    if (!cfg.appSecret) {
      logger.warn(
        { channelId: channel.id, channelType: 'whatsapp' },
        'WhatsApp webhook rejected — appSecret missing (SEC-03)',
      );
      return false;
    }

    const header = headers['x-hub-signature-256'];
    const sig = Array.isArray(header) ? header[0] : header;
    if (!sig || typeof sig !== 'string' || !sig.startsWith('sha256=')) return false;

    const expected = crypto
      .createHmac('sha256', cfg.appSecret)
      .update(rawBody)
      .digest('hex');

    const received = sig.slice(7);
    if (expected.length !== received.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
  },
};
