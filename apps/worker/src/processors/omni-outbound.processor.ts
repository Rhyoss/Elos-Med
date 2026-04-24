/**
 * Processor `omni-outbound` — Anexo A §A.4.2 passo 9.
 *
 * Consome `omniOutboundQueue`. Envia a mensagem persistida em `omni.messages`
 * ao provedor externo. Atualmente suportamos WhatsApp via Meta Graph API v20.0.
 *
 * Pipeline:
 *   1. Carrega mensagem, conversa, contato, canal.
 *   2. Se `status` já for `sent`/`delivered`/`read` ou `failed` → idempotente,
 *      descarta.
 *   3. POST `https://graph.facebook.com/v20.0/{phoneNumberId}/messages`
 *      Headers: Authorization: Bearer <token>
 *      Body:    { messaging_product:'whatsapp', to, type:'text', text:{body} }
 *   4. Sucesso → UPDATE status='sent', sent_at=NOW(), external_message_id=<wamid>.
 *      Erro    → UPDATE status='failed', failed_at=NOW(); BullMQ recupera até 3x.
 *
 * Circuit breaker `whatsapp_graph_api` com timeout 10s.
 *
 * Observações:
 *   - Secretos (access_token) nunca logados — fluxo pino redacts configurado
 *     no nível do logger.
 *   - `channel.config` espera shape:
 *       { phone_number_id: string, access_token: string }
 *     Se faltar qualquer campo, marcamos como `failed` com razão e NÃO
 *     re-enfileiramos (falha de configuração, não transiente).
 */

import type { Job } from 'bullmq';
import type { Pool, PoolClient } from 'pg';
import type pino from 'pino';
import { runWithBreaker } from '../../../api/src/lib/circuit-breaker.js';

export const WHATSAPP_BREAKER_NAME = 'whatsapp_graph_api';
export const WHATSAPP_TIMEOUT_MS = 10_000;
export const GRAPH_API_BASE = 'https://graph.facebook.com/v20.0';

interface OmniOutboundJobData {
  messageId:      string;
  clinicId:       string;
  conversationId: string;
}

interface OutboundMessage {
  id:             string;
  conversation_id: string;
  content:        string | null;
  status:         string;
  content_type:   string;
  contact_phone:  string | null;
  channel_type:   string;
  channel_config: Record<string, unknown>;
}

export interface OmniOutboundDeps {
  db:        Pool;
  logger:    pino.Logger;
  /** fetch injetável (testes). */
  fetchImpl?: typeof fetch;
}

async function withClinicTx<T>(
  db:       Pool,
  clinicId: string,
  cb:       (c: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL app.current_clinic_id = $1', [clinicId]);
    const out = await cb(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function loadMessage(
  db:        Pool,
  clinicId:  string,
  messageId: string,
): Promise<OutboundMessage | null> {
  return withClinicTx(db, clinicId, async (client) => {
    const r = await client.query<OutboundMessage>(
      `SELECT m.id, m.conversation_id, m.content, m.status::text AS status,
              m.content_type::text AS content_type,
              ct.phone AS contact_phone,
              ch.type::text AS channel_type,
              ch.config AS channel_config
         FROM omni.messages       m
         JOIN omni.conversations  cv ON cv.id = m.conversation_id
         JOIN omni.contacts       ct ON ct.id = cv.contact_id
         JOIN omni.channels       ch ON ch.id = cv.channel_id
        WHERE m.id = $1 AND m.clinic_id = $2
        LIMIT 1`,
      [messageId, clinicId],
    );
    return r.rows[0] ?? null;
  });
}

async function markSent(
  db:          Pool,
  clinicId:    string,
  messageId:   string,
  externalId:  string,
): Promise<void> {
  await withClinicTx(db, clinicId, async (client) => {
    await client.query(
      `UPDATE omni.messages
          SET status              = 'sent',
              sent_at             = NOW(),
              external_message_id = $3
        WHERE id = $1 AND clinic_id = $2`,
      [messageId, clinicId, externalId],
    );
  });
}

async function markFailed(
  db:        Pool,
  clinicId:  string,
  messageId: string,
  reason:    string,
): Promise<void> {
  await withClinicTx(db, clinicId, async (client) => {
    await client.query(
      `UPDATE omni.messages
          SET status     = 'failed',
              failed_at  = NOW(),
              metadata   = COALESCE(metadata, '{}'::jsonb)
                           || jsonb_build_object('send_error', $3::text)
        WHERE id = $1 AND clinic_id = $2`,
      [messageId, clinicId, reason],
    );
  });
}

interface GraphApiTextResponse {
  messages?: Array<{ id: string }>;
  error?:    { message?: string; code?: number };
}

async function sendWhatsAppText(
  fetchImpl:     typeof fetch,
  phoneNumberId: string,
  accessToken:   string,
  to:            string,
  body:          string,
): Promise<string> {
  const result = await runWithBreaker(
    async (args: { url: string; token: string; to: string; body: string }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WHATSAPP_TIMEOUT_MS);
      try {
        const res = await fetchImpl(args.url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${args.token}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to:                args.to,
            type:              'text',
            text:              { body: args.body },
          }),
          signal: controller.signal,
        });
        const json = (await res.json()) as GraphApiTextResponse;
        if (!res.ok) {
          throw new Error(
            `graph_http_${res.status}: ${json.error?.message ?? 'unknown error'}`,
          );
        }
        return json;
      } finally {
        clearTimeout(timeout);
      }
    },
    { name: WHATSAPP_BREAKER_NAME, timeout: WHATSAPP_TIMEOUT_MS + 1_000 },
    {
      url:   `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
      token: accessToken,
      to,
      body,
    },
  );

  const externalId = result.messages?.[0]?.id;
  if (!externalId) {
    throw new Error('graph_api_missing_message_id');
  }
  return externalId;
}

function stringField(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function buildOmniOutboundProcessor(deps: OmniOutboundDeps) {
  const fetchImpl = deps.fetchImpl ?? fetch;

  return async function process(job: Job<OmniOutboundJobData>): Promise<void> {
    const { messageId, clinicId } = job.data;

    const msg = await loadMessage(deps.db, clinicId, messageId);
    if (!msg) {
      deps.logger.warn({ jobId: job.id, messageId }, 'outbound: message not found');
      return;
    }

    // Idempotência — status já terminal.
    if (['sent', 'delivered', 'read', 'failed'].includes(msg.status)) {
      deps.logger.debug(
        { jobId: job.id, messageId, status: msg.status },
        'outbound: already terminal status, skipping',
      );
      return;
    }

    if (msg.content_type !== 'text' || !msg.content) {
      await markFailed(deps.db, clinicId, messageId, 'unsupported_content');
      deps.logger.warn(
        { jobId: job.id, messageId, contentType: msg.content_type },
        'outbound: non-text or empty content — marked failed',
      );
      return;
    }

    if (msg.channel_type !== 'whatsapp') {
      await markFailed(deps.db, clinicId, messageId, `unsupported_channel:${msg.channel_type}`);
      deps.logger.warn(
        { jobId: job.id, messageId, channelType: msg.channel_type },
        'outbound: channel not supported yet — marked failed',
      );
      return;
    }

    const phoneNumberId = stringField(msg.channel_config, 'phone_number_id');
    const accessToken   = stringField(msg.channel_config, 'access_token');
    if (!phoneNumberId || !accessToken) {
      await markFailed(deps.db, clinicId, messageId, 'channel_config_incomplete');
      deps.logger.error(
        { jobId: job.id, messageId, hasPhoneId: !!phoneNumberId, hasToken: !!accessToken },
        'outbound: channel config missing fields — marked failed, no retry',
      );
      return;
    }

    if (!msg.contact_phone) {
      await markFailed(deps.db, clinicId, messageId, 'contact_phone_missing');
      deps.logger.error({ jobId: job.id, messageId }, 'outbound: contact has no phone');
      return;
    }

    try {
      const externalId = await sendWhatsAppText(
        fetchImpl,
        phoneNumberId,
        accessToken,
        msg.contact_phone,
        msg.content,
      );
      await markSent(deps.db, clinicId, messageId, externalId);
      deps.logger.info(
        { jobId: job.id, messageId, externalId },
        'outbound: whatsapp message sent',
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown_error';
      deps.logger.warn({ jobId: job.id, messageId, err }, 'outbound: send failed');
      await markFailed(deps.db, clinicId, messageId, reason);
      // Re-throw para BullMQ retentar conforme backoff.
      throw err;
    }
  };
}
