import type { Job, Queue } from 'bullmq';
import { Pool, type PoolClient } from 'pg';
import type Redis from 'ioredis';
import type pino from 'pino';
import { AuroraMsg, renderAuroraMessage } from '../../../api/src/modules/aurora/messages.js';

/**
 * Persiste mensagens recebidas via webhook e publica evento de realtime
 * no canal Redis `omni:realtime` — o processo da API está inscrito e
 * relaya para os sockets da clínica.
 *
 * Idempotência: chave primária é `external_message_id` + `clinic_id`.
 * Se já existe, retorna cedo sem duplicar.
 */

const REALTIME_CHANNEL = 'omni:realtime';

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function sanitize(input: string | null): string | null {
  if (input == null) return null;
  return input.normalize('NFC').replace(CONTROL_CHARS, '').replace(/\r\n/g, '\n').trim();
}

function makePreview(text: string, maxLen = 80): string {
  const single = text.replace(/\s+/g, ' ').trim();
  if (single.length <= maxLen) return single;
  return `${single.slice(0, maxLen - 1)}…`;
}

async function withClinicContext<T>(
  db: Pool,
  clinicId: string,
  cb: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL app.current_clinic_id = $1', [clinicId]);
    const out = await cb(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* ── Tipos do job (mesmo shape da API) ─────────────────────────────────── */

interface InboundJob {
  provider:          'whatsapp' | 'instagram' | 'telegram' | 'email';
  receivedAt:        string;
  clinicId:          string;
  channelId:         string;
  externalMessageId: string;
  externalContactId: string;
  contactName:       string | null;
  contentType:       'text' | 'image' | 'audio' | 'video' | 'document' | 'location';
  content:           string | null;
  mediaUrl:          string | null;
  mediaMetadata:     Record<string, unknown>;
  raw:               Record<string, unknown>;
}

interface StatusJob {
  provider: 'whatsapp' | 'instagram' | 'telegram' | 'email';
  type:     'status';
  clinicId: string;
  payload: {
    id?:        string;
    status?:    'sent' | 'delivered' | 'read' | 'failed';
    timestamp?: string;
  };
}

type AnyJob = InboundJob | StatusJob;

/* ── Persistência ──────────────────────────────────────────────────────── */

async function persistInbound(
  db:     Pool,
  redis:  Redis,
  job:    InboundJob,
  logger: pino.Logger,
): Promise<{
  messageId:      string;
  conversationId: string;
  contactId:      string;
  channelId:      string;
} | null> {
  const {
    clinicId, channelId, provider, externalContactId, contactName,
    externalMessageId, contentType, content, mediaUrl, mediaMetadata,
  } = job;

  const result = await withClinicContext(db, clinicId, async (client) => {
    // 1. Idempotência por external_message_id + clinic_id
    const existing = await client.query<{ id: string; conversation_id: string }>(
      `SELECT id, conversation_id FROM omni.messages
        WHERE clinic_id = $1 AND external_message_id = $2 LIMIT 1`,
      [clinicId, externalMessageId],
    );
    if (existing.rows[0]) {
      return { deduplicated: true as const };
    }

    // 2. Contato — busca/cria
    let contactId: string;
    if (provider === 'whatsapp') {
      const found = await client.query<{ id: string; name: string | null }>(
        `SELECT id, name FROM omni.contacts WHERE clinic_id = $1 AND phone = $2 LIMIT 1`,
        [clinicId, externalContactId],
      );
      if (found.rows[0]) {
        contactId = found.rows[0].id;
      } else {
        const created = await client.query<{ id: string }>(
          `INSERT INTO omni.contacts (clinic_id, name, phone, type, status, last_contacted_at)
           VALUES ($1, $2, $3, 'lead', 'active', NOW())
           RETURNING id`,
          [clinicId, contactName ?? externalContactId, externalContactId],
        );
        contactId = created.rows[0]!.id;
      }
    } else if (provider === 'email') {
      const found = await client.query<{ id: string }>(
        `SELECT id FROM omni.contacts WHERE clinic_id = $1 AND email = $2 LIMIT 1`,
        [clinicId, externalContactId],
      );
      if (found.rows[0]) {
        contactId = found.rows[0].id;
      } else {
        const created = await client.query<{ id: string }>(
          `INSERT INTO omni.contacts (clinic_id, name, email, type, status, last_contacted_at)
           VALUES ($1, $2, $3, 'lead', 'active', NOW())
           RETURNING id`,
          [clinicId, contactName ?? externalContactId, externalContactId],
        );
        contactId = created.rows[0]!.id;
      }
    } else {
      const key = provider === 'instagram' ? 'instagram_id' : 'telegram_id';
      const found = await client.query<{ id: string }>(
        `SELECT id FROM omni.contacts
          WHERE clinic_id = $1 AND external_ids ->> $2 = $3 LIMIT 1`,
        [clinicId, key, externalContactId],
      );
      if (found.rows[0]) {
        contactId = found.rows[0].id;
      } else {
        const created = await client.query<{ id: string }>(
          `INSERT INTO omni.contacts (clinic_id, name, external_ids, type, status, last_contacted_at)
           VALUES ($1, $2, jsonb_build_object($3::text, $4::text), 'lead', 'active', NOW())
           RETURNING id`,
          [clinicId, contactName ?? externalContactId, key, externalContactId],
        );
        contactId = created.rows[0]!.id;
      }
    }

    // 3. Conversa em aberto (ou cria)
    const openConv = await client.query<{ id: string }>(
      `SELECT id FROM omni.conversations
        WHERE clinic_id = $1 AND contact_id = $2 AND channel_id = $3
          AND status IN ('open', 'pending')
        ORDER BY last_message_at DESC NULLS LAST LIMIT 1`,
      [clinicId, contactId, channelId],
    );

    let conversationId: string;
    let isNewConversation = false;
    if (openConv.rows[0]) {
      conversationId = openConv.rows[0].id;
    } else {
      const preview = makePreview(sanitize(content) ?? '[mídia]');
      const created = await client.query<{ id: string }>(
        `INSERT INTO omni.conversations
           (clinic_id, contact_id, channel_id, status, priority, last_message_at, last_message_preview, unread_count)
         VALUES ($1, $2, $3, 'open', 'normal', NOW(), $4, 1)
         RETURNING id`,
        [clinicId, contactId, channelId, preview],
      );
      conversationId = created.rows[0]!.id;
      isNewConversation = true;
    }

    // 4. Mensagem
    const sanitizedContent = sanitize(content);
    const msg = await client.query<{ id: string; created_at: string }>(
      `INSERT INTO omni.messages
         (clinic_id, conversation_id, sender_type, content_type, content, media_url, media_metadata, status, external_message_id, sent_at)
       VALUES ($1, $2, 'patient', $3, $4, $5, $6, 'delivered', $7, NOW())
       RETURNING id, created_at`,
      [
        clinicId,
        conversationId,
        contentType,
        sanitizedContent,
        mediaUrl,
        JSON.stringify(mediaMetadata ?? {}),
        externalMessageId,
      ],
    );

    // 5. Atualiza conversa se já existia
    if (!isNewConversation) {
      // SEC-W: defesa em profundidade — `dermaos_worker` tem policy USING true.
      await client.query(
        `UPDATE omni.conversations
            SET last_message_at      = NOW(),
                last_message_preview = $2,
                unread_count         = unread_count + 1,
                updated_at           = NOW()
          WHERE id = $1 AND clinic_id = $3`,
        [conversationId, makePreview(sanitizedContent ?? '[mídia]'), clinicId],
      );
    }

    // 6. Contato: last_contacted_at — SEC-W defesa em profundidade
    await client.query(
      `UPDATE omni.contacts SET last_contacted_at = NOW() WHERE id = $1 AND clinic_id = $2`,
      [contactId, clinicId],
    );

    // 7. Nome do contato para o payload de realtime — SEC-W defesa em profundidade
    const contactRow = await client.query<{ name: string | null }>(
      `SELECT name FROM omni.contacts WHERE id = $1 AND clinic_id = $2`,
      [contactId, clinicId],
    );

    return {
      deduplicated:  false as const,
      messageId:     msg.rows[0]!.id,
      conversationId,
      contactId,
      contactName:   contactRow.rows[0]?.name ?? contactName ?? 'Contato',
      contentPreview: makePreview(sanitizedContent ?? '[mídia]'),
    };
  });

  if (result.deduplicated) {
    logger.debug({ externalMessageId }, 'Inbound deduped');
    return null;
  }

  // Publica evento de realtime — API Socket gateway relaya para a sala
  await redis.publish(
    REALTIME_CHANNEL,
    JSON.stringify({
      clinicId,
      event: 'new_message',
      payload: {
        conversationId: result.conversationId,
        messageId:      result.messageId,
        sender:         'patient',
        preview:        result.contentPreview,
        contactName:    result.contactName,
        timestamp:      new Date().toISOString(),
      },
    }),
  );

  return {
    messageId:      result.messageId,
    conversationId: result.conversationId,
    contactId:      result.contactId,
    channelId,
  };
}

/* ── Roteamento §A.4.2 passo 7 ──────────────────────────────────────────── */

interface RoutingDeps {
  auroraReasoningQueue: Queue;
  omniOutboundQueue:    Queue;
}

interface RoutingInfo {
  assignedTo:     string | null;
  auroraState:    Record<string, unknown>;
  aiAgentId:      string | null;
  optedInAt:      Date | null;
  optedOutAt:     Date | null;
  operatingHours: Record<string, { start: string; end: string } | null> | null;
  clinicTimezone: string | null;
}

async function loadRoutingInfo(
  db:             Pool,
  clinicId:       string,
  conversationId: string,
  contactId:      string,
  channelId:      string,
): Promise<RoutingInfo | null> {
  return withClinicContext(db, clinicId, async (client) => {
    const r = await client.query<{
      assigned_to:    string | null;
      metadata:       Record<string, unknown> | null;
      ai_agent_id:    string | null;
      opted_in_at:    Date | null;
      opted_out_at:   Date | null;
      operating_hours: Record<string, { start: string; end: string } | null> | null;
      timezone:       string | null;
    }>(
      `SELECT cv.assigned_to,
              cv.metadata,
              ch.ai_agent_id,
              ct.opted_in_at,
              ct.opted_out_at,
              cl.operating_hours,
              cl.timezone
         FROM omni.conversations cv
         JOIN omni.contacts      ct ON ct.id = cv.contact_id
         JOIN omni.channels      ch ON ch.id = cv.channel_id
         JOIN shared.clinics     cl ON cl.id = cv.clinic_id
        WHERE cv.id = $1 AND cv.clinic_id = $2
          AND ct.id = $3 AND ch.id = $4
        LIMIT 1`,
      [conversationId, clinicId, contactId, channelId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      assignedTo:     row.assigned_to,
      auroraState:   (row.metadata?.['aurora_state'] as Record<string, unknown>) ?? {},
      aiAgentId:      row.ai_agent_id,
      optedInAt:      row.opted_in_at,
      optedOutAt:     row.opted_out_at,
      operatingHours: row.operating_hours,
      clinicTimezone: row.timezone,
    };
  });
}

/**
 * Verifica se `now` está dentro do horário de atendimento da Aurora.
 * Fallback permissivo: se a clínica não configurou `operating_hours`, assume
 * 24/7 (a Aurora responde sempre — decisão segura porque ainda há guardrails).
 *
 * Estrutura esperada de `operating_hours`:
 *   { mon: {start:'08:00', end:'19:00'}, ..., sun: null }
 */
function withinAuroraOperatingHours(
  info: RoutingInfo,
  now:  Date = new Date(),
): boolean {
  if (!info.operatingHours) return true;
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  // Usa o offset UTC (a clínica pode ter timezone local — simplificação
  // aceitável até o suporte completo via date-fns-tz em fase posterior).
  const dayKey = dayKeys[now.getUTCDay()];
  if (!dayKey) return true;
  const window = info.operatingHours[dayKey];
  if (!window) return false;
  const hhmm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
  return hhmm >= window.start && hhmm <= window.end;
}

async function insertOptInMessage(
  db:             Pool,
  clinicId:       string,
  conversationId: string,
  auroraUserId:   string | null,
  text:           string,
): Promise<string> {
  return withClinicContext(db, clinicId, async (client) => {
    const r = await client.query<{ id: string }>(
      `INSERT INTO omni.messages
         (clinic_id, conversation_id,
          sender_type, sender_agent_id,
          content_type, content,
          status, metadata)
       VALUES ($1, $2, 'ai_agent', $3,
               'text', $4, 'pending',
               jsonb_build_object('auto', 'opt_in'))
       RETURNING id`,
      [clinicId, conversationId, auroraUserId, text],
    );
    return r.rows[0]!.id;
  });
}

async function route(
  db:       Pool,
  deps:     RoutingDeps,
  logger:   pino.Logger,
  clinicId: string,
  conversationId: string,
  contactId: string,
  channelId: string,
  messageId: string,
): Promise<void> {
  const info = await loadRoutingInfo(db, clinicId, conversationId, contactId, channelId);
  if (!info) {
    logger.warn({ conversationId }, 'routing: conversation/channel/contact not found');
    return;
  }

  const handlerIsHuman = info.assignedTo !== null || info.auroraState['handler'] === 'human';
  const auroraEnabled  = info.aiAgentId !== null
                      && info.optedOutAt === null
                      && withinAuroraOperatingHours(info);

  // Humano ativo OU Aurora desligada → nada a fazer (já publicamos realtime).
  if (handlerIsHuman || !auroraEnabled) {
    logger.debug(
      { conversationId, handlerIsHuman, auroraEnabled },
      'routing: staying on human handler',
    );
    return;
  }

  // Caso especial §A.4.2 passo 7: contato sem opt-in → envia B.3.2 direto,
  // sem reasoning.
  if (info.optedInAt === null) {
    const text = renderAuroraMessage(AuroraMsg.optIn, {});
    const msgId = await insertOptInMessage(db, clinicId, conversationId, null, text);
    await deps.omniOutboundQueue.add(
      'send',
      { messageId: msgId, clinicId, conversationId },
      {
        jobId:    `out:${msgId}`,
        attempts: 3,
        backoff:  { type: 'exponential', delay: 2_000 },
      },
    );
    logger.info({ conversationId, msgId }, 'routing: opt-in B.3.2 queued');
    return;
  }

  // Enfileira reasoning.
  await deps.auroraReasoningQueue.add(
    'reason',
    { messageId, clinicId, conversationId },
    {
      jobId:    `aurora:${messageId}`,
      attempts: 3,
      backoff:  { type: 'exponential', delay: 5_000 },
    },
  );
  logger.debug({ conversationId, messageId }, 'routing: aurora reasoning queued');
}

async function persistStatus(
  db:     Pool,
  redis:  Redis,
  job:    StatusJob,
  logger: pino.Logger,
): Promise<void> {
  const { clinicId, payload } = job;
  if (!payload.id || !payload.status) return;

  await withClinicContext(db, clinicId, async (client) => {
    const timestamps: Record<string, string> = {
      sent:      'sent_at',
      delivered: 'delivered_at',
      read:      'read_at',
    };
    const tsCol = timestamps[payload.status!];

    const setClauses = ['status = $3::omni.message_status'];
    if (tsCol) setClauses.push(`${tsCol} = NOW()`);

    const result = await client.query<{ id: string; conversation_id: string }>(
      `UPDATE omni.messages
          SET ${setClauses.join(', ')}
        WHERE clinic_id = $1 AND external_message_id = $2
       RETURNING id, conversation_id`,
      [clinicId, payload.id, payload.status],
    );

    if (result.rows[0]) {
      await redis.publish(
        REALTIME_CHANNEL,
        JSON.stringify({
          clinicId,
          event: 'message_updated',
          payload: {
            conversationId: result.rows[0].conversation_id,
            messageId:      result.rows[0].id,
            status:         payload.status,
          },
        }),
      );
    } else {
      logger.debug({ externalMessageId: payload.id }, 'Status update: message not found (may arrive before)');
    }
  });
}

/* ── Processor ─────────────────────────────────────────────────────────── */

export interface OmniInboundDeps {
  db:                   Pool;
  redis:                Redis;
  logger:               pino.Logger;
  auroraReasoningQueue: Queue;
  omniOutboundQueue:    Queue;
}

export function buildOmniInboundProcessor(deps: OmniInboundDeps) {
  return async function process(job: Job<AnyJob>): Promise<void> {
    const data = job.data;

    if ((data as StatusJob).type === 'status') {
      await persistStatus(deps.db, deps.redis, data as StatusJob, deps.logger);
      return;
    }

    const inbound = data as InboundJob;
    if (!inbound.clinicId || !inbound.channelId) {
      deps.logger.warn({ jobId: job.id }, 'Inbound job without clinicId/channelId — skipping');
      return;
    }

    const persisted = await persistInbound(deps.db, deps.redis, inbound, deps.logger);
    if (!persisted) return;

    // §A.4.2 passo 7 — decisão de roteamento.
    try {
      await route(
        deps.db,
        {
          auroraReasoningQueue: deps.auroraReasoningQueue,
          omniOutboundQueue:    deps.omniOutboundQueue,
        },
        deps.logger,
        inbound.clinicId,
        persisted.conversationId,
        persisted.contactId,
        persisted.channelId,
        persisted.messageId,
      );
    } catch (err) {
      deps.logger.error(
        { err, conversationId: persisted.conversationId, messageId: persisted.messageId },
        'routing failed — message persisted but not enqueued to Aurora',
      );
      // Não relança — a mensagem foi persistida e o realtime foi publicado;
      // o caso fica para retry manual (ou próxima mensagem dispara o pipeline).
    }
  };
}
