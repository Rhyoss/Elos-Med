-- ============================================================================
-- DermaOS — Automations & Templates Extension (Prompt 10)
-- Adiciona: novos valores de trigger, colunas em automations/templates,
--           e tabela de execução com chave de idempotência.
-- ============================================================================

-- ─── Novos valores no enum automation_trigger ────────────────────────────────
-- IF NOT EXISTS evita erro em re-execução. Valores antigos são mantidos.

ALTER TYPE omni.automation_trigger ADD VALUE IF NOT EXISTS 'appointment_24h_before';
ALTER TYPE omni.automation_trigger ADD VALUE IF NOT EXISTS 'appointment_2h_before';
ALTER TYPE omni.automation_trigger ADD VALUE IF NOT EXISTS 'appointment_created';
ALTER TYPE omni.automation_trigger ADD VALUE IF NOT EXISTS 'encounter_completed';
ALTER TYPE omni.automation_trigger ADD VALUE IF NOT EXISTS 'biopsy_result_received';
ALTER TYPE omni.automation_trigger ADD VALUE IF NOT EXISTS 'invoice_overdue_7d';
ALTER TYPE omni.automation_trigger ADD VALUE IF NOT EXISTS 'patient_birthday';
ALTER TYPE omni.automation_trigger ADD VALUE IF NOT EXISTS 'lead_no_response_48h';
ALTER TYPE omni.automation_trigger ADD VALUE IF NOT EXISTS 'lead_score_above_80';

-- ─── Extensão de omni.automations ────────────────────────────────────────────
-- Colunas explícitas para template, canal, delay e condições.
-- trigger_config e actions JSONB existentes são mantidos para compatibilidade.

ALTER TABLE omni.automations
  ADD COLUMN IF NOT EXISTS template_id    UUID        REFERENCES omni.templates (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS channel_id     UUID        REFERENCES omni.channels  (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delay_minutes  INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conditions     JSONB       NOT NULL DEFAULT '[]';

-- Índice único: impede duas automações ativas com mesmo trigger+canal+condições.
-- Avalia conditions como texto para comparação exata de JSON.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_automation_trigger_channel_cond
  ON omni.automations (clinic_id, trigger, channel_id, (conditions::text))
  WHERE is_active = TRUE;

-- ─── Extensão de omni.templates ──────────────────────────────────────────────
-- channel_type: filtra templates compatíveis por canal no frontend.
-- is_default:   seeds criados pelo sistema — não deletáveis, mas editáveis.
-- body_html:    body HTML para templates de email (plain body continua em uso para SMS/WhatsApp).

ALTER TABLE omni.templates
  ADD COLUMN IF NOT EXISTS channel_type  omni.channel_type,
  ADD COLUMN IF NOT EXISTS is_default    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS body_html     TEXT;

CREATE INDEX IF NOT EXISTS idx_templates_clinic_channel_type
  ON omni.templates (clinic_id, channel_type) WHERE channel_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_templates_clinic_default
  ON omni.templates (clinic_id) WHERE is_default = TRUE;

-- ─── omni.automation_execution_log ───────────────────────────────────────────
-- Registra cada execução: sent / skipped / failed.
-- idempotency_key UNIQUE garante que o mesmo evento+entidade não dispara duas vezes.

CREATE TABLE IF NOT EXISTS omni.automation_execution_log (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id        UUID        NOT NULL REFERENCES shared.clinics    (id) ON DELETE RESTRICT,
  automation_id    UUID        NOT NULL REFERENCES omni.automations  (id) ON DELETE CASCADE,

  -- Chave de idempotência: 'trigger:automationId:entityId:YYYY-MM-DD'
  -- Garante que mesmo trigger+automação+entidade não dispara duas vezes no mesmo dia.
  idempotency_key  TEXT        NOT NULL,

  entity_id        UUID        NOT NULL,   -- appointment_id, patient_id, invoice_id, etc.
  entity_type      TEXT        NOT NULL,   -- 'appointment' | 'patient' | 'invoice' | 'lead' | 'encounter'
  trigger          omni.automation_trigger NOT NULL,

  -- Status do ciclo de vida do job
  status           TEXT        NOT NULL DEFAULT 'processing'
                   CHECK (status IN ('processing', 'sent', 'skipped', 'failed')),

  skip_reason      TEXT,                   -- motivo quando status = 'skipped'
  fail_reason      TEXT,                   -- motivo quando status = 'failed'

  recipient        TEXT,                   -- telefone ou e-mail de destino
  channel          omni.channel_type,      -- canal efetivamente usado

  bullmq_job_id    TEXT,                   -- ID do job no BullMQ (para cancelamento)
  scheduled_at     TIMESTAMPTZ NOT NULL,   -- momento planejado de disparo
  executed_at      TIMESTAMPTZ,            -- momento real de execução

  metadata         JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_automation_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_automation_exec_clinic_auto
  ON omni.automation_execution_log (clinic_id, automation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_exec_status
  ON omni.automation_execution_log (clinic_id, status, created_at DESC)
  WHERE status != 'sent';

CREATE INDEX IF NOT EXISTS idx_automation_exec_entity
  ON omni.automation_execution_log (clinic_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_automation_exec_recent
  ON omni.automation_execution_log (automation_id, scheduled_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE omni.automation_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni.automation_execution_log FORCE  ROW LEVEL SECURITY;

CREATE POLICY automation_exec_app ON omni.automation_execution_log
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());

CREATE POLICY automation_exec_readonly ON omni.automation_execution_log
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());

CREATE POLICY automation_exec_worker ON omni.automation_execution_log
  FOR ALL TO dermaos_worker USING (true);

-- ─── Grants ──────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE        ON omni.automation_execution_log TO dermaos_app;
GRANT SELECT                        ON omni.automation_execution_log TO dermaos_readonly;
GRANT SELECT, INSERT, UPDATE        ON omni.automation_execution_log TO dermaos_worker;
GRANT ALL                           ON omni.automation_execution_log TO dermaos_admin;
