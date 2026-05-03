/**
 * Processor `aurora-embed` — Fase 4 §1.3.
 *
 * Consome `auroraEmbedQueue`. Para cada job:
 *   1. Marca o documento como `processing`.
 *   2. Chama Ollama `/api/embeddings` com `nomic-embed-text` (768-dim).
 *   3. Grava o vetor em `omni.ai_knowledge_base.embedding` e marca `completed`.
 *   4. Em qualquer falha, marca `failed` com a mensagem e relança para o BullMQ
 *      tentar novamente conforme o backoff configurado.
 *
 * Limitações: fazemos embedding do documento inteiro, truncando em ~6000 caracteres
 * para caber no contexto do modelo com folga. Se for preciso maior granularidade
 * (chunks + múltiplas linhas por doc), é uma evolução futura — não bloqueia o
 * MVP do painel.
 */

import type { Job, Processor } from 'bullmq';
import type { Pool, PoolClient } from 'pg';
import type pino from 'pino';

interface EmbedJobData {
  clinicId:   string;
  agentId:    string;
  documentId: string;
}

export interface AuroraEmbedDeps {
  db:             Pool;
  logger:         pino.Logger;
  ollamaBaseUrl:  string;
  /** Default: 'nomic-embed-text'. */
  embedModel?:    string;
}

const MAX_EMBED_CHARS = 6_000;
const REQUEST_TIMEOUT_MS = 30_000;
const EXPECTED_DIM = 768;

interface OllamaEmbeddingsResponse {
  embedding?: number[];
}

async function withClinicContext<T>(
  db: Pool,
  clinicId: string,
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_clinic_id', $1, true)", [clinicId]);
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function setStatus(
  db: Pool,
  clinicId: string,
  documentId: string,
  status: 'processing' | 'completed' | 'failed',
  errorMessage?: string | null,
): Promise<void> {
  await withClinicContext(db, clinicId, async (c) => {
    // SEC-W: defesa em profundidade — `dermaos_worker` tem policy USING true,
    // RLS sozinha não bloqueia cross-tenant. Filtra explicitamente clinic_id.
    await c.query(
      `UPDATE omni.ai_knowledge_base
          SET metadata = COALESCE(metadata, '{}'::jsonb)
                         || jsonb_build_object('embedding_status', $2::text)
                         || CASE WHEN $3::text IS NULL
                                 THEN jsonb_build_object('embedding_error', NULL)
                                 ELSE jsonb_build_object('embedding_error', $3::text) END,
              updated_at = NOW()
        WHERE id = $1 AND clinic_id = $4`,
      [documentId, status, errorMessage ?? null, clinicId],
    );
  });
}

async function loadContent(
  db: Pool,
  clinicId: string,
  documentId: string,
): Promise<string | null> {
  return withClinicContext(db, clinicId, async (c) => {
    // SEC-W: defesa em profundidade.
    const r = await c.query<{ content: string }>(
      `SELECT content FROM omni.ai_knowledge_base WHERE id = $1 AND clinic_id = $2 LIMIT 1`,
      [documentId, clinicId],
    );
    return r.rows[0]?.content ?? null;
  });
}

async function saveVector(
  db: Pool,
  clinicId: string,
  documentId: string,
  vector: number[],
): Promise<void> {
  const literal = `[${vector.join(',')}]`;
  await withClinicContext(db, clinicId, async (c) => {
    // SEC-W: defesa em profundidade.
    await c.query(
      `UPDATE omni.ai_knowledge_base
          SET embedding = $2::vector,
              metadata  = COALESCE(metadata, '{}'::jsonb)
                          || jsonb_build_object('embedding_status', 'completed')
                          || jsonb_build_object('embedding_error', NULL),
              updated_at = NOW()
        WHERE id = $1 AND clinic_id = $3`,
      [documentId, literal, clinicId],
    );
  });
}

async function callOllamaEmbeddings(
  baseUrl: string,
  model: string,
  input: string,
): Promise<number[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/embeddings`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model, prompt: input }),
      signal:  controller.signal,
    });
    if (!res.ok) {
      throw new Error(`ollama_http_${res.status}`);
    }
    const json = (await res.json()) as OllamaEmbeddingsResponse;
    if (!json.embedding || !Array.isArray(json.embedding)) {
      throw new Error('ollama_missing_embedding');
    }
    return json.embedding;
  } finally {
    clearTimeout(timeout);
  }
}

export function buildAuroraEmbedProcessor(
  deps: AuroraEmbedDeps,
): Processor<EmbedJobData> {
  const model = deps.embedModel ?? 'nomic-embed-text';

  return async function process(job: Job<EmbedJobData>): Promise<void> {
    const { clinicId, documentId } = job.data;
    const log = deps.logger.child({ queue: 'aurora-embed', jobId: job.id, documentId });

    try {
      await setStatus(deps.db, clinicId, documentId, 'processing');

      const content = await loadContent(deps.db, clinicId, documentId);
      if (!content || content.trim().length === 0) {
        throw new Error('empty_document');
      }

      const input = content.slice(0, MAX_EMBED_CHARS);
      const vector = await callOllamaEmbeddings(deps.ollamaBaseUrl, model, input);

      if (vector.length !== EXPECTED_DIM) {
        throw new Error(`unexpected_dim_${vector.length}`);
      }

      await saveVector(deps.db, clinicId, documentId, vector);
      log.info('aurora-embed completed');
    } catch (err) {
      const message = (err as Error)?.message ?? 'unknown_error';
      log.warn({ err }, 'aurora-embed failed');
      await setStatus(deps.db, clinicId, documentId, 'failed', message).catch(() => undefined);
      throw err; // re-throw para BullMQ aplicar backoff/retry
    }
  };
}
