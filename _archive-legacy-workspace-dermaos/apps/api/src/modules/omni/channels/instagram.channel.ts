import crypto from 'node:crypto';
import { logger } from '../../../lib/logger.js';
import type { IMessageChannel, SendMessagePayload, SendMessageResult } from './channel.interface.js';
import type { ChannelRow } from '../omni.types.js';

interface InstagramConfig {
  pageId?:      string;
  accessToken?: string;
  appSecret?:   string;
  mode?:        'mock' | 'live';
}

function readConfig(channel: ChannelRow): InstagramConfig {
  return (channel.config ?? {}) as InstagramConfig;
}

export const instagramChannel: IMessageChannel = {
  type: 'instagram',

  async send(channel, payload: SendMessagePayload): Promise<SendMessageResult> {
    const cfg = readConfig(channel);

    if (cfg.mode !== 'live' || !cfg.accessToken || !cfg.pageId) {
      logger.info({ channelId: channel.id, to: payload.toExternalId }, 'Instagram mock send — persisting only');
      return { externalMessageId: `mock-${crypto.randomUUID()}`, initialStatus: 'sent' };
    }

    const url = `https://graph.facebook.com/v20.0/${cfg.pageId}/messages`;

    const response = await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${cfg.accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        recipient: { id: payload.toExternalId },
        message:   payload.contentType === 'text'
          ? { text: payload.content ?? '' }
          : { attachment: { type: payload.contentType, payload: { url: payload.mediaUrl } } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Instagram send failed ${response.status}: ${errText.slice(0, 500)}`);
    }

    const data = (await response.json()) as { message_id?: string };
    return { externalMessageId: data.message_id ?? null, initialStatus: 'sent' };
  },

  verifyWebhookSignature(channel, rawBody, headers): boolean {
    const cfg = readConfig(channel);
    if (!cfg.appSecret) {
      logger.warn({ channelId: channel.id }, 'Instagram webhook signature check skipped — no appSecret');
      return cfg.mode !== 'live';
    }

    const header = headers['x-hub-signature-256'];
    const sig = Array.isArray(header) ? header[0] : header;
    if (!sig || typeof sig !== 'string' || !sig.startsWith('sha256=')) return false;

    const expected = crypto.createHmac('sha256', cfg.appSecret).update(rawBody).digest('hex');
    const received = sig.slice(7);
    if (expected.length !== received.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
  },
};
