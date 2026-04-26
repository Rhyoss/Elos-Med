-- ============================================================================
-- DermaOS — Kits de procedimento, consumo automático, rastreabilidade
-- Prompt 14: consumo atômico, versionamento de kits, idempotência de eventos,
-- rastreabilidade ANVISA bidirecional, relatórios de recall com hash.
-- ============================================================================

-- ─── Evolução: supply.kit_templates ──────────────────────────────────────────
-- Cada kit agora é vinculado a um tipo de procedimento (shared.services).
-- Um tipo de procedimento pode ter NO MÁXIMO um kit ativo por clínica.
-- Ao editar kit com consumos históricos, criamos nova versão (parent_kit_id
-- aponta para a anterior, que é marcada como 'superseded').
-- Soft-delete: nunca deletamos fisicamente (consumos históricos referenciam).

ALTER TABLE supply.kit_templates
  ADD COLUMN IF NOT EXISTS procedure_type_id UUID        REFERENCES shared.services (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version           INT         NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_kit_id     UUID        REFERENCES supply.kit_templates (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status            TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','superseded','archived')),
  ADD COLUMN IF NOT EXISTS updated_by        UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ;

-- Backfill: kits antigos (service_id populado) migram para procedure_type_id.
UPDATE supply.kit_templates
   SET procedure_type_id = service_id
 WHERE procedure_type_id IS NULL AND service_id IS NOT NULL;

-- Unicidade: apenas UM kit ativo por procedimento por clínica (partial unique).
DROP INDEX IF EXISTS supply.uq_kit_active_per_procedure;
CREATE UNIQUE INDEX uq_kit_active_per_procedure
  ON supply.kit_templates (clinic_id, procedure_type_id)
  WHERE status = 'active' AND deleted_at IS NULL AND procedure_type_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kit_templates_procedure_active
  ON supply.kit_templates (clinic_id, procedure_type_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_kit_templates_parent
  ON supply.kit_templates (parent_kit_id)
  WHERE parent_kit_id IS NOT NULL;

-- ─── Evolução: supply.kit_items ──────────────────────────────────────────────
-- Flag `is_optional` para itens cujo consumo parcial não gera alerta.
-- `display_order` para ordenação client-side (drag-and-drop).

ALTER TABLE supply.kit_items
  ADD COLUMN IF NOT EXISTS is_optional   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS display_order INT     NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_kit_items_template_order
  ON supply.kit_items (kit_template_id, display_order);

-- ─── Evolução: supply.patient_lot_traces ─────────────────────────────────────
-- Imutabilidade append-only (sem UPDATE/DELETE), exceto DELETE CASCADE de
-- FK pais via auditoria específica. Índices bidirecionais p/ recall.

ALTER TABLE supply.patient_lot_traces
  ADD COLUMN IF NOT EXISTS kit_template_id UUID    REFERENCES supply.kit_templates (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id      UUID    REFERENCES supply.products (id)      ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS ip_origin       INET;

-- Backfill product_id a partir dos lotes (uma única vez)
UPDATE supply.patient_lot_traces plt
   SET product_id = il.product_id
  FROM supply.inventory_lots il
 WHERE plt.lot_id = il.id AND plt.product_id IS NULL;

-- Índices otimizados para recall bidirecional
CREATE INDEX IF NOT EXISTS idx_patient_lot_traces_patient_time
  ON supply.patient_lot_traces (clinic_id, patient_id, applied_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_lot_traces_lot_time
  ON supply.patient_lot_traces (clinic_id, lot_id, applied_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_lot_traces_product_time
  ON supply.patient_lot_traces (clinic_id, product_id, applied_at DESC)
  WHERE product_id IS NOT NULL;

-- Trigger de imutabilidade (append-only por exigência ANVISA)
CREATE OR REPLACE FUNCTION supply.patient_lot_traces_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'supply.patient_lot_traces é append-only: UPDATE não permitido (ANVISA). Registre novo trace para correções.'
      USING ERRCODE = 'check_violation';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'supply.patient_lot_traces é append-only: DELETE não permitido (ANVISA).'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_patient_lot_traces_immutable ON supply.patient_lot_traces;
CREATE TRIGGER trg_patient_lot_traces_immutable
  BEFORE UPDATE OR DELETE ON supply.patient_lot_traces
  FOR EACH ROW EXECUTE FUNCTION supply.patient_lot_traces_immutable();

-- ─── supply.procedure_consumption_log ────────────────────────────────────────
-- Log de idempotência: ao receber encounter.completed/session.completed,
-- verificamos se o consumo já foi processado. UNIQUE constraint garante
-- que retry de evento (BullMQ, crash, race) não gera duplo consumo.

CREATE TABLE IF NOT EXISTS supply.procedure_consumption_log (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  encounter_id        UUID        REFERENCES clinical.encounters (id)        ON DELETE SET NULL,
  protocol_session_id UUID        REFERENCES clinical.protocol_sessions (id) ON DELETE SET NULL,
  kit_template_id     UUID        REFERENCES supply.kit_templates (id)       ON DELETE SET NULL,
  source              TEXT        NOT NULL CHECK (source IN ('encounter','protocol_session','manual','offline_sync')),
  status              TEXT        NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed','partial','skipped','failed')),
  items_consumed      INT         NOT NULL DEFAULT 0,
  items_pending       INT         NOT NULL DEFAULT 0,
  performed_by        UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  performed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key     TEXT        NOT NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_consumption_idempotency UNIQUE (clinic_id, idempotency_key),
  CONSTRAINT chk_consumption_reference CHECK (
    encounter_id IS NOT NULL OR protocol_session_id IS NOT NULL OR source IN ('manual','offline_sync')
  )
);

CREATE INDEX IF NOT EXISTS idx_consumption_log_clinic_time
  ON supply.procedure_consumption_log (clinic_id, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_consumption_log_encounter
  ON supply.procedure_consumption_log (encounter_id)
  WHERE encounter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_consumption_log_session
  ON supply.procedure_consumption_log (protocol_session_id)
  WHERE protocol_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_consumption_log_status_pending
  ON supply.procedure_consumption_log (clinic_id, status)
  WHERE status = 'partial' AND items_pending > 0;

-- ─── supply.consumption_pending_items ────────────────────────────────────────
-- Itens que não puderam ser consumidos por falta de estoque no momento
-- do procedimento. Conciliados posteriormente (quando chega estoque ou
-- um usuário registra manualmente).

CREATE TABLE IF NOT EXISTS supply.consumption_pending_items (
  id                       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id                UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  consumption_log_id       UUID        NOT NULL REFERENCES supply.procedure_consumption_log (id) ON DELETE CASCADE,
  product_id               UUID        NOT NULL REFERENCES supply.products (id) ON DELETE RESTRICT,
  quantity_missing         DECIMAL(10,3) NOT NULL,
  quantity_required        DECIMAL(10,3) NOT NULL,
  reconciled_at            TIMESTAMPTZ,
  reconciled_by            UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  reconciliation_notes     TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_pending_qty CHECK (quantity_missing > 0 AND quantity_required > 0)
);

CREATE INDEX IF NOT EXISTS idx_pending_items_consumption
  ON supply.consumption_pending_items (consumption_log_id);

CREATE INDEX IF NOT EXISTS idx_pending_items_open
  ON supply.consumption_pending_items (clinic_id, product_id)
  WHERE reconciled_at IS NULL;

-- ─── supply.traceability_reports ─────────────────────────────────────────────
-- Referência a PDFs gerados para vigilância sanitária / recall.
-- Conteúdo vive no MinIO bucket 'reports'; hash SHA-256 garante integridade.

CREATE TABLE IF NOT EXISTS supply.traceability_reports (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  report_type       TEXT        NOT NULL CHECK (report_type IN ('recall_by_lot','recall_by_patient')),
  scope_lot_id      UUID        REFERENCES supply.inventory_lots (id) ON DELETE SET NULL,
  scope_patient_id  UUID        REFERENCES shared.patients (id)      ON DELETE SET NULL,
  scope_product_id  UUID        REFERENCES supply.products (id)      ON DELETE SET NULL,
  object_key        TEXT        NOT NULL,
  sha256_hex        TEXT        NOT NULL,
  size_bytes        BIGINT      NOT NULL,
  generated_by      UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata          JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_report_scope CHECK (
    (report_type = 'recall_by_lot'     AND scope_lot_id     IS NOT NULL) OR
    (report_type = 'recall_by_patient' AND scope_patient_id IS NOT NULL)
  ),
  CONSTRAINT chk_sha256_format CHECK (sha256_hex ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_traceability_reports_clinic_time
  ON supply.traceability_reports (clinic_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_traceability_reports_lot
  ON supply.traceability_reports (scope_lot_id) WHERE scope_lot_id IS NOT NULL;

-- ─── supply.traceability_access_log ──────────────────────────────────────────
-- Audit específico de consultas de rastreabilidade (quem consultou qual lote
-- ou qual paciente). Requerido pela regulação: dados sensíveis cruzando
-- múltiplos pacientes em consultas de recall.

CREATE TABLE IF NOT EXISTS supply.traceability_access_log (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  user_id     UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  action      TEXT        NOT NULL CHECK (action IN ('query_by_lot','query_by_patient','generate_report','download_report')),
  lot_id      UUID        REFERENCES supply.inventory_lots (id) ON DELETE SET NULL,
  patient_id  UUID        REFERENCES shared.patients (id)       ON DELETE SET NULL,
  report_id   UUID        REFERENCES supply.traceability_reports (id) ON DELETE SET NULL,
  ip_origin   INET,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trace_access_clinic_time
  ON supply.traceability_access_log (clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trace_access_user
  ON supply.traceability_access_log (clinic_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trace_access_lot
  ON supply.traceability_access_log (lot_id) WHERE lot_id IS NOT NULL;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE supply.procedure_consumption_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply.consumption_pending_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply.traceability_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply.traceability_access_log    ENABLE ROW LEVEL SECURITY;

ALTER TABLE supply.procedure_consumption_log  FORCE ROW LEVEL SECURITY;
ALTER TABLE supply.consumption_pending_items  FORCE ROW LEVEL SECURITY;
ALTER TABLE supply.traceability_reports       FORCE ROW LEVEL SECURITY;
ALTER TABLE supply.traceability_access_log    FORCE ROW LEVEL SECURITY;

CREATE POLICY consumption_log_app ON supply.procedure_consumption_log
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY consumption_log_ro  ON supply.procedure_consumption_log
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY consumption_log_wkr ON supply.procedure_consumption_log
  FOR ALL TO dermaos_worker  USING (TRUE);

CREATE POLICY pending_items_app ON supply.consumption_pending_items
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY pending_items_ro  ON supply.consumption_pending_items
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY pending_items_wkr ON supply.consumption_pending_items
  FOR ALL TO dermaos_worker  USING (TRUE);

CREATE POLICY trace_reports_app ON supply.traceability_reports
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY trace_reports_ro  ON supply.traceability_reports
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY trace_reports_wkr ON supply.traceability_reports
  FOR ALL TO dermaos_worker  USING (TRUE);

CREATE POLICY trace_access_app ON supply.traceability_access_log
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY trace_access_ro  ON supply.traceability_access_log
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY trace_access_wkr ON supply.traceability_access_log
  FOR ALL TO dermaos_worker  USING (TRUE);

-- ─── Grants ──────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON supply.procedure_consumption_log TO dermaos_app;
GRANT SELECT                          ON supply.procedure_consumption_log TO dermaos_readonly;
GRANT SELECT, INSERT, UPDATE          ON supply.procedure_consumption_log TO dermaos_worker;
GRANT ALL                             ON supply.procedure_consumption_log TO dermaos_admin;

GRANT SELECT, INSERT, UPDATE, DELETE ON supply.consumption_pending_items TO dermaos_app;
GRANT SELECT                          ON supply.consumption_pending_items TO dermaos_readonly;
GRANT SELECT, INSERT, UPDATE          ON supply.consumption_pending_items TO dermaos_worker;
GRANT ALL                             ON supply.consumption_pending_items TO dermaos_admin;

GRANT SELECT, INSERT, UPDATE, DELETE ON supply.traceability_reports TO dermaos_app;
GRANT SELECT                          ON supply.traceability_reports TO dermaos_readonly;
GRANT SELECT, INSERT, UPDATE          ON supply.traceability_reports TO dermaos_worker;
GRANT ALL                             ON supply.traceability_reports TO dermaos_admin;

GRANT SELECT, INSERT                  ON supply.traceability_access_log TO dermaos_app;
GRANT SELECT                          ON supply.traceability_access_log TO dermaos_readonly;
GRANT SELECT, INSERT                  ON supply.traceability_access_log TO dermaos_worker;
GRANT ALL                             ON supply.traceability_access_log TO dermaos_admin;

-- ─── Comentários ─────────────────────────────────────────────────────────────

COMMENT ON COLUMN supply.kit_templates.procedure_type_id IS 'Tipo de procedimento (shared.services) ao qual o kit está vinculado. Máximo 1 kit ativo por procedimento por clínica.';
COMMENT ON COLUMN supply.kit_templates.version           IS 'Versão incremental. Edição em kit com consumos históricos cria nova versão.';
COMMENT ON COLUMN supply.kit_templates.parent_kit_id     IS 'Aponta para a versão anterior (chain de versões).';
COMMENT ON COLUMN supply.kit_templates.status            IS 'active (em uso) | superseded (substituído por versão nova) | archived (desativado).';

COMMENT ON COLUMN supply.kit_items.is_optional           IS 'Item opcional: consumo sem esse item não gera alerta de incompletude.';

COMMENT ON TABLE  supply.procedure_consumption_log       IS 'Log idempotente de consumos por procedimento. UNIQUE (clinic_id, idempotency_key) previne reprocessamento.';
COMMENT ON TABLE  supply.consumption_pending_items       IS 'Itens faltantes no consumo por ruptura de estoque — aguardam conciliação.';
COMMENT ON TABLE  supply.traceability_reports            IS 'PDFs de recall armazenados no MinIO; sha256_hex garante integridade.';
COMMENT ON TABLE  supply.traceability_access_log         IS 'Audit específico de consultas de rastreabilidade (recall = PII cross-patient).';
