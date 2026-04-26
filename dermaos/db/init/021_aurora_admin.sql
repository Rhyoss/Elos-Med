-- =====================================================================================
-- Migration 021 — Aurora Admin (Fase 4)
-- =====================================================================================
-- Ajusta `omni.ai_agents` e `omni.ai_knowledge_base` para o painel de gestão da Aurora:
--   1. Dimensão do embedding 1536 → 768 (Ollama `nomic-embed-text`).
--   2. Defaults de `temperature` (0.30) e `max_tokens` (800) — recomendados p/ WhatsApp.
--   3. CHECK no `model` restringindo à whitelist.
--   4. UNIQUE (`clinic_id`, `name`) em ai_agents — evita agentes com mesmo nome.
--   5. `deleted_at` p/ soft-delete quando agente já rodou em conversas (FK sender_agent_id).
--   6. Campos em `ai_knowledge_base` p/ rastreio do arquivo original + status do embedding.
-- =====================================================================================

-- ─── 1. Embedding 1536 → 768 ──────────────────────────────────────────────────────────
-- Dropa índice ivfflat (exige recriação com nova dim), altera coluna, recria índice.

DROP INDEX IF EXISTS omni.idx_ai_kb_embedding;

ALTER TABLE omni.ai_knowledge_base
  ALTER COLUMN embedding TYPE VECTOR(768)
  USING NULL;  -- zero linhas no momento; qualquer valor existente seria incompatível

CREATE INDEX idx_ai_kb_embedding ON omni.ai_knowledge_base
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ─── 2. Defaults de temperature/max_tokens ────────────────────────────────────────────

ALTER TABLE omni.ai_agents
  ALTER COLUMN temperature SET DEFAULT 0.30;

ALTER TABLE omni.ai_agents
  ALTER COLUMN max_tokens  SET DEFAULT 800;

-- ─── 3. CHECK no model ────────────────────────────────────────────────────────────────

ALTER TABLE omni.ai_agents
  DROP CONSTRAINT IF EXISTS ai_agents_model_check;

ALTER TABLE omni.ai_agents
  ADD CONSTRAINT ai_agents_model_check
  CHECK (model IN (
    'claude-haiku-4-5',
    'claude-sonnet-4-20250514',
    'ollama:llama3.1:8b'
  ));

-- ─── 4. UNIQUE (clinic_id, name) ──────────────────────────────────────────────────────
-- Permite reativar agentes com mesmo nome após soft-delete (ver item 5).

ALTER TABLE omni.ai_agents
  ADD CONSTRAINT ai_agents_unique_name_per_clinic
  UNIQUE (clinic_id, name);

-- ─── 5. Soft-delete ───────────────────────────────────────────────────────────────────

ALTER TABLE omni.ai_agents
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX idx_ai_agents_alive
  ON omni.ai_agents (clinic_id)
  WHERE deleted_at IS NULL;

-- ─── 6. Metadata do arquivo original em ai_knowledge_base ─────────────────────────────
-- Armazenamos:
--   metadata.original_filename : string
--   metadata.file_size_bytes   : int
--   metadata.mime_type         : string
--   metadata.embedding_status  : 'pending' | 'processing' | 'completed' | 'failed'
--   metadata.embedding_error   : string | null
--   metadata.source            : 'upload' | 'manual'
-- Nada estrutural a acrescentar — JSONB já suporta, mas criamos índice funcional
-- para filtros por status do embedding.

CREATE INDEX IF NOT EXISTS idx_ai_kb_embedding_status
  ON omni.ai_knowledge_base ((metadata ->> 'embedding_status'));

-- ─── 7. ai_agent_channels (N:N entre agentes e canais) ────────────────────────────────
-- A coluna omni.channels.ai_agent_id permite 1 agente por canal. O prompt da Fase 4
-- descreve vínculo via checkbox com checagem "1 canal só pode ter 1 agente por vez" —
-- portanto mantemos 1:N (channel → agent). Nenhuma alteração aqui. (Mantido por
-- clareza — caso o produto evolua p/ N:N, basta criar tabela de junção.)

-- =====================================================================================
-- Fim da migration 021
-- =====================================================================================
