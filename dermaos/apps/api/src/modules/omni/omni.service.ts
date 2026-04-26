import { TRPCError } from '@trpc/server';
import type { PoolClient } from 'pg';
import { db, withClinicContext } from '../../db/client.js';
import { logger } from '../../lib/logger.js';
import { decryptOptional } from '../../lib/crypto.js';
import { emitToClinic } from '../../lib/socket.js';
import { eventBus } from '../../events/event-bus.js';
import { redis } from '../../db/redis.js';
import { sanitizeMessageText, makePreview } from '../../lib/sanitize.js';
import { getChannelDriver } from './channels/index.js';
import type {
  ConversationCard,
  ConversationDetail,
  ConversationRow,
  ChannelRow,
  ContactRow,
  MessageRow,
  MessagePublic,
  ContactContext,
} from './omni.types.js';
import type {
  ListConversationsInput,
  ListMessagesInput,
  SendMessageInput,
  AssignConversationInput,
  EscalateConversationInput,
  ResolveConversationInput,
  MarkReadInput,
} from '@dermaos/shared';

/* ── Mapping helpers ───────────────────────────────────────────────────── */

function mapMessage(row: MessageRow, senderName: string | null = null): MessagePublic {
  return {
    id:                row.id,
    conversationId:    row.conversation_id,
    senderType:        row.sender_type,
    senderUserId:      row.sender_user_id,
    senderAgentId:     row.sender_agent_id,
    senderName,
    contentType:       row.content_type,
    content:           row.content,
    mediaUrl:          row.media_url,
    mediaMetadata:     row.media_metadata ?? {},
    status:            row.status,
    externalMessageId: row.external_message_id,
    sentAt:            row.sent_at      ? new Date(row.sent_at)      : null,
    deliveredAt:       row.delivered_at ? new Date(row.delivered_at) : null,
    readAt:            row.read_at      ? new Date(row.read_at)      : null,
    isInternalNote:    row.is_internal_note,
    createdAt:         new Date(row.created_at),
  };
}

interface ConversationJoinedRow extends ConversationRow {
  contact_name:       string;
  contact_patient_id: string | null;
  channel_type:       ChannelRow['type'];
  channel_name:       string;
  assignee_name:      string | null;
}

function mapConversationCard(row: ConversationJoinedRow): ConversationCard {
  return {
    id:                  row.id,
    contactId:           row.contact_id,
    contactName:         row.contact_name,
    contactPatientId:    row.contact_patient_id,
    channelId:           row.channel_id,
    channelType:         row.channel_type,
    channelName:         row.channel_name,
    status:              row.status,
    priority:            row.priority,
    assignedTo:          row.assigned_to,
    assignedToName:      row.assignee_name,
    unreadCount:         row.unread_count,
    lastMessageAt:       row.last_message_at ? new Date(row.last_message_at) : null,
    lastMessagePreview:  row.last_message_preview,
    tags:                row.tags ?? [],
  };
}

function mapConversationDetail(row: ConversationJoinedRow): ConversationDetail {
  return {
    ...mapConversationCard(row),
    subject:    row.subject,
    metadata:   row.metadata ?? {},
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
    resolvedBy: row.resolved_by,
    createdAt:  new Date(row.created_at),
    updatedAt:  new Date(row.updated_at),
  };
}

/* ── Rate limit de envio (tenant) ──────────────────────────────────────── */

const SEND_LIMIT_PER_MINUTE = 60;

async function checkSendRateLimit(clinicId: string): Promise<void> {
  const key = `omni:send:rl:${clinicId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60);
  }
  if (count > SEND_LIMIT_PER_MINUTE) {
    throw new TRPCError({
      code:    'TOO_MANY_REQUESTS',
      message: 'Limite de envio por minuto excedido. Aguarde alguns segundos e tente novamente.',
    });
  }
}

/* ── Conversations ─────────────────────────────────────────────────────── */

export async function listConversations(
  params:   ListConversationsInput,
  clinicId: string,
  userId:   string,
): Promise<{ data: ConversationCard[]; nextCursor: string | null }> {
  return withClinicContext(clinicId, async (client) => {
    const values: unknown[] = [clinicId];
    const conditions: string[] = ['c.clinic_id = $1'];
    let idx = 2;

    if (params.channelType) {
      conditions.push(`ch.type = $${idx++}`);
      values.push(params.channelType);
    }

    if (params.status) {
      conditions.push(`c.status = $${idx++}`);
      values.push(params.status);
    }

    if (params.assignment === 'mine') {
      conditions.push(`c.assigned_to = $${idx++}`);
      values.push(userId);
    } else if (params.assignment === 'ai') {
      conditions.push(`EXISTS (
        SELECT 1 FROM omni.messages m
        WHERE m.conversation_id = c.id AND m.sender_type = 'ai_agent'
        ORDER BY m.created_at DESC LIMIT 1
      )`);
    } else if (params.assignment === 'unassigned') {
      conditions.push(`c.assigned_to IS NULL`);
    } else if (params.assignment === 'team') {
      conditions.push(`c.assigned_to IS NOT NULL AND c.assigned_to <> $${idx++}`);
      values.push(userId);
    }

    if (params.search) {
      conditions.push(`(ct.name ILIKE $${idx} OR ct.phone ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    if (params.cursor) {
      conditions.push(`c.last_message_at < $${idx++}`);
      values.push(params.cursor);
    }

    const where = conditions.join(' AND ');

    const result = await client.query<ConversationJoinedRow>(
      `SELECT c.*,
              ct.name         AS contact_name,
              ct.patient_id   AS contact_patient_id,
              ch.type         AS channel_type,
              ch.name         AS channel_name,
              u.name          AS assignee_name
         FROM omni.conversations c
         JOIN omni.contacts ct ON ct.id = c.contact_id
         JOIN omni.channels ch ON ch.id = c.channel_id
         LEFT JOIN shared.users u ON u.id = c.assigned_to
        WHERE ${where}
        ORDER BY c.last_message_at DESC NULLS LAST
        LIMIT $${idx}`,
      [...values, params.limit + 1],
    );

    const rows = result.rows.slice(0, params.limit);
    const nextRow = result.rows.length > params.limit ? result.rows[params.limit - 1] : null;
    const nextCursor = nextRow?.last_message_at ?? null;

    return {
      data:       rows.map(mapConversationCard),
      nextCursor,
    };
  });
}

export async function getConversationById(
  id:       string,
  clinicId: string,
): Promise<ConversationDetail> {
  const result = await db.query<ConversationJoinedRow>(
    `SELECT c.*,
            ct.name         AS contact_name,
            ct.patient_id   AS contact_patient_id,
            ch.type         AS channel_type,
            ch.name         AS channel_name,
            u.name          AS assignee_name
       FROM omni.conversations c
       JOIN omni.contacts ct ON ct.id = c.contact_id
       JOIN omni.channels ch ON ch.id = c.channel_id
       LEFT JOIN shared.users u ON u.id = c.assigned_to
      WHERE c.id = $1 AND c.clinic_id = $2`,
    [id, clinicId],
  );

  if (!result.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversa não encontrada' });
  }

  return mapConversationDetail(result.rows[0]);
}

/* ── Messages ──────────────────────────────────────────────────────────── */

export async function listMessages(
  params:   ListMessagesInput,
  clinicId: string,
): Promise<{ data: MessagePublic[]; nextCursor: string | null }> {
  return withClinicContext(clinicId, async (client) => {
    // Garante que a conversa pertence ao tenant (RLS já protege, mas mensagem clara > 404)
    const conv = await client.query<{ id: string }>(
      'SELECT id FROM omni.conversations WHERE id = $1 AND clinic_id = $2',
      [params.conversationId, clinicId],
    );
    if (!conv.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversa não encontrada' });
    }

    const values: unknown[] = [params.conversationId];
    const cursorClause = params.cursor ? 'AND m.created_at < $2' : '';
    if (params.cursor) values.push(params.cursor);
    values.push(params.limit + 1);

    const result = await client.query<MessageRow & { sender_name: string | null }>(
      `SELECT m.*, u.name AS sender_name
         FROM omni.messages m
         LEFT JOIN shared.users u ON u.id = m.sender_user_id
        WHERE m.conversation_id = $1
          ${cursorClause}
        ORDER BY m.created_at DESC
        LIMIT $${params.cursor ? 3 : 2}`,
      values,
    );

    const rows = result.rows.slice(0, params.limit);
    const hasMore = result.rows.length > params.limit;
    const nextCursor = hasMore ? rows[rows.length - 1]?.created_at ?? null : null;

    // Retorna em ordem ASC para render em timeline crescente
    const asc = [...rows].reverse();
    return {
      data:       asc.map((r) => mapMessage(r, r.sender_name ?? null)),
      nextCursor,
    };
  });
}

/* ── Envio de mensagem (lado clínica) ──────────────────────────────────── */

export async function sendMessage(
  input:    SendMessageInput,
  clinicId: string,
  userId:   string,
): Promise<MessagePublic> {
  const sanitized = sanitizeMessageText(input.content);
  if (!sanitized) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Mensagem vazia após sanitização' });
  }

  await checkSendRateLimit(clinicId);

  return withClinicContext(clinicId, async (client) => {
    const convResult = await client.query<ConversationRow>(
      `SELECT * FROM omni.conversations WHERE id = $1 AND clinic_id = $2`,
      [input.conversationId, clinicId],
    );
    const conv = convResult.rows[0];
    if (!conv) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversa não encontrada' });
    }
    if (conv.status === 'archived' || conv.status === 'spam') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Conversa arquivada ou marcada como spam' });
    }

    const channelResult = await client.query<ChannelRow>(
      `SELECT * FROM omni.channels WHERE id = $1 AND clinic_id = $2`,
      [conv.channel_id, clinicId],
    );
    const channel = channelResult.rows[0];
    if (!channel || !channel.is_active) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Canal indisponível ou inativo' });
    }

    const contactResult = await client.query<{ phone: string | null; external_ids: Record<string, string>; email: string | null }>(
      `SELECT phone, external_ids, email FROM omni.contacts WHERE id = $1 AND clinic_id = $2`,
      [conv.contact_id, clinicId],
    );
    const contact = contactResult.rows[0];
    if (!contact) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Contato não encontrado' });
    }

    // Persiste como pending
    const insertResult = await client.query<MessageRow>(
      `INSERT INTO omni.messages
         (clinic_id, conversation_id, sender_type, sender_user_id, content_type, content, media_url, status, is_internal_note)
       VALUES ($1, $2, 'user', $3, $4, $5, $6, 'pending', $7)
       RETURNING *`,
      [
        clinicId,
        input.conversationId,
        userId,
        input.contentType,
        sanitized,
        input.mediaUrl ?? null,
        input.isInternalNote,
      ],
    );

    const messageRow = insertResult.rows[0]!;

    // Notas internas não vão pelo canal externo
    if (input.isInternalNote) {
      await client.query(
        `UPDATE omni.messages SET status = 'sent', sent_at = NOW() WHERE id = $1`,
        [messageRow.id],
      );
      messageRow.status  = 'sent';
      messageRow.sent_at = new Date().toISOString();

      await updateConversationAfterMessage(client, conv.id, sanitized, clinicId);

      const publicMsg = mapMessage(messageRow, null);
      emitToClinic(clinicId, 'new_message', {
        conversationId: conv.id,
        messageId:      messageRow.id,
        sender:         'user',
        preview:        makePreview(sanitized),
        timestamp:      messageRow.created_at,
      });
      return publicMsg;
    }

    // Envio real via driver do canal
    const driver = getChannelDriver(channel.type);
    const toExternalId =
      contact.phone
      ?? (contact.external_ids?.['whatsapp_id'] as string | undefined)
      ?? (contact.external_ids?.['instagram_id'] as string | undefined)
      ?? contact.email
      ?? '';

    try {
      const result = await driver.send(channel, {
        contentType:   input.contentType === 'template' ? 'template' : input.contentType === 'interactive' ? 'text' : input.contentType,
        content:       sanitized,
        mediaUrl:      input.mediaUrl ?? null,
        toExternalId,
      });

      const updated = await client.query<MessageRow>(
        `UPDATE omni.messages
            SET status = $2::omni.message_status,
                external_message_id = $3,
                sent_at = NOW()
          WHERE id = $1
        RETURNING *`,
        [messageRow.id, result.initialStatus, result.externalMessageId],
      );
      Object.assign(messageRow, updated.rows[0]);
    } catch (err) {
      logger.warn({ err, messageId: messageRow.id }, 'Outbound send failed — marking failed');
      await client.query(
        `UPDATE omni.messages SET status = 'failed' WHERE id = $1`,
        [messageRow.id],
      );
      messageRow.status = 'failed';
    }

    await updateConversationAfterMessage(client, conv.id, sanitized, clinicId);

    const publicMsg = mapMessage(messageRow, null);

    emitToClinic(clinicId, 'new_message', {
      conversationId: conv.id,
      messageId:      messageRow.id,
      sender:         'user',
      preview:        makePreview(sanitized),
      timestamp:      messageRow.created_at,
      status:         messageRow.status,
    });

    setImmediate(() => {
      void eventBus.publish(
        'conversation.message_sent',
        clinicId,
        conv.id,
        { messageId: messageRow.id, status: messageRow.status },
        { userId },
      ).catch((err) => logger.warn({ err }, 'Event publish failed (ignored)'));
    });

    return publicMsg;
  });
}

async function updateConversationAfterMessage(
  client:    PoolClient,
  convId:    string,
  preview:   string,
  clinicId:  string,
): Promise<void> {
  await client.query(
    `UPDATE omni.conversations
        SET last_message_at      = NOW(),
            last_message_preview = $3,
            updated_at           = NOW()
      WHERE id = $1 AND clinic_id = $2`,
    [convId, clinicId, makePreview(preview)],
  );
}

/* ── Retry de envio ────────────────────────────────────────────────────── */

export async function retrySendMessage(
  messageId: string,
  clinicId:  string,
  userId:    string,
): Promise<MessagePublic> {
  return withClinicContext(clinicId, async (client) => {
    const result = await client.query<MessageRow>(
      `SELECT * FROM omni.messages WHERE id = $1 AND clinic_id = $2`,
      [messageId, clinicId],
    );
    const msg = result.rows[0];
    if (!msg) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Mensagem não encontrada' });
    }
    if (msg.status !== 'failed') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Apenas mensagens com falha podem ser reenviadas' });
    }
    if (msg.content == null) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Mensagem sem conteúdo' });
    }

    await client.query(
      `UPDATE omni.messages SET status = 'pending' WHERE id = $1`,
      [messageId],
    );

    // Reusa sendMessage: busca canal e reenvia
    const convRes = await client.query<ConversationRow>(
      `SELECT * FROM omni.conversations WHERE id = $1 AND clinic_id = $2`,
      [msg.conversation_id, clinicId],
    );
    const conv = convRes.rows[0]!;

    const channelRes = await client.query<ChannelRow>(
      `SELECT * FROM omni.channels WHERE id = $1`,
      [conv.channel_id],
    );
    const channel = channelRes.rows[0]!;

    const contactRes = await client.query<{ phone: string | null; external_ids: Record<string, string>; email: string | null }>(
      `SELECT phone, external_ids, email FROM omni.contacts WHERE id = $1`,
      [conv.contact_id],
    );
    const contact = contactRes.rows[0]!;

    const driver = getChannelDriver(channel.type);
    const toExternalId =
      contact.phone
      ?? (contact.external_ids?.['whatsapp_id'] as string | undefined)
      ?? (contact.external_ids?.['instagram_id'] as string | undefined)
      ?? contact.email
      ?? '';

    try {
      const sendResult = await driver.send(channel, {
        contentType: msg.content_type === 'template' ? 'template' : msg.content_type === 'interactive' ? 'text' : (msg.content_type as 'text' | 'image' | 'audio' | 'video' | 'document' | 'location'),
        content:     msg.content,
        mediaUrl:    msg.media_url,
        toExternalId,
      });

      const updated = await client.query<MessageRow>(
        `UPDATE omni.messages
            SET status = $2::omni.message_status,
                external_message_id = $3,
                sent_at = NOW()
          WHERE id = $1
        RETURNING *`,
        [messageId, sendResult.initialStatus, sendResult.externalMessageId],
      );

      emitToClinic(clinicId, 'message_updated', {
        conversationId: conv.id,
        messageId,
        status:         updated.rows[0]?.status,
      });

      setImmediate(() => {
        void eventBus.publish(
          'conversation.message_retried',
          clinicId,
          conv.id,
          { messageId },
          { userId },
        ).catch(() => undefined);
      });

      return mapMessage(updated.rows[0]!);
    } catch (err) {
      logger.warn({ err, messageId }, 'Retry send failed');
      await client.query(
        `UPDATE omni.messages SET status = 'failed' WHERE id = $1`,
        [messageId],
      );
      throw new TRPCError({
        code:    'INTERNAL_SERVER_ERROR',
        message: 'Falha ao reenviar a mensagem. Tente novamente em instantes.',
      });
    }
  });
}

/* ── Assign / escalate / resolve ───────────────────────────────────────── */

export async function assignConversation(
  input:    AssignConversationInput,
  clinicId: string,
  userId:   string,
): Promise<ConversationDetail> {
  return withClinicContext(clinicId, async (client) => {
    const prev = await client.query<{ assigned_to: string | null }>(
      `SELECT assigned_to FROM omni.conversations WHERE id = $1 AND clinic_id = $2`,
      [input.conversationId, clinicId],
    );
    if (!prev.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversa não encontrada' });
    }

    await client.query(
      `UPDATE omni.conversations SET assigned_to = $3, updated_at = NOW()
         WHERE id = $1 AND clinic_id = $2`,
      [input.conversationId, clinicId, input.assigneeId],
    );

    emitToClinic(clinicId, 'conversation_assigned', {
      conversationId: input.conversationId,
      assigneeId:     input.assigneeId,
    });

    setImmediate(() => {
      void eventBus.publish(
        'conversation.assigned',
        clinicId,
        input.conversationId,
        {
          from:      prev.rows[0]?.assigned_to ?? null,
          to:        input.assigneeId,
          changedBy: userId,
        },
        { userId },
      ).catch(() => undefined);
    });

    return getConversationById(input.conversationId, clinicId);
  });
}

export async function escalateConversation(
  input:    EscalateConversationInput,
  clinicId: string,
  userId:   string,
): Promise<ConversationDetail> {
  return withClinicContext(clinicId, async (client) => {
    await client.query(
      `UPDATE omni.conversations
          SET assigned_to = $3, priority = 'high', updated_at = NOW()
        WHERE id = $1 AND clinic_id = $2`,
      [input.conversationId, clinicId, input.toUserId],
    );

    // Mensagem de sistema para marcar transição
    await client.query(
      `INSERT INTO omni.messages
         (clinic_id, conversation_id, sender_type, content_type, content, status, sent_at, is_internal_note)
       VALUES ($1, $2, 'system', 'text', $3, 'sent', NOW(), TRUE)`,
      [
        clinicId,
        input.conversationId,
        `— Atendimento escalado: ${input.reason}`,
      ],
    );

    emitToClinic(clinicId, 'conversation_assigned', {
      conversationId: input.conversationId,
      assigneeId:     input.toUserId,
      escalated:      true,
    });

    setImmediate(() => {
      void eventBus.publish(
        'conversation.escalated',
        clinicId,
        input.conversationId,
        { to: input.toUserId, reason: input.reason, by: userId },
        { userId },
      ).catch(() => undefined);
    });

    return getConversationById(input.conversationId, clinicId);
  });
}

export async function resolveConversation(
  input:    ResolveConversationInput,
  clinicId: string,
  userId:   string,
): Promise<ConversationDetail> {
  return withClinicContext(clinicId, async (client) => {
    await client.query(
      `UPDATE omni.conversations
          SET status = 'resolved',
              resolved_at = NOW(),
              resolved_by = $3,
              updated_at = NOW()
        WHERE id = $1 AND clinic_id = $2`,
      [input.conversationId, clinicId, userId],
    );

    if (input.reason) {
      await client.query(
        `INSERT INTO omni.messages
           (clinic_id, conversation_id, sender_type, content_type, content, status, sent_at, is_internal_note)
         VALUES ($1, $2, 'system', 'text', $3, 'sent', NOW(), TRUE)`,
        [clinicId, input.conversationId, `— Conversa resolvida: ${input.reason}`],
      );
    }

    emitToClinic(clinicId, 'conversation_status_changed', {
      conversationId: input.conversationId,
      status:         'resolved',
    });

    setImmediate(() => {
      void eventBus.publish(
        'conversation.resolved',
        clinicId,
        input.conversationId,
        { reason: input.reason ?? null, by: userId },
        { userId },
      ).catch(() => undefined);
    });

    return getConversationById(input.conversationId, clinicId);
  });
}

/* ── Mark read ─────────────────────────────────────────────────────────── */

export async function markConversationRead(
  input:    MarkReadInput,
  clinicId: string,
): Promise<void> {
  return withClinicContext(clinicId, async (client) => {
    await client.query(
      `UPDATE omni.conversations
          SET unread_count = 0, updated_at = NOW()
        WHERE id = $1 AND clinic_id = $2`,
      [input.conversationId, clinicId],
    );
    emitToClinic(clinicId, 'conversation_read', {
      conversationId: input.conversationId,
    });
  });
}

/* ── Canais (listar / criar) ───────────────────────────────────────────── */

export async function listChannels(clinicId: string): Promise<Array<{
  id:       string;
  type:     ChannelRow['type'];
  name:     string;
  isActive: boolean;
}>> {
  const result = await db.query<ChannelRow>(
    `SELECT id, type, name, is_active FROM omni.channels
      WHERE clinic_id = $1 ORDER BY name ASC`,
    [clinicId],
  );
  return result.rows.map((r) => ({
    id:       r.id,
    type:     r.type,
    name:     r.name,
    isActive: r.is_active,
  }));
}

/* ── Contato: contexto para o painel direito ───────────────────────────── */

export async function getContactContext(
  contactId: string,
  clinicId:  string,
): Promise<ContactContext> {
  const contactRes = await db.query<ContactRow>(
    `SELECT * FROM omni.contacts WHERE id = $1 AND clinic_id = $2`,
    [contactId, clinicId],
  );
  const contact = contactRes.rows[0];
  if (!contact) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Contato não encontrado' });
  }

  let patient: ContactContext['patient'] = null;

  if (contact.patient_id) {
    const patRes = await db.query<{
      id:            string;
      name:          string | null;
      total_visits:  number;
      last_visit_at: string | null;
    }>(
      `SELECT id, name, total_visits, last_visit_at
         FROM shared.patients
        WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL`,
      [contact.patient_id, clinicId],
    );

    const pat = patRes.rows[0];
    if (pat) {
      const [encounters, nextAppt] = await Promise.all([
        db.query<{ id: string; encountered_at: string; chief_complaint: string | null }>(
          `SELECT id, encountered_at, chief_complaint
             FROM clinical.encounters
            WHERE patient_id = $1 AND clinic_id = $2
            ORDER BY encountered_at DESC
            LIMIT 5`,
          [pat.id, clinicId],
        ).catch(() => ({ rows: [] as Array<{ id: string; encountered_at: string; chief_complaint: string | null }> })),
        db.query<{ id: string; scheduled_at: string; type: string }>(
          `SELECT id, scheduled_at, type
             FROM shared.appointments
            WHERE patient_id = $1 AND clinic_id = $2
              AND scheduled_at > NOW()
              AND status IN ('confirmed', 'scheduled')
            ORDER BY scheduled_at ASC
            LIMIT 1`,
          [pat.id, clinicId],
        ).catch(() => ({ rows: [] as Array<{ id: string; scheduled_at: string; type: string }> })),
      ]);

      patient = {
        id:           pat.id,
        name:         decryptOptional(pat.name) ?? 'Paciente',
        totalVisits:  pat.total_visits ?? 0,
        lastVisitAt:  pat.last_visit_at ? new Date(pat.last_visit_at) : null,
        recentEncounters: encounters.rows.map((e) => ({
          id:            e.id,
          encounteredAt: new Date(e.encountered_at),
          summary:       e.chief_complaint,
        })),
        nextAppointment: nextAppt.rows[0]
          ? {
              id:          nextAppt.rows[0].id,
              scheduledAt: new Date(nextAppt.rows[0].scheduled_at),
              type:        nextAppt.rows[0].type,
            }
          : null,
      };
    }
  }

  return {
    id:        contact.id,
    patientId: contact.patient_id,
    type:      contact.type,
    name:      contact.name,
    phone:     contact.phone,
    email:     contact.email,
    tags:      contact.tags ?? [],
    patient,
    leadScore: null,
  };
}

export async function updateContactTags(
  contactId: string,
  tags:      string[],
  clinicId:  string,
): Promise<string[]> {
  const result = await db.query<{ tags: string[] }>(
    `UPDATE omni.contacts
        SET tags = $3::text[], updated_at = NOW()
      WHERE id = $1 AND clinic_id = $2
   RETURNING tags`,
    [contactId, clinicId, tags],
  );
  if (!result.rows[0]) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Contato não encontrado' });
  }
  return result.rows[0].tags;
}

export async function linkContactToPatient(
  contactId: string,
  patientId: string,
  clinicId:  string,
): Promise<ContactContext> {
  return withClinicContext(clinicId, async (client) => {
    const pat = await client.query<{ id: string }>(
      `SELECT id FROM shared.patients WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL`,
      [patientId, clinicId],
    );
    if (!pat.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Paciente não encontrado' });
    }

    await client.query(
      `UPDATE omni.contacts
          SET patient_id = $3, type = 'patient', updated_at = NOW()
        WHERE id = $1 AND clinic_id = $2`,
      [contactId, clinicId, patientId],
    );

    return getContactContext(contactId, clinicId);
  });
}

/* ── Contagem global de não-lidas (para badge do sidebar) ──────────────── */

export async function getUnreadCount(clinicId: string, userId: string): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COALESCE(SUM(unread_count), 0)::text AS count
       FROM omni.conversations
      WHERE clinic_id = $1
        AND (assigned_to = $2 OR assigned_to IS NULL)
        AND status = 'open'`,
    [clinicId, userId],
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

/* ── Inbound (webhook → worker → DB) ───────────────────────────────────── */

export interface InboundMessageInput {
  clinicId:          string;
  channelId:         string;
  provider:          'whatsapp' | 'instagram' | 'telegram' | 'email';
  externalContactId: string;
  contactName:       string | null;
  externalMessageId: string;
  contentType:       'text' | 'image' | 'audio' | 'video' | 'document' | 'location';
  content:           string | null;
  mediaUrl:          string | null;
  mediaMetadata:     Record<string, unknown>;
  receivedAt:        Date;
}

/**
 * Idempotente: se já existe message com esse external_message_id na clínica,
 * retorna o registro existente sem criar duplicata.
 */
export async function persistInboundMessage(input: InboundMessageInput): Promise<{
  messageId:       string;
  conversationId:  string;
  contactId:       string;
  deduplicated:    boolean;
}> {
  const {
    clinicId, channelId, externalContactId, contactName,
    externalMessageId, contentType, content, mediaUrl, mediaMetadata,
  } = input;

  return withClinicContext(clinicId, async (client) => {
    // 1. Idempotência
    const existing = await client.query<{ id: string; conversation_id: string }>(
      `SELECT id, conversation_id FROM omni.messages
        WHERE clinic_id = $1 AND external_message_id = $2 LIMIT 1`,
      [clinicId, externalMessageId],
    );
    if (existing.rows[0]) {
      logger.info({ externalMessageId }, 'Inbound message deduped');
      const convResult = await client.query<{ contact_id: string }>(
        'SELECT contact_id FROM omni.conversations WHERE id = $1',
        [existing.rows[0].conversation_id],
      );
      return {
        messageId:      existing.rows[0].id,
        conversationId: existing.rows[0].conversation_id,
        contactId:      convResult.rows[0]?.contact_id ?? '',
        deduplicated:   true,
      };
    }

    // 2. Contato (cria se não existe) — normaliza lookup por phone/email/external_id
    const lookupField =
      input.provider === 'email'    ? 'email'
      : input.provider === 'whatsapp' ? 'phone'
      : 'external_ids';

    let contactId: string;

    if (lookupField === 'phone' || lookupField === 'email') {
      const col = lookupField;
      const found = await client.query<{ id: string }>(
        `SELECT id FROM omni.contacts WHERE clinic_id = $1 AND ${col} = $2 LIMIT 1`,
        [clinicId, externalContactId],
      );
      if (found.rows[0]) {
        contactId = found.rows[0].id;
      } else {
        const created = await client.query<{ id: string }>(
          `INSERT INTO omni.contacts (clinic_id, name, ${col}, type, status, last_contacted_at)
           VALUES ($1, $2, $3, 'lead', 'active', NOW())
           RETURNING id`,
          [clinicId, contactName ?? externalContactId, externalContactId],
        );
        contactId = created.rows[0]!.id;
      }
    } else {
      const key = input.provider === 'instagram' ? 'instagram_id' : 'telegram_id';
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

    // 3. Conversa aberta ou cria nova
    const openConv = await client.query<{ id: string }>(
      `SELECT id FROM omni.conversations
        WHERE clinic_id = $1 AND contact_id = $2 AND channel_id = $3
          AND status IN ('open', 'pending')
        ORDER BY last_message_at DESC NULLS LAST LIMIT 1`,
      [clinicId, contactId, channelId],
    );

    let conversationId: string;
    if (openConv.rows[0]) {
      conversationId = openConv.rows[0].id;
    } else {
      const created = await client.query<{ id: string }>(
        `INSERT INTO omni.conversations
           (clinic_id, contact_id, channel_id, status, priority, last_message_at, last_message_preview, unread_count)
         VALUES ($1, $2, $3, 'open', 'normal', NOW(), $4, 1)
         RETURNING id`,
        [clinicId, contactId, channelId, makePreview(content ?? '[mídia]')],
      );
      conversationId = created.rows[0]!.id;
    }

    // 4. Mensagem
    const msgResult = await client.query<MessageRow>(
      `INSERT INTO omni.messages
         (clinic_id, conversation_id, sender_type, content_type, content, media_url, media_metadata, status, external_message_id, sent_at)
       VALUES ($1, $2, 'patient', $3, $4, $5, $6, 'delivered', $7, NOW())
       RETURNING *`,
      [
        clinicId,
        conversationId,
        contentType,
        content ? sanitizeMessageText(content) : null,
        mediaUrl,
        JSON.stringify(mediaMetadata ?? {}),
        externalMessageId,
      ],
    );
    const messageRow = msgResult.rows[0]!;

    // 5. Atualiza contadores da conversa se já existia
    if (openConv.rows[0]) {
      await client.query(
        `UPDATE omni.conversations
            SET last_message_at      = NOW(),
                last_message_preview = $2,
                unread_count         = unread_count + 1,
                updated_at           = NOW()
          WHERE id = $1`,
        [conversationId, makePreview(content ?? '[mídia]')],
      );
    }

    // 6. Atualiza last_contacted_at do contato
    await client.query(
      `UPDATE omni.contacts SET last_contacted_at = NOW() WHERE id = $1`,
      [contactId],
    );

    return { messageId: messageRow.id, conversationId, contactId, deduplicated: false };
  });
}

/**
 * Emite eventos Socket.io após commit do inbound.
 * Chamado pelo worker fora da transação.
 */
export function emitInboundEvents(params: {
  clinicId:       string;
  conversationId: string;
  messageId:      string;
  preview:        string;
  contactName:    string;
}): void {
  emitToClinic(params.clinicId, 'new_message', {
    conversationId: params.conversationId,
    messageId:      params.messageId,
    sender:         'patient',
    preview:        params.preview,
    contactName:    params.contactName,
    timestamp:      new Date().toISOString(),
  });
}
