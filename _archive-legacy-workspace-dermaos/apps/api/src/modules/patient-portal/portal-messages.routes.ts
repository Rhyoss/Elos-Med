import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { db } from '../../db/client.js';
import { minio } from '../../lib/minio.js';
import { verifyPortalToken, assertOwnership } from './portal-middleware.js';
import { portalCreateMessageSchema, portalReplySchema } from './portal.schemas.js';

const MESSAGES_PER_HOUR = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic'];

// Magic bytes para MIME validation real (não confiar no Content-Type)
const MAGIC_BYTES: Array<{ mime: string; hex: string }> = [
  { mime: 'image/jpeg', hex: 'ffd8ff' },
  { mime: 'image/png',  hex: '89504e47' },
  { mime: 'image/heic', hex: '00000018' }, // ftyp box (simplificado)
];

function detectMimeByMagicBytes(buf: Buffer): string | null {
  for (const { mime, hex } of MAGIC_BYTES) {
    const prefix = hex.length / 2;
    if (buf.subarray(0, prefix).toString('hex').startsWith(hex)) {
      return mime;
    }
  }
  return null;
}

export async function registerPortalMessageRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /portal/messages ──────────────────────────────────────────────────────
  // Lista conversas do paciente com a clínica
  app.get('/messages', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const { id: patientId } = req.portalPatient;

    const r = await db.query<{
      id: string; subject: string | null; status: string;
      last_message_at: string; unread_count: number;
    }>(
      `SELECT c.id,
              c.subject,
              c.status,
              c.last_message_at,
              COUNT(m.id) FILTER (WHERE m.read_at IS NULL AND m.direction = 'inbound') AS unread_count
       FROM omni.conversations c
       LEFT JOIN omni.messages  m ON m.conversation_id = c.id
       WHERE c.portal_patient_id = $1
       GROUP BY c.id
       ORDER BY c.last_message_at DESC NULLS LAST`,
      [patientId],
    );

    return reply.send({ conversations: r.rows });
  });

  // ── GET /portal/messages/:id ──────────────────────────────────────────────────
  app.get('/messages/:id', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const { id: conversationId } = req.params as { id: string };
    const { id: patientId } = req.portalPatient;

    // Verificar ownership da conversa
    const convResult = await db.query<{ portal_patient_id: string }>(
      'SELECT portal_patient_id FROM omni.conversations WHERE id = $1',
      [conversationId],
    );

    if (!convResult.rows[0]) {
      return reply.status(403).send({ error: 'Acesso não autorizado.' });
    }

    if (!assertOwnership(reply, convResult.rows[0].portal_patient_id, patientId)) return;

    const messagesResult = await db.query<{
      id: string; body: string; direction: string; created_at: string;
      attachments: unknown;
    }>(
      `SELECT id, body, direction, created_at, attachments
       FROM omni.messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId],
    );

    // Marcar mensagens recebidas como lidas
    await db.query(
      `UPDATE omni.messages
       SET read_at = NOW()
       WHERE conversation_id = $1
         AND direction = 'inbound'
         AND read_at IS NULL`,
      [conversationId],
    );

    return reply.send({
      messages: messagesResult.rows.map((m) => ({
        id:          m.id,
        body:        m.body,
        direction:   m.direction,
        createdAt:   m.created_at,
        attachments: m.attachments,
      })),
    });
  });

  // ── POST /portal/messages ─────────────────────────────────────────────────────
  // Nova conversa com a clínica
  app.post('/messages', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const parsed = portalCreateMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
      });
    }

    const { body, subject } = parsed.data;
    const { id: patientId, clinicId } = req.portalPatient;

    // Rate limit: máximo 5 mensagens por hora por paciente
    if (!(await checkMessageRateLimit(patientId))) {
      return reply.status(429).send({
        error: 'Limite de mensagens atingido. Tente novamente em uma hora.',
      });
    }

    // Criar conversa + primeira mensagem em transação
    const client = await (db as any).connect();
    try {
      await client.query('BEGIN');

      const convResult = await client.query<{ id: string }>(
        `INSERT INTO omni.conversations
           (clinic_id, channel, status, subject, portal_patient_id, last_message_at)
         VALUES ($1, 'portal', 'open', $2, $3, NOW())
         RETURNING id`,
        [clinicId, subject ?? null, patientId],
      );

      const convId = convResult.rows[0]!.id;

      await client.query(
        `INSERT INTO omni.messages (conversation_id, direction, body, channel)
         VALUES ($1, 'outbound', $2, 'portal')`,
        [convId, body],
      );

      await client.query('COMMIT');

      return reply.status(201).send({ conversationId: convId });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ── POST /portal/messages/:id/reply ──────────────────────────────────────────
  app.post('/messages/:id/reply', { preHandler: [verifyPortalToken] }, async (req, reply) => {
    const { id: conversationId } = req.params as { id: string };
    const parsed = portalReplySchema.safeParse(req.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos.' });
    }

    const { id: patientId } = req.portalPatient;

    // Verificar ownership
    const convResult = await db.query<{ portal_patient_id: string; status: string }>(
      'SELECT portal_patient_id, status FROM omni.conversations WHERE id = $1',
      [conversationId],
    );

    if (!convResult.rows[0]) {
      return reply.status(403).send({ error: 'Acesso não autorizado.' });
    }

    if (!assertOwnership(reply, convResult.rows[0].portal_patient_id, patientId)) return;

    if (convResult.rows[0].status === 'closed') {
      return reply.status(400).send({ error: 'Esta conversa está encerrada.' });
    }

    // Rate limit
    if (!(await checkMessageRateLimit(patientId))) {
      return reply.status(429).send({
        error: 'Limite de mensagens atingido. Tente novamente em uma hora.',
      });
    }

    await db.query(
      `INSERT INTO omni.messages (conversation_id, direction, body, channel)
       VALUES ($1, 'outbound', $2, 'portal')`,
      [conversationId, parsed.data.body],
    );

    await db.query(
      'UPDATE omni.conversations SET last_message_at = NOW() WHERE id = $1',
      [conversationId],
    );

    return reply.status(201).send({ ok: true });
  });
}

// ─── Rate limiting de mensagens por paciente (Redis) ─────────────────────────

import { redis } from '../../db/redis.js';

async function checkMessageRateLimit(patientId: string): Promise<boolean> {
  const key = `portal:msg:${patientId}:${Math.floor(Date.now() / 3_600_000)}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 3600);
  return count <= MESSAGES_PER_HOUR;
}
