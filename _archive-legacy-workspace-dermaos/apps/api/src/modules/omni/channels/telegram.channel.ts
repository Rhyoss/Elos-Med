import crypto from 'node:crypto';
import { logger } from '../../../lib/logger.js';
import type { IMessageChannel, SendMessagePayload, SendMessageResult } from './channel.interface.js';
import type { ChannelRow } from '../omni.types.js';

interface TelegramConfig {
  botToken?: string;
  /** Segredo configurado no Telegram Bot API (header X-Telegram-Bot-Api-Secret-Token) */
  webhookSecret?: string;
  mode?: 'mock' | 'live';
}

function readConfig(channel: ChannelRow): TelegramConfig {
  return (channel.config ?? {}) as TelegramConfig;
}

export const telegramChannel: IMessageChannel = {
  type: 'sms', // Telegram é tratado como canal 'sms' para fins de ENUM no DB atual

  async send(channel, payload: SendMessagePayload): Promise<SendMessageResult> {
    const cfg = readConfig(channel);
    if (cfg.mode !== 'live' || !cfg.botToken) {
      logger.info({ channelId: channel.id, to: payload.toExternalId }, 'Telegram mock send — persisting only');
      return { externalMessageId: `mock-${crypto.randomUUID()}`, initialStatus: 'sent' };
    }

    const response = await fetch(
      `https://api.telegram.org/bot${cfg.botToken}/sendMessage`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: payload.toExternalId,
          text:    payload.content ?? '',
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Telegram send failed ${response.status}: ${errText.slice(0, 500)}`);
    }

    const data = (await response.json()) as { result?: { message_id?: number } };
    return {
      externalMessageId: data.result?.message_id != null ? String(data.result.message_id) : null,
      initialStatus:     'sent',
    };
  },

  verifyWebhookSignature(channel, _rawBody, headers): boolean {
    const cfg = readConfig(channel);
    if (!cfg.webhookSecret) {
      logger.warn({ channelId: channel.id }, 'Telegram webhook secret not configured');
      return cfg.mode !== 'live';
    }
    const received = headers['x-telegram-bot-api-secret-token'];
    const token = Array.isArray(received) ? received[0] : received;
    if (!token || typeof token !== 'string') return false;
    const expected = cfg.webhookSecret;
    if (token.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  },
};
