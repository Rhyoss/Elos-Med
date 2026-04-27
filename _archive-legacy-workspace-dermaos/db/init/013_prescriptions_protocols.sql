-- ============================================================================
-- DermaOS — Prompt 10: Prescrições e Protocolos
-- Extensões nas tabelas clinical.prescriptions / clinical.protocols /
-- clinical.protocol_sessions com:
--   * versionamento e imutabilidade pós-assinatura
--   * duplicação com referência à prescrição de origem
--   * mock de envio digital (sent_mock) com interface isolada
--   * cancelamento de protocolo (soft-cancel) com motivo obrigatório
--   * eventos adversos com severidade e flag de revisão médica
--   * consumo de produtos por sessão com rastreabilidade por lote
-- ============================================================================

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE clinical.adverse_event_severity AS ENUM (
    'none',
    'leve',
    'moderado',
    'grave'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE clinical.prescription_delivery_status AS ENUM (
    'pending',
    'sent_mock',
    'delivered',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Novos status incluindo 'assinada' e 'cancelada' (o enum já tem 'emitida')
ALTER TYPE clinical.prescription_status ADD VALUE IF NOT EXISTS 'assinada';
ALTER TYPE clinical.prescription_status ADD VALUE IF NOT EXISTS 'cancelada';

-- ─── clinical.prescriptions: assinatura, versão, duplicação, delivery ───────

ALTER TABLE clinical.prescriptions
  -- encounter_id deixa de ser obrigatório (prescrições podem existir fora de consulta)
  ALTER COLUMN encounter_id DROP NOT NULL;

ALTER TABLE clinical.prescriptions
  ADD COLUMN IF NOT EXISTS version            INT         NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS duplicated_from    UUID        REFERENCES clinical.prescriptions (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_by          UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signature_hash     TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by       UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_by         UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pdf_storage_key    TEXT,
  ADD COLUMN IF NOT EXISTS pdf_generated_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_status    clinical.prescription_delivery_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_payload   JSONB       NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_prescriptions_duplicated_from
  ON clinical.prescriptions (duplicated_from)
  WHERE duplicated_from IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic_patient_date
  ON clinical.prescriptions (clinic_id, patient_id, created_at DESC);

-- ─── clinical.prescription_deliveries ────────────────────────────────────────
-- Log imutável de cada tentativa de envio digital (mock ou real no futuro).

CREATE TABLE IF NOT EXISTS clinical.prescription_deliveries (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  prescription_id UUID        NOT NULL REFERENCES clinical.prescriptions (id) ON DELETE RESTRICT,
  provider_name   TEXT        NOT NULL,                        -- ex: 'mock', 'memed', 'nexodata'
  status          clinical.prescription_delivery_status NOT NULL DEFAULT 'sent_mock',
  channel         TEXT,                                        -- 'email','sms','whatsapp','portal'
  recipient       TEXT,
  external_id     TEXT,                                        -- id do sistema externo
  payload         JSONB       NOT NULL DEFAULT '{}',
  error_message   TEXT,
  performed_by    UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  performed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescription_deliveries_prescription
  ON clinical.prescription_deliveries (prescription_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescription_deliveries_clinic
  ON clinical.prescription_deliveries (clinic_id, performed_at DESC);

ALTER TABLE clinical.prescription_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.prescription_deliveries FORCE  ROW LEVEL SECURITY;

CREATE POLICY prescription_deliveries_isolation_app ON clinical.prescription_deliveries
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY prescription_deliveries_isolation_readonly ON clinical.prescription_deliveries
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY prescription_deliveries_worker_all ON clinical.prescription_deliveries
  FOR ALL TO dermaos_worker USING (true);

GRANT SELECT, INSERT ON clinical.prescription_deliveries TO dermaos_app;
GRANT SELECT           ON clinical.prescription_deliveries TO dermaos_readonly;

-- Log imutável — impede UPDATE/DELETE
CREATE OR REPLACE RULE no_update_prescription_deliveries AS
  ON UPDATE TO clinical.prescription_deliveries DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_prescription_deliveries AS
  ON DELETE TO clinical.prescription_deliveries DO INSTEAD NOTHING;

-- ─── clinical.protocols: cancelamento, parâmetros, vínculo de produtos ───────

ALTER TABLE clinical.protocols
  ADD COLUMN IF NOT EXISTS parameters_schema   JSONB       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS product_links       JSONB       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by        UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by          UUID        REFERENCES shared.users (id) ON DELETE SET NULL;

-- Garante integridade básica (o CHECK original já cobre sessions_done/total_sessions)
DO $$ BEGIN
  ALTER TABLE clinical.protocols
    ADD CONSTRAINT chk_protocol_interval_days CHECK (interval_days IS NULL OR interval_days > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_protocols_active_patient
  ON clinical.protocols (clinic_id, patient_id, status)
  WHERE status IN ('ativo', 'pausado');

-- ─── clinical.protocol_sessions: eventos adversos, fotos, consumo ───────────

ALTER TABLE clinical.protocol_sessions
  ADD COLUMN IF NOT EXISTS patient_response       TEXT,
  ADD COLUMN IF NOT EXISTS adverse_events         JSONB       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS adverse_severity_max   clinical.adverse_event_severity NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS flag_medical_review    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pre_image_ids          UUID[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS post_image_ids         UUID[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS products_consumed      JSONB       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS insufficient_stock     BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scheduled_next_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS version                INT         NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS original_session_id    UUID        REFERENCES clinical.protocol_sessions (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edit_justification     TEXT,
  ADD COLUMN IF NOT EXISTS created_by             UUID        REFERENCES shared.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_protocol_sessions_flag_review
  ON clinical.protocol_sessions (clinic_id, performed_at DESC)
  WHERE flag_medical_review = TRUE;

CREATE INDEX IF NOT EXISTS idx_protocol_sessions_insufficient_stock
  ON clinical.protocol_sessions (clinic_id)
  WHERE insufficient_stock = TRUE;
