import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import { logger } from '../../lib/logger.js';
import { omniInboundQueue } from '../../jobs/queues.js';
import type { OmniInboundJob } from '../../jobs/queues.js';
import { getProviderDriver } from './channels/index.js';
import type { ChannelRow } from './omni.types.js';

/**
 * Webhooks de canais externos. CADA rota:
 *   1. Valida signature ANTES de qualquer processamento (rejeita com 401 se inválido).
 *   2. Retorna 200 imediatamente (dentro de 3s — requisito Meta).
 *   3. Enfileira processamento em BullMQ (worker consome e persiste mensagem).
 */

/* ── Helpers ───────────────────────────────────────────────────────────── */

/**
 * Localiza o canal pelo identificador externo (phone_number_id / page_id / bot_token).
 * Caso não encontre, devolve null — caller decide se 401 ou 404.
 */
async function findChannelByExternalId(
  provider: 'whatsapp' | 'instagram' | 'telegram' | 'email',
  lookupValue: string,
): Promise<ChannelRow | null> {
  const configKey =
    provider === 'whatsapp'  ? 'phoneNumberId'
    : provider === 'instagram' ? 'pageId'
    : provider === 'telegram' ? 'botToken'
    : 'emailAddress';

  const type =
    provider === 'whatsapp'  ? 'whatsapp'
    : provider === 'instagram' ? 'instagram'
    : provider === 'telegram' ? 'sms'
    : 'email';

  const result = await db.query<ChannelRow>(
    `SELECT * FROM omni.channels
       WHERE type = $1::omni.channel_type
         AND is_active = TRUE
         AND config ->> $2 = $3
       LIMIT 1`,
    [type, configKey, lookupValue],
  );
  return result.rows[0] ?? null;
}

/**
 * Fallback para dev: se não existe canal configurado, usa o primeiro canal ativo
 * do tipo correspondente (útil em modo mock).
 */
async function findDefaultChannel(type: ChannelRow['type']): Promise<ChannelRow | null> {
  const result = await db.query<ChannelRow>(
    `SELECT * FROM omni.channels
       WHERE type = $1::omni.channel_type AND is_active = TRUE
       ORDER BY created_at ASC LIMIT 1`,
    [type],
  );
  return result.rows[0] ?? null;
}

async function logInvalidSignature(provider: string, req: FastifyRequest) {
  logger.warn(
    { provider, ip: req.ip, path: req.url, ua: req.headers['user-agent'] },
    'Webhook signature invalid — rejecting',
  );
}

/* ── Registro das rotas ────────────────────────────────────────────────── */

export async function registerOmniWebhookRoutes(app: FastifyInstance): Promise<void> {
  // Fastify parseia JSON por padrão mas descarta o body bruto.
  // Para verificação de assinatura, registramos um parser que preserva o raw buffer.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      try {
        (req as FastifyRequest & { rawBody?: Buffer }).rawBody = body as Buffer;
        if ((body as Buffer).length === 0) {
          done(null, {});
          return;
        }
        const parsed = JSON.parse((body as Buffer).toString('utf8'));
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  /* ── WhatsApp ────────────────────────────────────────────────────────── */

  // GET handshake do Meta (verify token)
  app.get('/api/v1/webhooks/whatsapp', async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const mode  = q['hub.mode'];
    const token = q['hub.verify_token'];
    const challenge = q['hub.challenge'];

    if (mode !== 'subscribe' || !token || !challenge) {
      return reply.status(400).send('Bad request');
    }

    const result = await db.query<{ id: string }>(
      `SELECT id FROM omni.channels
         WHERE type = 'whatsapp' AND is_active = TRUE
           AND config ->> 'verifyToken' = $1 LIMIT 1`,
      [token],
    );
    if (!result.rows[0]) {
      return reply.status(403).send('Forbidden');
    }
    return reply.status(200).send(challenge);
  });

  app.post('/api/v1/webhooks/whatsapp', async (req, reply) => {
    return handleWhatsAppWebhook(req, reply);
  });

  /* ── Instagram ───────────────────────────────────────────────────────── */

  app.get('/api/v1/webhooks/instagram', async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const mode  = q['hub.mode'];
    const token = q['hub.verify_token'];
    const challenge = q['hub.challenge'];

    if (mode !== 'subscribe' || !token || !challenge) {
      return reply.status(400).send('Bad request');
    }

    const result = await db.query<{ id: string }>(
      `SELECT id FROM omni.channels
         WHERE type = 'instagram' AND is_active = TRUE
           AND config ->> 'verifyToken' = $1 LIMIT 1`,
      [token],
    );
    if (!result.rows[0]) {
      return reply.status(403).send('Forbidden');
    }
    return reply.status(200).send(challenge);
  });

  app.post('/api/v1/webhooks/instagram', async (req, reply) => {
    return handleInstagramWebhook(req, reply);
  });

  /* ── Telegram ────────────────────────────────────────────────────────── */

  app.post('/api/v1/webhooks/telegram', async (req, reply) => {
    return handleTelegramWebhook(req, reply);
  });

  /* ── Email (Mailgun/SendGrid/SMTP-webhook) ───────────────────────────── */

  app.post('/api/v1/webhooks/email', async (req, reply) => {
    return handleEmailWebhook(req, reply);
  });

  logger.info('Omni webhook routes registered at /api/v1/webhooks/*');
}

/* ── Handlers ──────────────────────────────────────────────────────────── */

interface WhatsAppWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        messages?: Array<{
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          image?: { id?: string; mime_type?: string; caption?: string };
          audio?: { id?: string; mime_type?: string };
          document?: { id?: string; filename?: string; mime_type?: string };
          video?: { id?: string; mime_type?: string; caption?: string };
          location?: { latitude?: number; longitude?: number };
        }>;
        statuses?: Array<{
          id?: string;
          status?: 'sent' | 'delivered' | 'read' | 'failed';
          recipient_id?: string;
          timestamp?: string;
        }>;
      };
    }>;
  }>;
}

async function handleWhatsAppWebhook(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const rawBody = (req as FastifyRequest & { rawBody?: Buffer }).rawBody ?? Buffer.from('');
  const body = req.body as WhatsAppWebhookBody | null;

  const phoneNumberId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

  // Localiza canal
  let channel: ChannelRow | null = null;
  if (phoneNumberId) {
    channel = await findChannelByExternalId('whatsapp', phoneNumberId);
  }
  if (!channel) channel = await findDefaultChannel('whatsapp');

  if (!channel) {
    logger.warn({ phoneNumberId }, 'WhatsApp webhook: no channel found');
    return reply.status(404).send({ error: 'channel_not_found' });
  }

  const driver = getProviderDriver('whatsapp');
  if (!driver.verifyWebhookSignature(channel, rawBody.toString('utf8'), req.headers)) {
    await logInvalidSignature('whatsapp', req);
    return reply.status(401).send({ error: 'invalid_signature' });
  }

  // Extrai e enfileira cada mensagem
  const changes = body?.entry?.flatMap((e) => e.changes ?? []) ?? [];
  const enqueuePromises: Promise<unknown>[] = [];

  for (const change of changes) {
    const value = change.value;
    if (!value) continue;

    // Mensagens entrantes
    for (const msg of value.messages ?? []) {
      if (!msg.id || !msg.from) continue;

      const contact = value.contacts?.find((c) => c.wa_id === msg.from);
      const contactName = contact?.profile?.name ?? null;

      let contentType: OmniInboundJob['contentType'] = 'text';
      let content: string | null = null;
      let mediaUrl: string | null = null;
      let mediaMetadata: Record<string, unknown> = {};

      if (msg.type === 'text' && msg.text?.body) {
        content = msg.text.body;
      } else if (msg.type === 'image' && msg.image) {
        contentType = 'image';
        mediaMetadata = { mediaId: msg.image.id, mimeType: msg.image.mime_type };
        content = msg.image.caption ?? null;
      } else if (msg.type === 'audio' && msg.audio) {
        contentType = 'audio';
        mediaMetadata = { mediaId: msg.audio.id, mimeType: msg.audio.mime_type };
      } else if (msg.type === 'document' && msg.document) {
        contentType = 'document';
        mediaMetadata = {
          mediaId:  msg.document.id,
          filename: msg.document.filename,
          mimeType: msg.document.mime_type,
        };
      } else if (msg.type === 'video' && msg.video) {
        contentType = 'video';
        mediaMetadata = { mediaId: msg.video.id, mimeType: msg.video.mime_type };
        content = msg.video.caption ?? null;
      } else if (msg.type === 'location' && msg.location) {
        contentType = 'location';
        mediaMetadata = { lat: msg.location.latitude, lng: msg.location.longitude };
      }

      const job: OmniInboundJob = {
        provider:          'whatsapp',
        receivedAt:        new Date().toISOString(),
        clinicId:          channel.clinic_id,
        channelId:         channel.id,
        externalMessageId: msg.id,
        externalContactId: msg.from,
        contactName,
        contentType,
        content,
        mediaUrl,
        mediaMetadata,
        raw:               msg as unknown as Record<string, unknown>,
      };

      enqueuePromises.push(
        omniInboundQueue.add('inbound', job, { jobId: `wa:${msg.id}` }),
      );
    }

    // Atualizações de status
    for (const status of value.statuses ?? []) {
      if (!status.id || !status.status) continue;
      enqueuePromises.push(
        omniInboundQueue.add(
          'status',
          {
            provider: 'whatsapp',
            type:     'status',
            clinicId: channel.clinic_id,
            payload:  status,
          },
          { jobId: `wa-status:${status.id}:${status.status}` },
        ),
      );
    }
  }

  // Não bloqueia resposta HTTP no enqueue — mas aguarda com timeout curto
  // para detectar falha total do Redis. Em sucesso, responde 200 em <100ms.
  try {
    await Promise.race([
      Promise.all(enqueuePromises),
      new Promise((_, reject) => setTimeout(() => reject(new Error('enqueue_timeout')), 2_500)),
    ]);
  } catch (err) {
    logger.error({ err }, 'WhatsApp webhook enqueue failed');
    // Ainda assim retorna 200 para evitar retries descontrolados do Meta
  }

  return reply.status(200).send({ ok: true });
}

/* ── Instagram (Messenger Graph API — formato similar ao WhatsApp) ─────── */

interface InstagramWebhookBody {
  entry?: Array<{
    id?: string;                                  // page_id
    messaging?: Array<{
      sender?:    { id?: string };
      recipient?: { id?: string };
      timestamp?: number;
      message?: {
        mid?:  string;
        text?: string;
        attachments?: Array<{ type?: string; payload?: { url?: string } }>;
      };
    }>;
  }>;
}

async function handleInstagramWebhook(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const rawBody = (req as FastifyRequest & { rawBody?: Buffer }).rawBody ?? Buffer.from('');
  const body = req.body as InstagramWebhookBody | null;

  const pageId = body?.entry?.[0]?.id;

  let channel: ChannelRow | null = null;
  if (pageId) channel = await findChannelByExternalId('instagram', pageId);
  if (!channel) channel = await findDefaultChannel('instagram');

  if (!channel) {
    logger.warn({ pageId }, 'Instagram webhook: no channel found');
    return reply.status(404).send({ error: 'channel_not_found' });
  }

  const driver = getProviderDriver('instagram');
  if (!driver.verifyWebhookSignature(channel, rawBody.toString('utf8'), req.headers)) {
    await logInvalidSignature('instagram', req);
    return reply.status(401).send({ error: 'invalid_signature' });
  }

  const entries = body?.entry ?? [];
  const promises: Promise<unknown>[] = [];

  for (const entry of entries) {
    for (const m of entry.messaging ?? []) {
      const senderId = m.sender?.id;
      const messageId = m.message?.mid;
      if (!senderId || !messageId) continue;

      let contentType: OmniInboundJob['contentType'] = 'text';
      let content: string | null = m.message?.text ?? null;
      let mediaUrl: string | null = null;
      const att = m.message?.attachments?.[0];
      if (att?.type && att.payload?.url) {
        mediaUrl = att.payload.url;
        if (['image', 'audio', 'video'].includes(att.type)) contentType = att.type as OmniInboundJob['contentType'];
        else contentType = 'document';
      }

      const job: OmniInboundJob = {
        provider:          'instagram',
        receivedAt:        new Date().toISOString(),
        clinicId:          channel.clinic_id,
        channelId:         channel.id,
        externalMessageId: messageId,
        externalContactId: senderId,
        contactName:       null,
        contentType,
        content,
        mediaUrl,
        mediaMetadata:     {},
        raw:               m as unknown as Record<string, unknown>,
      };

      promises.push(omniInboundQueue.add('inbound', job, { jobId: `ig:${messageId}` }));
    }
  }

  try {
    await Promise.race([
      Promise.all(promises),
      new Promise((_, reject) => setTimeout(() => reject(new Error('enqueue_timeout')), 2_500)),
    ]);
  } catch (err) {
    logger.error({ err }, 'Instagram webhook enqueue failed');
  }

  return reply.status(200).send({ ok: true });
}

/* ── Telegram ──────────────────────────────────────────────────────────── */

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; last_name?: string; username?: string };
    chat:  { id: number };
    date:  number;
    text?: string;
    photo?: Array<{ file_id: string }>;
    voice?: { file_id: string; mime_type?: string };
    document?: { file_id: string; file_name?: string; mime_type?: string };
  };
}

async function handleTelegramWebhook(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const rawBody = (req as FastifyRequest & { rawBody?: Buffer }).rawBody ?? Buffer.from('');
  const body = req.body as TelegramUpdate | null;

  const channel = await findDefaultChannel('sms'); // Telegram slot

  if (!channel) {
    logger.warn('Telegram webhook: no channel found');
    return reply.status(404).send({ error: 'channel_not_found' });
  }

  const driver = getProviderDriver('telegram');
  if (!driver.verifyWebhookSignature(channel, rawBody.toString('utf8'), req.headers)) {
    await logInvalidSignature('telegram', req);
    return reply.status(401).send({ error: 'invalid_signature' });
  }

  const m = body?.message;
  if (!m || !body?.update_id) {
    return reply.status(200).send({ ok: true });
  }

  let contentType: OmniInboundJob['contentType'] = 'text';
  let content: string | null = m.text ?? null;
  let mediaMetadata: Record<string, unknown> = {};

  if (m.photo) {
    contentType = 'image';
    mediaMetadata = { fileId: m.photo[m.photo.length - 1]?.file_id };
  } else if (m.voice) {
    contentType = 'audio';
    mediaMetadata = { fileId: m.voice.file_id, mimeType: m.voice.mime_type };
  } else if (m.document) {
    contentType = 'document';
    mediaMetadata = { fileId: m.document.file_id, filename: m.document.file_name };
  }

  const name = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ')
    || m.from?.username
    || null;

  const job: OmniInboundJob = {
    provider:          'telegram',
    receivedAt:        new Date().toISOString(),
    clinicId:          channel.clinic_id,
    channelId:         channel.id,
    externalMessageId: String(m.message_id),
    externalContactId: String(m.chat.id),
    contactName:       name,
    contentType,
    content,
    mediaUrl:          null,
    mediaMetadata,
    raw:               m as unknown as Record<string, unknown>,
  };

  try {
    await Promise.race([
      omniInboundQueue.add('inbound', job, { jobId: `tg:${m.message_id}` }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('enqueue_timeout')), 2_500)),
    ]);
  } catch (err) {
    logger.error({ err }, 'Telegram webhook enqueue failed');
  }

  return reply.status(200).send({ ok: true });
}

/* ── Email ─────────────────────────────────────────────────────────────── */

interface EmailWebhookBody {
  messageId?: string;
  from?:    string;
  to?:      string;
  subject?: string;
  text?:    string;
  html?:    string;
  [k: string]: unknown;
}

async function handleEmailWebhook(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const rawBody = (req as FastifyRequest & { rawBody?: Buffer }).rawBody ?? Buffer.from('');
  const body = req.body as EmailWebhookBody | null;

  const toAddress = body?.to ?? '';
  const channel = toAddress
    ? await findChannelByExternalId('email', toAddress)
    : null;
  const fallback = channel ?? await findDefaultChannel('email');

  if (!fallback) {
    logger.warn({ toAddress }, 'Email webhook: no channel found');
    return reply.status(404).send({ error: 'channel_not_found' });
  }

  const driver = getProviderDriver('email');
  if (!driver.verifyWebhookSignature(fallback, rawBody.toString('utf8'), req.headers)) {
    await logInvalidSignature('email', req);
    return reply.status(401).send({ error: 'invalid_signature' });
  }

  const messageId = body?.messageId ?? `email-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const job: OmniInboundJob = {
    provider:          'email',
    receivedAt:        new Date().toISOString(),
    clinicId:          fallback.clinic_id,
    channelId:         fallback.id,
    externalMessageId: messageId,
    externalContactId: body?.from ?? 'unknown',
    contactName:       null,
    contentType:       'text',
    content:           body?.text ?? body?.subject ?? null,
    mediaUrl:          null,
    mediaMetadata:     { subject: body?.subject ?? null },
    raw:               (body ?? {}) as Record<string, unknown>,
  };

  try {
    await Promise.race([
      omniInboundQueue.add('inbound', job, { jobId: `em:${messageId}` }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('enqueue_timeout')), 2_500)),
    ]);
  } catch (err) {
    logger.error({ err }, 'Email webhook enqueue failed');
  }

  return reply.status(200).send({ ok: true });
}
