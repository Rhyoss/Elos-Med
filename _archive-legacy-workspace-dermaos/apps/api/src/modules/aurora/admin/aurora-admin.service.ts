/**
 * Aurora Admin Service — painel de gestão (Fase 4).
 *
 * Responsável por CRUD de agentes, knowledge base, métricas e simulações.
 * Toda query passa por `withClinicContext` (RLS). Nada aqui envia mensagens
 * — apenas configuração + leitura de auditoria + simulações descartáveis.
 *
 * Referências:
 *   - Anexo A §A.1.2 — modelos
 *   - Prompt Fase 4  — §1.1–§1.4
 */

import { TRPCError } from '@trpc/server';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { withClinicContext } from '../../../db/client.js';
import { logger } from '../../../lib/logger.js';
import type {
  AiAgentSummary,
  AiAgentDetail,
  AiAgentConfig,
  AiAgentTool,
  AiAgentType,
  AiAgentModel,
  AgentMetrics,
  AgentMetricsTimeline,
  AuroraIntent,
  CreateAgentInput,
  EmbeddingStatus,
  EscalationRule,
  EscalationTestResult,
  KnowledgeItem,
  MetricsPeriod,
  OperatingHours,
  PreviewAgentInput,
  UpdateAgentInput,
} from '@dermaos/shared';
import { classifyIntent } from '../intent/intent-classifier.js';
import { detectSentiment } from './sentiment.js';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function toConfig(raw: unknown): AiAgentConfig {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rules = Array.isArray(obj['escalation_rules'])
    ? (obj['escalation_rules'] as EscalationRule[])
    : [];
  return {
    escalation_rules: rules,
    operating_hours:  (obj['operating_hours'] as OperatingHours | undefined) ?? {},
    ...(typeof obj['sla_minutes'] === 'number' ? { sla_minutes: obj['sla_minutes'] as number } : {}),
  };
}

interface AgentRow {
  id:             string;
  name:           string;
  type:           AiAgentType;
  model:          AiAgentModel;
  is_active:      boolean;
  system_prompt:  string | null;
  temperature:    string | number;
  max_tokens:     number;
  tools_enabled:  AiAgentTool[];
  config:         Record<string, unknown>;
  created_at:     Date | string;
  deleted_at:     Date | string | null;
}

function mapSummary(
  row: AgentRow,
  channelIds: string[],
  lastActivityAt: Date | null,
): AiAgentSummary {
  return {
    id:             row.id,
    name:           row.name,
    type:           row.type,
    model:          row.model,
    isActive:       row.is_active,
    channelIds,
    lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
    createdAt:      row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString(),
  };
}

function mapDetail(
  row: AgentRow,
  channelIds: string[],
  lastActivityAt: Date | null,
): AiAgentDetail {
  return {
    ...mapSummary(row, channelIds, lastActivityAt),
    systemPrompt: row.system_prompt,
    temperature:  typeof row.temperature === 'string' ? Number(row.temperature) : row.temperature,
    maxTokens:    row.max_tokens,
    toolsEnabled: row.tools_enabled,
    config:       toConfig(row.config),
  };
}

/* ── Agents: list / get ──────────────────────────────────────────────────── */

export async function listAgents(clinicId: string): Promise<AiAgentSummary[]> {
  return withClinicContext(clinicId, async (c) => {
    const agents = await c.query<AgentRow>(
      `SELECT id, name, type, model, is_active, system_prompt, temperature, max_tokens,
              tools_enabled, config, created_at, deleted_at
         FROM omni.ai_agents
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC`,
    );

    if (agents.rows.length === 0) return [];

    const ids = agents.rows.map((r) => r.id);
    const channelsRes = await c.query<{ ai_agent_id: string; id: string }>(
      `SELECT ai_agent_id, id FROM omni.channels WHERE ai_agent_id = ANY($1::uuid[])`,
      [ids],
    );
    const channelsByAgent = new Map<string, string[]>();
    for (const row of channelsRes.rows) {
      const arr = channelsByAgent.get(row.ai_agent_id) ?? [];
      arr.push(row.id);
      channelsByAgent.set(row.ai_agent_id, arr);
    }

    // Última atividade por agente = última mensagem do agente nas suas conversas.
    const activityRes = await c.query<{ agent_id: string; last_at: Date }>(
      `SELECT sender_agent_id AS agent_id, MAX(created_at) AS last_at
         FROM omni.messages
        WHERE sender_agent_id = ANY($1::uuid[])
        GROUP BY sender_agent_id`,
      [ids],
    );
    const lastByAgent = new Map<string, Date>();
    for (const row of activityRes.rows) {
      lastByAgent.set(row.agent_id, row.last_at);
    }

    return agents.rows.map((row) =>
      mapSummary(row, channelsByAgent.get(row.id) ?? [], lastByAgent.get(row.id) ?? null),
    );
  });
}

async function loadAgentRow(c: PoolClient, id: string): Promise<AgentRow | null> {
  const r = await c.query<AgentRow>(
    `SELECT id, name, type, model, is_active, system_prompt, temperature, max_tokens,
            tools_enabled, config, created_at, deleted_at
       FROM omni.ai_agents
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1`,
    [id],
  );
  return r.rows[0] ?? null;
}

async function loadAgentChannels(c: PoolClient, agentId: string): Promise<string[]> {
  const r = await c.query<{ id: string }>(
    `SELECT id FROM omni.channels WHERE ai_agent_id = $1`,
    [agentId],
  );
  return r.rows.map((x) => x.id);
}

async function loadLastActivity(c: PoolClient, agentId: string): Promise<Date | null> {
  const r = await c.query<{ last_at: Date | null }>(
    `SELECT MAX(created_at) AS last_at FROM omni.messages WHERE sender_agent_id = $1`,
    [agentId],
  );
  return r.rows[0]?.last_at ?? null;
}

export async function getAgent(clinicId: string, id: string): Promise<AiAgentDetail> {
  return withClinicContext(clinicId, async (c) => {
    const row = await loadAgentRow(c, id);
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Agente não encontrado.' });
    }
    const [channelIds, lastActivity] = await Promise.all([
      loadAgentChannels(c, id),
      loadLastActivity(c, id),
    ]);
    return mapDetail(row, channelIds, lastActivity);
  });
}

/* ── Agents: create / update ────────────────────────────────────────────── */

export async function createAgent(
  clinicId: string,
  userId: string,
  input: CreateAgentInput,
): Promise<AiAgentDetail> {
  return withClinicContext(clinicId, async (c) => {
    const config: AiAgentConfig = input.config ?? { escalation_rules: [], operating_hours: {} };
    const r = await c.query<AgentRow>(
      `INSERT INTO omni.ai_agents
         (clinic_id, type, name, is_active, model, system_prompt, temperature, max_tokens,
          tools_enabled, config, created_by)
       VALUES ($1, $2, $3, FALSE, $4, $5, $6, $7, $8, $9::jsonb, $10)
       RETURNING id, name, type, model, is_active, system_prompt, temperature, max_tokens,
                 tools_enabled, config, created_at, deleted_at`,
      [
        clinicId,
        input.type,
        input.name,
        input.model,
        input.systemPrompt ?? null,
        input.temperature,
        input.maxTokens,
        input.toolsEnabled,
        JSON.stringify(config),
        userId,
      ],
    );
    const row = r.rows[0]!;
    return mapDetail(row, [], null);
  });
}

export async function updateAgent(
  clinicId: string,
  input: UpdateAgentInput,
): Promise<AiAgentDetail> {
  return withClinicContext(clinicId, async (c) => {
    const existing = await loadAgentRow(c, input.id);
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Agente não encontrado.' });
    }

    const sets: string[] = [];
    const vals: unknown[] = [];

    if (input.name !== undefined)        { vals.push(input.name);        sets.push(`name = $${vals.length}`); }
    if (input.type !== undefined)        { vals.push(input.type);        sets.push(`type = $${vals.length}`); }
    if (input.model !== undefined)       { vals.push(input.model);       sets.push(`model = $${vals.length}`); }
    if (input.systemPrompt !== undefined){ vals.push(input.systemPrompt);sets.push(`system_prompt = $${vals.length}`); }
    if (input.temperature !== undefined) { vals.push(input.temperature); sets.push(`temperature = $${vals.length}`); }
    if (input.maxTokens !== undefined)   { vals.push(input.maxTokens);   sets.push(`max_tokens = $${vals.length}`); }
    if (input.toolsEnabled !== undefined){ vals.push(input.toolsEnabled);sets.push(`tools_enabled = $${vals.length}`); }
    if (input.config !== undefined)      { vals.push(JSON.stringify(input.config)); sets.push(`config = $${vals.length}::jsonb`); }

    if (sets.length === 0) {
      return getAgent(clinicId, input.id);
    }

    vals.push(input.id);
    await c.query(
      `UPDATE omni.ai_agents SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`,
      vals,
    );
    const [row, channelIds, lastActivity] = await Promise.all([
      loadAgentRow(c, input.id),
      loadAgentChannels(c, input.id),
      loadLastActivity(c, input.id),
    ]);
    return mapDetail(row!, channelIds, lastActivity);
  });
}

/* ── Agents: toggle ──────────────────────────────────────────────────────── */

/** Retorna `null` se pode ativar; caso contrário, mensagem específica. */
export async function canActivate(clinicId: string, agentId: string): Promise<string | null> {
  return withClinicContext(clinicId, async (c) => {
    const row = await loadAgentRow(c, agentId);
    if (!row) return 'Agente não encontrado.';
    if (!row.system_prompt || row.system_prompt.trim().length === 0) {
      return 'Configure o system prompt antes de ativar.';
    }
    const config = toConfig(row.config);
    if (config.escalation_rules.length === 0) {
      return 'Configure ao menos uma regra de escalação antes de ativar.';
    }
    const ch = await c.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM omni.channels WHERE ai_agent_id = $1`,
      [agentId],
    );
    if ((ch.rows[0]?.n ?? 0) === 0) {
      return 'Vincule ao menos um canal antes de ativar.';
    }
    return null;
  });
}

export async function toggleAgent(
  clinicId: string,
  agentId: string,
  isActive: boolean,
): Promise<AiAgentDetail> {
  if (isActive) {
    const reason = await canActivate(clinicId, agentId);
    if (reason) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: reason });
    }
  }
  return withClinicContext(clinicId, async (c) => {
    await c.query(
      `UPDATE omni.ai_agents SET is_active = $2, updated_at = NOW() WHERE id = $1`,
      [agentId, isActive],
    );
    const [row, channelIds, lastActivity] = await Promise.all([
      loadAgentRow(c, agentId),
      loadAgentChannels(c, agentId),
      loadLastActivity(c, agentId),
    ]);
    return mapDetail(row!, channelIds, lastActivity);
  });
}

/* ── Agents: delete (soft) ───────────────────────────────────────────────── */

export async function deleteAgent(clinicId: string, agentId: string): Promise<void> {
  await withClinicContext(clinicId, async (c) => {
    const row = await loadAgentRow(c, agentId);
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Agente não encontrado.' });
    }
    if (row.is_active) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Desative o agente antes de excluir.',
      });
    }
    await c.query(
      `UPDATE omni.ai_agents SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [agentId],
    );
    await c.query(
      `UPDATE omni.channels SET ai_agent_id = NULL WHERE ai_agent_id = $1`,
      [agentId],
    );
  });
}

/* ── Agents: link / unlink channels ─────────────────────────────────────── */

export async function linkChannel(
  clinicId: string,
  agentId: string,
  channelId: string,
): Promise<void> {
  await withClinicContext(clinicId, async (c) => {
    const ch = await c.query<{ ai_agent_id: string | null }>(
      `SELECT ai_agent_id FROM omni.channels WHERE id = $1`,
      [channelId],
    );
    const current = ch.rows[0];
    if (!current) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Canal não encontrado.' });
    }
    if (current.ai_agent_id && current.ai_agent_id !== agentId) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Este canal já está vinculado a outro agente.',
      });
    }
    await c.query(`UPDATE omni.channels SET ai_agent_id = $2 WHERE id = $1`, [channelId, agentId]);
  });
}

export async function unlinkChannel(clinicId: string, channelId: string): Promise<void> {
  await withClinicContext(clinicId, async (c) => {
    await c.query(`UPDATE omni.channels SET ai_agent_id = NULL WHERE id = $1`, [channelId]);
  });
}

/* ── Agents: preview (simulação) ─────────────────────────────────────────── */

/**
 * Simulação descartável — NÃO persiste mensagens.
 * Atalho: chamamos diretamente Ollama local (pois não queremos gastar quota da Anthropic
 * em preview) com o system prompt do agente.
 */
export async function previewAgent(
  clinicId: string,
  input: PreviewAgentInput,
  reason: (args: {
    systemPrompt: string;
    model: string;
    temperature: number;
    maxTokens: number;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  }) => Promise<string | null>,
): Promise<{ text: string; truncated: boolean }> {
  const agent = await getAgent(clinicId, input.id);
  const systemPrompt = agent.systemPrompt?.trim();
  if (!systemPrompt) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Configure o system prompt antes de testar.',
    });
  }

  const text = await reason({
    systemPrompt,
    model:       agent.model,
    temperature: agent.temperature,
    maxTokens:   agent.maxTokens,
    messages:    input.messages,
  });

  if (!text) {
    return {
      text: '[Preview indisponível — o modelo local não respondeu. Tente novamente.]',
      truncated: false,
    };
  }
  return { text, truncated: text.length > 1500 };
}

/* ── Knowledge base ─────────────────────────────────────────────────────── */

interface KbRow {
  id:           string;
  ai_agent_id:  string;
  title:        string;
  content:      string;
  metadata:     Record<string, unknown>;
  created_at:   Date | string;
  is_active:    boolean;
}

function mapKnowledge(row: KbRow): KnowledgeItem {
  const meta = row.metadata ?? {};
  const status = ((meta as Record<string, unknown>)['embedding_status'] as EmbeddingStatus | undefined) ?? 'pending';
  const err    = (meta as Record<string, unknown>)['embedding_error'];
  const filename = (meta as Record<string, unknown>)['original_filename'];
  const mime   = (meta as Record<string, unknown>)['mime_type'];
  const size   = (meta as Record<string, unknown>)['file_size_bytes'];
  return {
    id:               row.id,
    agentId:          row.ai_agent_id,
    title:            row.title,
    contentPreview:   row.content.slice(0, 280),
    originalFilename: typeof filename === 'string' ? filename : null,
    mimeType:         typeof mime === 'string' ? mime : null,
    fileSizeBytes:    typeof size === 'number' ? size : null,
    embeddingStatus:  status,
    embeddingError:   typeof err === 'string' ? err : null,
    createdAt:        row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString(),
  };
}

export async function listKnowledge(
  clinicId: string,
  agentId: string,
): Promise<KnowledgeItem[]> {
  return withClinicContext(clinicId, async (c) => {
    const r = await c.query<KbRow>(
      `SELECT id, ai_agent_id, title, content, metadata, created_at, is_active
         FROM omni.ai_knowledge_base
        WHERE ai_agent_id = $1
        ORDER BY created_at DESC`,
      [agentId],
    );
    return r.rows.map(mapKnowledge);
  });
}

export async function getKnowledge(
  clinicId: string,
  agentId: string,
  id: string,
): Promise<KnowledgeItem & { content: string }> {
  return withClinicContext(clinicId, async (c) => {
    const r = await c.query<KbRow>(
      `SELECT id, ai_agent_id, title, content, metadata, created_at, is_active
         FROM omni.ai_knowledge_base
        WHERE id = $1 AND ai_agent_id = $2
        LIMIT 1`,
      [id, agentId],
    );
    const row = r.rows[0];
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Documento não encontrado.' });
    }
    return { ...mapKnowledge(row), content: row.content };
  });
}

export async function deleteKnowledge(
  clinicId: string,
  agentId: string,
  id: string,
): Promise<void> {
  await withClinicContext(clinicId, async (c) => {
    const r = await c.query(
      `DELETE FROM omni.ai_knowledge_base WHERE id = $1 AND ai_agent_id = $2`,
      [id, agentId],
    );
    if (r.rowCount === 0) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Documento não encontrado.' });
    }
  });
}

/**
 * Cria o documento em estado `pending` — chamado pelo upload endpoint após extrair o texto.
 * O embedding é gerado depois pelo worker `aurora-embed`.
 */
export async function createKnowledgeDraft(
  clinicId: string,
  agentId: string,
  data: {
    title: string;
    content: string;
    originalFilename: string;
    mimeType: string;
    fileSizeBytes: number;
  },
): Promise<string> {
  return withClinicContext(clinicId, async (c) => {
    const docId = randomUUID();
    await c.query(
      `INSERT INTO omni.ai_knowledge_base
         (id, clinic_id, ai_agent_id, title, content, metadata, is_active)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, TRUE)`,
      [
        docId,
        clinicId,
        agentId,
        data.title,
        data.content,
        JSON.stringify({
          original_filename: data.originalFilename,
          mime_type:         data.mimeType,
          file_size_bytes:   data.fileSizeBytes,
          embedding_status:  'pending',
          source:            'upload',
        }),
      ],
    );
    return docId;
  });
}

/**
 * Confirma o documento (pós-upload): opcionalmente renomeia, marca como pending
 * e enfileira o job de embedding. Retorna o item atualizado.
 */
export async function confirmKnowledgeEmbedding(
  clinicId: string,
  agentId: string,
  documentId: string,
  newTitle?: string,
): Promise<KnowledgeItem> {
  return withClinicContext(clinicId, async (c) => {
    const row = await c.query<KbRow>(
      `SELECT id, ai_agent_id, title, content, metadata, created_at, is_active
         FROM omni.ai_knowledge_base
        WHERE id = $1 AND ai_agent_id = $2
        LIMIT 1`,
      [documentId, agentId],
    );
    const doc = row.rows[0];
    if (!doc) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Documento não encontrado.' });
    }

    if (newTitle && newTitle !== doc.title) {
      await c.query(
        `UPDATE omni.ai_knowledge_base
            SET title = $1, updated_at = NOW()
          WHERE id = $2`,
        [newTitle, documentId],
      );
      doc.title = newTitle;
    }

    await c.query(
      `UPDATE omni.ai_knowledge_base
          SET metadata = COALESCE(metadata, '{}'::jsonb)
                         || jsonb_build_object('embedding_status', 'pending')
                         || jsonb_build_object('embedding_error', NULL),
              updated_at = NOW()
        WHERE id = $1`,
      [documentId],
    );

    const meta = (doc.metadata ?? {}) as Record<string, unknown>;
    meta['embedding_status'] = 'pending';
    meta['embedding_error']  = null;
    doc.metadata = meta;

    return mapKnowledge(doc);
  });
}

export async function markKnowledgeStatus(
  clinicId: string,
  id: string,
  status: EmbeddingStatus,
  errorMessage?: string,
): Promise<void> {
  await withClinicContext(clinicId, async (c) => {
    await c.query(
      `UPDATE omni.ai_knowledge_base
          SET metadata = COALESCE(metadata, '{}'::jsonb)
                         || jsonb_build_object('embedding_status', $2::text)
                         || CASE WHEN $3::text IS NULL
                                 THEN jsonb_build_object('embedding_error', NULL)
                                 ELSE jsonb_build_object('embedding_error', $3::text) END,
              updated_at = NOW()
        WHERE id = $1`,
      [id, status, errorMessage ?? null],
    );
  });
}

/* ── Metrics ────────────────────────────────────────────────────────────── */

function daysForPeriod(period: MetricsPeriod): number {
  return period === '90d' ? 90 : period === '30d' ? 30 : 7;
}

/**
 * Agregações de métricas a partir de `audit.domain_events` + `omni.conversations`.
 * Nunca lê `messages.content` (PHI).
 */
export async function getMetrics(
  clinicId: string,
  agentId: string,
  period: MetricsPeriod,
): Promise<AgentMetrics> {
  const days = daysForPeriod(period);
  return withClinicContext(clinicId, async (c) => {
    // Conversas em que este agente respondeu no período.
    const convRes = await c.query<{ total: number; resolved: number; escalated: number }>(
      `WITH agent_convs AS (
         SELECT DISTINCT m.conversation_id
           FROM omni.messages m
          WHERE m.sender_agent_id = $1
            AND m.created_at     >= NOW() - ($2 || ' days')::interval
       )
       SELECT
         COUNT(*)::int                                                  AS total,
         COUNT(*)::int FILTER (WHERE cv.status = 'resolved' AND cv.resolved_by IS NULL) AS resolved,
         COUNT(*)::int FILTER (WHERE cv.assigned_to IS NOT NULL)        AS escalated
         FROM agent_convs ac
         JOIN omni.conversations cv ON cv.id = ac.conversation_id`,
      [agentId, String(days)],
    );
    const t = convRes.rows[0] ?? { total: 0, resolved: 0, escalated: 0 };
    const resolutionRate = t.total === 0 ? 0 : Math.round((t.resolved / t.total) * 1000) / 10;
    const escalationRate = t.total === 0 ? 0 : Math.round((t.escalated / t.total) * 1000) / 10;

    // Tempo médio de resposta (patient → ai_agent).
    const rtRes = await c.query<{ avg_seconds: number | null }>(
      `SELECT AVG(EXTRACT(EPOCH FROM (ai_msg.created_at - patient_msg.created_at)))::float AS avg_seconds
         FROM omni.messages patient_msg
         JOIN LATERAL (
           SELECT created_at FROM omni.messages m
            WHERE m.conversation_id = patient_msg.conversation_id
              AND m.sender_type     = 'ai_agent'
              AND m.sender_agent_id = $1
              AND m.created_at      > patient_msg.created_at
            ORDER BY m.created_at ASC
            LIMIT 1
         ) ai_msg ON TRUE
        WHERE patient_msg.sender_type  = 'patient'
          AND patient_msg.created_at  >= NOW() - ($2 || ' days')::interval`,
      [agentId, String(days)],
    );

    // Guardrails — `aurora.guardrail_block` via aggregate_id = conversation_id.
    const guardRes = await c.query<{ t: string | null; n: number }>(
      `SELECT payload ->> 'type' AS t, COUNT(*)::int AS n
         FROM audit.domain_events e
        WHERE e.event_type = 'aurora.guardrail_block'
          AND e.occurred_at >= NOW() - ($2 || ' days')::interval
          AND e.aggregate_id IN (
            SELECT DISTINCT conversation_id FROM omni.messages
             WHERE sender_agent_id = $1
               AND created_at     >= NOW() - ($2 || ' days')::interval
          )
        GROUP BY payload ->> 'type'`,
      [agentId, String(days)],
    );
    const guardMap: Record<string, number> = {};
    for (const g of guardRes.rows) {
      if (g.t) guardMap[g.t] = g.n;
    }

    // Intenções — via `aurora.message_handled`.
    const intentRes = await c.query<{ intent: string | null; n: number }>(
      `SELECT payload ->> 'intent' AS intent, COUNT(*)::int AS n
         FROM audit.domain_events e
        WHERE e.event_type = 'aurora.message_handled'
          AND e.occurred_at >= NOW() - ($2 || ' days')::interval
          AND e.aggregate_id IN (
            SELECT DISTINCT conversation_id FROM omni.messages
             WHERE sender_agent_id = $1
               AND created_at     >= NOW() - ($2 || ' days')::interval
          )
        GROUP BY payload ->> 'intent'
        ORDER BY n DESC`,
      [agentId, String(days)],
    );

    // Aberturas do circuit breaker — evento global, não atrelado a um agente.
    const breakerRes = await c.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM audit.domain_events
        WHERE event_type = 'aurora.message_handled'
          AND occurred_at >= NOW() - ($2 || ' days')::interval
          AND payload ->> 'breakerState' = 'open'`,
      [agentId, String(days)],
    );

    return {
      period,
      totalConversations: t.total,
      resolutionRate,
      escalationRate,
      avgResponseSeconds: rtRes.rows[0]?.avg_seconds ?? null,
      guardrailsTriggered: {
        diagnostico: guardMap['diagnosis']     ?? 0,
        prescricao:  guardMap['prescription']  ?? 0,
        promessa:    guardMap['promise']       ?? 0,
      },
      intents: intentRes.rows
        .filter((r): r is { intent: string; n: number } => r.intent != null)
        .map((r) => ({ intent: r.intent as AuroraIntent, count: r.n })),
      circuitBreakerOpens: breakerRes.rows[0]?.n ?? 0,
    };
  });
}

export async function getMetricsTimeline(
  clinicId: string,
  agentId: string,
  period: MetricsPeriod,
): Promise<AgentMetricsTimeline> {
  const days = daysForPeriod(period);
  return withClinicContext(clinicId, async (c) => {
    const r = await c.query<{
      date:      string;
      aurora:    number;
      escalated: number;
    }>(
      `WITH agent_convs AS (
         SELECT DISTINCT m.conversation_id, date_trunc('day', m.created_at) AS d
           FROM omni.messages m
          WHERE m.sender_agent_id = $1
            AND m.created_at     >= NOW() - ($2 || ' days')::interval
       )
       SELECT to_char(ac.d, 'YYYY-MM-DD') AS date,
              COUNT(*)::int FILTER (WHERE cv.status = 'resolved' AND cv.resolved_by IS NULL) AS aurora,
              COUNT(*)::int FILTER (WHERE cv.assigned_to IS NOT NULL)                        AS escalated
         FROM agent_convs ac
         JOIN omni.conversations cv ON cv.id = ac.conversation_id
        GROUP BY ac.d
        ORDER BY ac.d ASC`,
      [agentId, String(days)],
    );
    return { period, points: r.rows };
  });
}

/* ── Teste de escalação (simulação) ─────────────────────────────────────── */

export async function testEscalation(
  clinicId: string,
  agentId: string,
  message: string,
): Promise<EscalationTestResult> {
  const agent = await getAgent(clinicId, agentId);
  const intentResult = await classifyIntent({ text: message, contentType: 'text' });
  const intent = intentResult.intent as AuroraIntent;
  const sentiment = detectSentiment(message);

  const matched = findMatchingRule(
    agent.config.escalation_rules,
    { message, intent, sentiment, hour: new Date().getHours() },
  );

  return {
    matchedRule:   matched,
    intent,
    sentiment,
    wouldEscalate: matched !== null,
  };
}

export function findMatchingRule(
  rules: EscalationRule[],
  ctx: {
    message:   string;
    intent:    AuroraIntent;
    sentiment: 'negativo' | 'muito_negativo' | 'neutro' | 'positivo';
    hour:      number;
    unresolvedMessages?: number;
  },
): EscalationRule | null {
  const active = [...rules].filter((r) => r.isActive).sort((a, b) => a.priority - b.priority);
  for (const rule of active) {
    let matched = true;
    for (const cond of rule.conditions) {
      if (!evalCondition(cond, ctx)) { matched = false; break; }
    }
    if (matched) return rule;
  }
  return null;
}

function evalCondition(
  cond: { type: string; operator: string; value: string | number },
  ctx: {
    message: string;
    intent: AuroraIntent;
    sentiment: string;
    hour: number;
    unresolvedMessages?: number;
  },
): boolean {
  const { type, operator, value } = cond;
  switch (type) {
    case 'sentiment':
      return operator === 'equals' ? ctx.sentiment === value : ctx.sentiment !== value;
    case 'intent':
      return operator === 'equals' ? ctx.intent === value : ctx.intent !== value;
    case 'keyword': {
      const lower = ctx.message.toLowerCase();
      return operator === 'contains' && lower.includes(String(value).toLowerCase());
    }
    case 'time_of_day': {
      const hourValue = typeof value === 'number' ? value : Number(value);
      if (Number.isNaN(hourValue)) return false;
      return operator === 'greater_than' ? ctx.hour > hourValue : ctx.hour === hourValue;
    }
    case 'unresolved_messages': {
      const threshold = typeof value === 'number' ? value : Number(value);
      if (Number.isNaN(threshold) || ctx.unresolvedMessages === undefined) return false;
      return operator === 'greater_than'
        ? ctx.unresolvedMessages > threshold
        : ctx.unresolvedMessages === threshold;
    }
    default:
      logger.warn({ type }, 'aurora-admin: unknown escalation condition type');
      return false;
  }
}
