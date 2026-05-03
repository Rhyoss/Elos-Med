/**
 * Processor `aurora-reasoning` — Anexo A §A.4.2 passo 8.
 *
 * Consome `auroraReasoningQueue` (BullMQ). Para cada job:
 *   1. Idempotência — se já existe uma mensagem `ai_agent` com
 *      `metadata.in_reply_to = messageId`, descarta (job repetido após retry).
 *   2. Rate limit — 30 req/min por `clinicId` via Redis token bucket.
 *      Em estouro: marca `throttled=true` → `AuroraService` devolve B.3.9.
 *   3. Monta `AuroraMessageVars` (clinic.name) a partir de `shared.clinics`.
 *   4. Chama `AuroraService.handleMessage(input, { reason: buildAuroraReasoner(...) })`.
 *   5. Enfileira `omniOutboundQueue` com o ID da mensagem persistida pela Aurora
 *      (tag `aurora_state.handler='aurora'` já está na conversa).
 *
 * Fila: jobId='aurora:'+messageId (idempotente no nível do enqueue).
 */

import type { Job } from 'bullmq';
import { Queue } from 'bullmq';
import type { Pool } from 'pg';
import type Redis from 'ioredis';
import type pino from 'pino';
import { handleMessage } from '../../../api/src/modules/aurora/aurora.service.js';
import { buildAuroraReasoner } from '../../../api/src/modules/aurora/llm/index.js';
import { consumeAuroraToken } from '../../../api/src/modules/aurora/llm/rate-limit.js';
import type { AuroraMessageVars } from '../../../api/src/modules/aurora/messages.js';

interface AuroraReasoningJobData {
  messageId:      string;
  clinicId:       string;
  conversationId: string;
}

export interface AuroraReasoningDeps {
  db:                  Pool;
  redis:               Redis;
  logger:              pino.Logger;
  outboundQueue:       Queue;
  anthropicApiKey:     string | null;
  ollamaBaseUrl:       string;
  /** ID sintético da Aurora em `shared.users` (role='ai_agent'). */
  auroraUserId:        string;
}

/**
 * Busca o nome da clínica — usado no system prompt e nas mensagens B.3.x.
 * Se não encontrado, devolve string vazia (templates mostram `{{clinic.name}}` literal).
 */
async function loadClinicVars(
  db:       Pool,
  clinicId: string,
): Promise<AuroraMessageVars> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_clinic_id', $1, true)", [clinicId]);
    const r = await client.query<{ name: string; address: string | null }>(
      `SELECT name, address FROM shared.clinics WHERE id = $1`,
      [clinicId],
    );
    await client.query('COMMIT');
    const row = r.rows[0];
    const vars: AuroraMessageVars = {};
    if (row?.name)    vars['clinic.name']     = row.name;
    if (row?.address) vars['clinic.endereco'] = row.address;
    return vars;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Verifica se já respondemos a esta mensagem (idempotência).
 * Busca em omni.messages por `metadata->>'in_reply_to' = messageId`.
 */
async function alreadyAnswered(
  db:        Pool,
  clinicId:  string,
  messageId: string,
): Promise<boolean> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_clinic_id', $1, true)", [clinicId]);
    const r = await client.query<{ id: string }>(
      `SELECT id FROM omni.messages
        WHERE clinic_id = $1
          AND sender_type = 'ai_agent'
          AND metadata ->> 'in_reply_to' = $2
        LIMIT 1`,
      [clinicId, messageId],
    );
    await client.query('COMMIT');
    return r.rows.length > 0;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export function buildAuroraReasoningProcessor(deps: AuroraReasoningDeps) {
  const reason = deps.anthropicApiKey
    ? buildAuroraReasoner({
        anthropic: { apiKey: deps.anthropicApiKey },
        ollama:    { baseUrl: deps.ollamaBaseUrl },
      })
    : undefined;

  if (!reason) {
    deps.logger.warn('ANTHROPIC_API_KEY missing — aurora-reasoning will fallback deterministically');
  }

  return async function process(job: Job<AuroraReasoningJobData>): Promise<void> {
    const { messageId, clinicId, conversationId } = job.data;

    // 1. Idempotência.
    if (await alreadyAnswered(deps.db, clinicId, messageId)) {
      deps.logger.debug(
        { jobId: job.id, messageId },
        'aurora-reasoning: message already answered, skipping',
      );
      return;
    }

    // 2. Rate limit.
    const rate = await consumeAuroraToken(deps.redis, clinicId);
    const throttled = !rate.allowed;
    if (throttled) {
      deps.logger.warn(
        { clinicId, resetAt: rate.resetAt },
        'aurora-reasoning: rate limit exceeded — responding with B.3.9',
      );
    }

    // 3. Vars para o prompt e mensagens B.3.x.
    const auroraVars = await loadClinicVars(deps.db, clinicId);

    // 4. Pipeline.
    const result = await handleMessage(
      {
        messageId,
        clinicId,
        conversationId,
        auroraUserId: deps.auroraUserId,
      },
      {
        auroraVars,
        ...(throttled ? { throttled: true } : {}),
        ...(reason ? { reason } : {}),
      },
    );

    deps.logger.info(
      {
        jobId:           job.id,
        messageId,
        conversationId,
        intent:          result.intent,
        status:          result.status,
        guardrailHit:    result.guardrailHit,
        transferred:     result.transferredToHuman,
        latencyMs:       result.latencyMs,
      },
      'aurora-reasoning processed',
    );

    // 5. Enfileira envio da mensagem gerada (se houve uma).
    if (result.assistantMessageId) {
      await deps.outboundQueue.add(
        'send',
        {
          messageId:      result.assistantMessageId,
          clinicId,
          conversationId,
        },
        {
          jobId:     `out:${result.assistantMessageId}`,
          attempts:  3,
          backoff:   { type: 'exponential', delay: 2_000 },
        },
      );
    }
  };
}
