import { TRPCError } from '@trpc/server';
import type { PoolClient } from 'pg';
import { withClinicContext, db } from '../../db/client.js';
import { redis } from '../../db/redis.js';
import { logger } from '../../lib/logger.js';
import { automationsQueue, type AutomationJob } from '../../jobs/queues.js';
import type {
  CreateAutomationInput,
  UpdateAutomationInput,
  ListAutomationsInput,
  ListExecutionLogInput,
  AutomationTrigger,
  AutomationCondition,
} from '@dermaos/shared';

/* ── Tipos internos ──────────────────────────────────────────────────────── */

export interface AutomationRow {
  id:            string;
  clinic_id:     string;
  name:          string;
  trigger:       string;
  template_id:   string | null;
  channel_id:    string | null;
  delay_minutes: number;
  conditions:    AutomationCondition[];
  is_active:     boolean;
  run_count:     number;
  last_run_at:   string | null;
  created_at:    string;
  updated_at:    string;
  created_by:    string | null;
  // JOINed
  template_name: string | null;
  channel_name:  string | null;
  channel_type:  string | null;
}

export interface ExecutionLogRow {
  id:              string;
  automation_id:   string;
  idempotency_key: string;
  entity_id:       string;
  entity_type:     string;
  trigger:         string;
  status:          string;
  skip_reason:     string | null;
  fail_reason:     string | null;
  recipient:       string | null;
  channel:         string | null;
  bullmq_job_id:   string | null;
  scheduled_at:    string;
  executed_at:     string | null;
  metadata:        Record<string, unknown>;
  created_at:      string;
}

/* ── Redis key para rastrear jobs pendentes por automação ────────────────── */
const pendingJobsKey = (automationId: string) =>
  `dermaos:auto_jobs:${automationId}`;

/* ── Listagem ────────────────────────────────────────────────────────────── */

export async function listAutomations(
  input:    ListAutomationsInput,
  clinicId: string,
): Promise<{ data: AutomationRow[]; nextCursor: string | null }> {
  return withClinicContext(clinicId, async (client) => {
    const conditions: string[] = ['a.clinic_id = $1'];
    const params: unknown[]    = [clinicId];
    let p = 2;

    if (input.trigger) {
      conditions.push(`a.trigger = $${p++}::omni.automation_trigger`);
      params.push(input.trigger);
    }
    if (input.channel !== undefined) {
      conditions.push(`ch.type::text = $${p++}`);
      params.push(input.channel);
    }
    if (input.isActive !== undefined) {
      conditions.push(`a.is_active = $${p++}`);
      params.push(input.isActive);
    }
    if (input.cursor) {
      conditions.push(`a.created_at < $${p++}`);
      params.push(input.cursor);
    }

    const limit = input.limit + 1;
    params.push(limit);

    const where = conditions.join(' AND ');
    const rows = await client.query<AutomationRow & { last_exec_at: string | null; last_exec_status: string | null }>(
      `SELECT a.id, a.clinic_id, a.name, a.trigger::text AS trigger,
              a.template_id, a.channel_id, a.delay_minutes,
              a.conditions, a.is_active, a.run_count,
              a.last_run_at, a.created_at, a.updated_at, a.created_by,
              t.name AS template_name,
              ch.name AS channel_name,
              ch.type::text AS channel_type,
              el.executed_at::text AS last_exec_at,
              el.status        AS last_exec_status
         FROM omni.automations a
    LEFT JOIN omni.templates t  ON t.id = a.template_id
    LEFT JOIN omni.channels  ch ON ch.id = a.channel_id
    LEFT JOIN LATERAL (
          SELECT status, executed_at
            FROM omni.automation_execution_log
           WHERE automation_id = a.id
        ORDER BY created_at DESC
           LIMIT 1
      ) el ON true
        WHERE ${where}
     ORDER BY a.created_at DESC
        LIMIT $${p}`,
      params,
    );

    const hasMore = rows.rows.length > input.limit;
    const data    = hasMore ? rows.rows.slice(0, input.limit) : rows.rows;
    const nextCursor = hasMore
      ? data[data.length - 1]!.created_at
      : null;

    return { data, nextCursor };
  });
}

export async function getAutomationById(id: string, clinicId: string): Promise<AutomationRow> {
  return withClinicContext(clinicId, async (client) => {
    const r = await client.query<AutomationRow>(
      `SELECT a.id, a.clinic_id, a.name, a.trigger::text AS trigger,
              a.template_id, a.channel_id, a.delay_minutes,
              a.conditions, a.is_active, a.run_count,
              a.last_run_at, a.created_at, a.updated_at, a.created_by,
              t.name AS template_name,
              ch.name AS channel_name, ch.type::text AS channel_type
         FROM omni.automations a
    LEFT JOIN omni.templates t  ON t.id = a.template_id
    LEFT JOIN omni.channels  ch ON ch.id = a.channel_id
        WHERE a.id = $1 AND a.clinic_id = $2
        LIMIT 1`,
      [id, clinicId],
    );
    if (!r.rows[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Automação não encontrada.' });
    }
    return r.rows[0];
  });
}

/* ── Validações auxiliares ────────────────────────────────────────────────── */

async function assertNoDuplicate(
  client:       PoolClient,
  clinicId:     string,
  trigger:      string,
  channelId:    string,
  conditions:   AutomationCondition[],
  excludeId?:   string,
): Promise<void> {
  const condText = JSON.stringify(conditions);
  const r = await client.query<{ id: string }>(
    `SELECT id FROM omni.automations
      WHERE clinic_id  = $1
        AND trigger    = $2::omni.automation_trigger
        AND channel_id = $3
        AND conditions::text = $4
        AND is_active  = TRUE
        AND ($5::uuid IS NULL OR id != $5)
      LIMIT 1`,
    [clinicId, trigger, channelId, condText, excludeId ?? null],
  );
  if (r.rows.length > 0) {
    throw new TRPCError({
      code:    'CONFLICT',
      message: 'Já existe uma automação ativa com o mesmo trigger, canal e condições. Altere as condições ou desative a existente antes de criar outra.',
    });
  }
}

async function assertTemplateCompatibleWithChannel(
  client:     PoolClient,
  clinicId:   string,
  templateId: string,
  channelId:  string,
): Promise<void> {
  const r = await client.query<{ template_channel: string | null; channel_type: string }>(
    `SELECT t.channel_type::text AS template_channel, ch.type::text AS channel_type
       FROM omni.templates t, omni.channels ch
      WHERE t.id = $1 AND t.clinic_id = $2
        AND ch.id = $3 AND ch.clinic_id = $2`,
    [templateId, clinicId, channelId],
  );
  if (!r.rows[0]) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Template ou canal não encontrado.' });
  }
  const { template_channel, channel_type } = r.rows[0];
  if (template_channel && template_channel !== channel_type) {
    throw new TRPCError({
      code:    'BAD_REQUEST',
      message: `Template é para canal "${template_channel}", mas a automação usa canal "${channel_type}". Selecione um template compatível.`,
    });
  }
}

/* ── Criação ─────────────────────────────────────────────────────────────── */

export async function createAutomation(
  input:    CreateAutomationInput,
  clinicId: string,
  userId:   string,
): Promise<AutomationRow> {
  return withClinicContext(clinicId, async (client) => {
    await assertTemplateCompatibleWithChannel(client, clinicId, input.templateId, input.channelId);

    if (input.isActive) {
      await assertNoDuplicate(client, clinicId, input.trigger, input.channelId, input.conditions);
    }

    const r = await client.query<{ id: string }>(
      `INSERT INTO omni.automations
         (clinic_id, name, trigger, template_id, channel_id,
          delay_minutes, conditions, is_active, created_by)
       VALUES ($1, $2, $3::omni.automation_trigger, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        clinicId, input.name, input.trigger, input.templateId, input.channelId,
        input.delayMinutes, JSON.stringify(input.conditions), input.isActive, userId,
      ],
    );

    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'automation', $2, 'automation.created', $3, $4)`,
      [clinicId, r.rows[0]!.id, JSON.stringify({ name: input.name, trigger: input.trigger }), JSON.stringify({ user_id: userId })],
    );

    return getAutomationById(r.rows[0]!.id, clinicId);
  });
}

/* ── Atualização ─────────────────────────────────────────────────────────── */

export async function updateAutomation(
  input:    UpdateAutomationInput,
  clinicId: string,
  userId:   string,
): Promise<AutomationRow> {
  const current = await getAutomationById(input.id, clinicId);

  const newTemplateId   = input.templateId   ?? current.template_id   ?? '';
  const newChannelId    = input.channelId    ?? current.channel_id    ?? '';
  const newConditions   = input.conditions   ?? current.conditions;

  return withClinicContext(clinicId, async (client) => {
    if (input.templateId || input.channelId) {
      await assertTemplateCompatibleWithChannel(client, clinicId, newTemplateId, newChannelId);
    }

    if (current.is_active && (input.channelId || input.conditions)) {
      await assertNoDuplicate(client, clinicId, current.trigger, newChannelId, newConditions, input.id);
    }

    await client.query(
      `UPDATE omni.automations
          SET name          = COALESCE($3, name),
              template_id   = COALESCE($4, template_id),
              channel_id    = COALESCE($5, channel_id),
              delay_minutes = COALESCE($6, delay_minutes),
              conditions    = COALESCE($7, conditions)
        WHERE id = $1 AND clinic_id = $2`,
      [
        input.id, clinicId,
        input.name      ?? null,
        input.templateId ?? null,
        input.channelId  ?? null,
        input.delayMinutes !== undefined ? input.delayMinutes : null,
        input.conditions  ? JSON.stringify(input.conditions) : null,
      ],
    );

    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'automation', $2, 'automation.updated', $3, $4)`,
      [clinicId, input.id, JSON.stringify({ fields: Object.keys(input) }), JSON.stringify({ user_id: userId })],
    );

    return getAutomationById(input.id, clinicId);
  });
}

/* ── Ativar / desativar ──────────────────────────────────────────────────── */

export async function toggleAutomation(
  id:       string,
  isActive: boolean,
  clinicId: string,
  userId:   string,
): Promise<AutomationRow> {
  const current = await getAutomationById(id, clinicId);

  if (current.is_active === isActive) return current;

  if (isActive) {
    // Verifica duplicata antes de reativar
    await withClinicContext(clinicId, async (client) => {
      await assertNoDuplicate(
        client, clinicId, current.trigger,
        current.channel_id!, current.conditions, id,
      );
    });
  }

  await withClinicContext(clinicId, async (client) => {
    await client.query(
      'UPDATE omni.automations SET is_active = $3 WHERE id = $1 AND clinic_id = $2',
      [id, clinicId, isActive],
    );

    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, payload, metadata)
       VALUES ($1, 'automation', $2, $3, $4, $5)`,
      [
        clinicId, id,
        isActive ? 'automation.activated' : 'automation.deactivated',
        '{}', JSON.stringify({ user_id: userId }),
      ],
    );
  });

  // Cancela jobs pendentes no BullMQ ao desativar
  if (!isActive) {
    await cancelPendingJobsForAutomation(id);
  }

  return getAutomationById(id, clinicId);
}

/* ── Exclusão ────────────────────────────────────────────────────────────── */

export async function deleteAutomation(id: string, clinicId: string, userId: string): Promise<void> {
  await getAutomationById(id, clinicId);

  await cancelPendingJobsForAutomation(id);

  await withClinicContext(clinicId, async (client) => {
    await client.query(
      'DELETE FROM omni.automations WHERE id = $1 AND clinic_id = $2',
      [id, clinicId],
    );
    await db.query(
      `INSERT INTO audit.domain_events (clinic_id, aggregate_type, aggregate_id, event_type, metadata)
       VALUES ($1, 'automation', $2, 'automation.deleted', $3)`,
      [clinicId, id, JSON.stringify({ user_id: userId })],
    );
  });
}

/* ── Log de execuções ────────────────────────────────────────────────────── */

export async function listExecutionLog(
  input:    ListExecutionLogInput,
  clinicId: string,
): Promise<{ data: ExecutionLogRow[]; nextCursor: string | null }> {
  return withClinicContext(clinicId, async (client) => {
    const conds: string[] = ['clinic_id = $1', 'automation_id = $2'];
    const params: unknown[] = [clinicId, input.automationId];
    let p = 3;

    if (input.status) {
      conds.push(`status = $${p++}`);
      params.push(input.status);
    }
    if (input.cursor) {
      conds.push(`created_at < $${p++}`);
      params.push(input.cursor);
    }

    const limit = input.limit + 1;
    params.push(limit);

    const r = await client.query<ExecutionLogRow>(
      `SELECT id, automation_id, idempotency_key, entity_id, entity_type,
              trigger::text AS trigger, status, skip_reason, fail_reason,
              recipient, channel::text AS channel, bullmq_job_id,
              scheduled_at, executed_at, metadata, created_at
         FROM omni.automation_execution_log
        WHERE ${conds.join(' AND ')}
     ORDER BY created_at DESC
        LIMIT $${p}`,
      params,
    );

    const hasMore = r.rows.length > input.limit;
    const data    = hasMore ? r.rows.slice(0, input.limit) : r.rows;
    return { data, nextCursor: hasMore ? data[data.length - 1]!.created_at : null };
  });
}

/* ── Enfileiramento de jobs ──────────────────────────────────────────────── */

export interface EnqueueParams {
  trigger:     AutomationTrigger;
  entityId:    string;
  entityType:  string;
  clinicId:    string;
  fireAt:      Date;
  metadata?:   Record<string, unknown>;
}

/**
 * Busca todas as automações ativas para o trigger nesta clínica e enfileira
 * um job BullMQ para cada uma — com idempotência garantida via:
 *   1. chave única na tabela automation_execution_log
 *   2. jobId fixo no BullMQ (impede duplicata enquanto job está pendente)
 *
 * Chamar de outros módulos (scheduling, clinical, financial) quando seus
 * eventos ocorrerem.
 */
export async function enqueueAutomationsForTrigger(params: EnqueueParams): Promise<void> {
  const { trigger, entityId, entityType, clinicId, fireAt, metadata = {} } = params;

  // Validação rápida: só enfileira se fireAt é no futuro (ou agora)
  const nowMs = Date.now();
  if (fireAt.getTime() < nowMs - 60_000) {
    // Mais de 1 min no passado — data de disparo já passou, não faz sentido enfileirar
    logger.warn({ trigger, entityId, clinicId, fireAt }, 'automation: fireAt is in the past, skipping');
    return;
  }

  // Busca automações ativas para o trigger
  const result = await withClinicContext(clinicId, async (client) => {
    return client.query<{ id: string; delay_minutes: number }>(
      `SELECT id, delay_minutes FROM omni.automations
        WHERE clinic_id = $1 AND trigger = $2::omni.automation_trigger AND is_active = TRUE`,
      [clinicId, trigger],
    );
  });

  if (result.rows.length === 0) return;

  const dateStr = fireAt.toISOString().slice(0, 10);

  for (const auto of result.rows) {
    const fireWithDelay = new Date(fireAt.getTime() + auto.delay_minutes * 60_000);
    const delayMs = Math.max(0, fireWithDelay.getTime() - nowMs);

    // Chave de idempotência: inclui automationId para separar automações distintas
    const idempotencyKey = `${trigger}:${auto.id}:${entityId}:${dateStr}`;
    const jobId          = `auto:${idempotencyKey}`;

    // Tenta inserir o log com status 'processing' — falha silenciosa em duplicata
    try {
      await db.query(
        `INSERT INTO omni.automation_execution_log
           (clinic_id, automation_id, idempotency_key, entity_id, entity_type,
            trigger, status, bullmq_job_id, scheduled_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::omni.automation_trigger, 'processing', $7, $8, $9)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          clinicId, auto.id, idempotencyKey, entityId, entityType,
          trigger, jobId, fireWithDelay.toISOString(), JSON.stringify(metadata),
        ],
      );
    } catch (err) {
      logger.error({ err, idempotencyKey }, 'automation: failed to insert execution log');
      continue;
    }

    // Verifica se o INSERT ocorreu (pode ter sido ignorado por ON CONFLICT)
    const check = await db.query<{ id: string }>(
      `SELECT id FROM omni.automation_execution_log
        WHERE idempotency_key = $1 AND status = 'processing'
        LIMIT 1`,
      [idempotencyKey],
    );
    if (!check.rows[0]) {
      logger.debug({ idempotencyKey }, 'automation: idempotency hit, skipping enqueue');
      continue;
    }

    const executionLogId = check.rows[0].id;

    const jobPayload: AutomationJob = {
      executionLogId,
      automationId: auto.id,
      clinicId,
      trigger,
      entityId,
      entityType,
      fireAt: fireWithDelay.toISOString(),
    };

    try {
      const job = await automationsQueue.add('process', jobPayload, {
        jobId,
        delay: delayMs,
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
      });

      // Rastreia no Redis para permitir cancelamento eficiente
      await redis.sadd(pendingJobsKey(auto.id), jobId);

      logger.info(
        { jobId: job.id, automationId: auto.id, trigger, delayMs },
        'automation: job enqueued',
      );
    } catch (err) {
      // Provavelmente jobId duplicado no BullMQ — idempotente, não é erro grave
      logger.warn({ err, jobId, automationId: auto.id }, 'automation: job add failed (possible duplicate)');
    }
  }
}

/* ── Cancelamento de jobs pendentes ─────────────────────────────────────── */

export async function cancelPendingJobsForAutomation(automationId: string): Promise<void> {
  const key     = pendingJobsKey(automationId);
  const jobIds  = await redis.smembers(key);

  if (jobIds.length === 0) return;

  let cancelled = 0;
  for (const jobId of jobIds) {
    try {
      const removed = await automationsQueue.remove(jobId);
      if (removed) cancelled++;
    } catch {
      // Job pode já ter sido processado ou não existir
    }
  }

  await redis.del(key);
  logger.info({ automationId, cancelled, total: jobIds.length }, 'automation: pending jobs cancelled');
}

/* ── Atualizar status no log de execução (chamado pelo worker) ────────────── */

export async function updateExecutionStatus(
  executionLogId: string,
  status:         'sent' | 'skipped' | 'failed',
  details: {
    skipReason?:  string;
    failReason?:  string;
    recipient?:   string;
    channel?:     string;
  } = {},
): Promise<void> {
  await db.query(
    `UPDATE omni.automation_execution_log
        SET status      = $2,
            skip_reason = $3,
            fail_reason = $4,
            recipient   = COALESCE($5, recipient),
            channel     = COALESCE($6::omni.channel_type, channel),
            executed_at = NOW()
      WHERE id = $1`,
    [
      executionLogId, status,
      details.skipReason ?? null,
      details.failReason ?? null,
      details.recipient  ?? null,
      details.channel    ?? null,
    ],
  );

  // Incrementa run_count e atualiza last_run_at na automação quando sent
  if (status === 'sent') {
    await db.query(
      `UPDATE omni.automations
          SET run_count  = run_count + 1,
              last_run_at = NOW()
        WHERE id = (
          SELECT automation_id FROM omni.automation_execution_log WHERE id = $1
        )`,
      [executionLogId],
    );
  }
}
