-- ============================================================================
-- DermaOS — Supply Purchase Flow (Prompt 13)
-- Fluxo completo de compras: sugestão automática, requisição, aprovação,
-- envio ao fornecedor e recebimento com máquina de estados estrita.
-- ============================================================================

-- ─── Extensão dos ENUMs existentes ────────────────────────────────────────
-- ALTER TYPE ADD VALUE não pode ocorrer dentro de um bloco de transação que
-- já tocou o tipo; usamos IF NOT EXISTS para idempotência.

ALTER TYPE supply.order_status  ADD VALUE IF NOT EXISTS 'pendente_aprovacao';
ALTER TYPE supply.order_status  ADD VALUE IF NOT EXISTS 'aprovado';
ALTER TYPE supply.order_status  ADD VALUE IF NOT EXISTS 'rejeitado';
ALTER TYPE supply.order_status  ADD VALUE IF NOT EXISTS 'devolvido';
ALTER TYPE supply.order_urgency ADD VALUE IF NOT EXISTS 'emergencia';

-- ─── Colunas adicionais em purchase_orders ────────────────────────────────

ALTER TABLE supply.purchase_orders
  ADD COLUMN IF NOT EXISTS submitted_by     UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by      TEXT,         -- UUID ou literal 'system_auto'
  ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by      UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS returned_by      UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS returned_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_reason    TEXT,
  ADD COLUMN IF NOT EXISTS sent_by          UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_approved    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;

-- Índice para soft-delete
CREATE INDEX IF NOT EXISTS idx_purchase_orders_active
  ON supply.purchase_orders (clinic_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

-- ─── Histórico de transições de status ────────────────────────────────────

CREATE TABLE IF NOT EXISTS supply.purchase_order_status_history (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  purchase_order_id UUID        NOT NULL REFERENCES supply.purchase_orders (id) ON DELETE CASCADE,
  from_status       supply.order_status,               -- NULL na criação inicial
  to_status         supply.order_status NOT NULL,
  changed_by        UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  changed_by_label  TEXT,                              -- 'system_auto' para aprovação automática
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_status_history_order
  ON supply.purchase_order_status_history (purchase_order_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_po_status_history_clinic
  ON supply.purchase_order_status_history (clinic_id, changed_at DESC);

-- ─── Recibos NF-e ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS supply.nfe_receipts (
  id                       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id                UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  purchase_order_id        UUID        NOT NULL REFERENCES supply.purchase_orders (id) ON DELETE CASCADE,
  nf_number                TEXT        NOT NULL,
  nf_series                TEXT,
  issuer_cnpj              TEXT,
  cnpj_divergent           BOOLEAN     NOT NULL DEFAULT FALSE,
  cnpj_divergence_reason   TEXT,
  issue_date               DATE,
  receipt_items            JSONB       NOT NULL DEFAULT '[]',
  xml_hash                 TEXT,                              -- SHA-256 do XML original para auditoria
  divergence_justification TEXT,
  received_by              UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  received_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status                   TEXT        NOT NULL DEFAULT 'confirmado'
                             CHECK (status IN ('confirmado', 'recusado')),
  refusal_reason           TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfe_receipts_order
  ON supply.nfe_receipts (purchase_order_id);

CREATE INDEX IF NOT EXISTS idx_nfe_receipts_clinic
  ON supply.nfe_receipts (clinic_id, received_at DESC);

-- ─── Configurações de compra por tenant ───────────────────────────────────

CREATE TABLE IF NOT EXISTS supply.tenant_purchase_settings (
  clinic_id                 UUID PRIMARY KEY REFERENCES shared.clinics (id) ON DELETE CASCADE,
  auto_approval_threshold   DECIMAL(12, 2) NOT NULL DEFAULT 1000.00,
  divergence_tolerance_pct  DECIMAL(5, 2)  NOT NULL DEFAULT 10.00,
  divergence_supervisor_pct DECIMAL(5, 2)  NOT NULL DEFAULT 30.00,
  order_number_prefix       TEXT           NOT NULL DEFAULT 'PO',
  last_order_seq            INT            NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_approval_threshold    CHECK (auto_approval_threshold   >= 0),
  CONSTRAINT chk_div_tolerance         CHECK (divergence_tolerance_pct  BETWEEN 0 AND 100),
  CONSTRAINT chk_div_supervisor        CHECK (divergence_supervisor_pct BETWEEN 0 AND 100),
  CONSTRAINT chk_supervisor_gte_tol    CHECK (divergence_supervisor_pct >= divergence_tolerance_pct)
);

-- Seed: garante uma linha de configuração para cada clínica existente
INSERT INTO supply.tenant_purchase_settings (clinic_id)
SELECT id FROM shared.clinics
ON CONFLICT (clinic_id) DO NOTHING;

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE supply.purchase_order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply.nfe_receipts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply.tenant_purchase_settings      ENABLE ROW LEVEL SECURITY;

ALTER TABLE supply.purchase_order_status_history FORCE ROW LEVEL SECURITY;
ALTER TABLE supply.nfe_receipts                  FORCE ROW LEVEL SECURITY;
ALTER TABLE supply.tenant_purchase_settings      FORCE ROW LEVEL SECURITY;

-- purchase_order_status_history
CREATE POLICY posh_app ON supply.purchase_order_status_history
  FOR ALL TO dermaos_app     USING (clinic_id = shared.current_clinic_id());
CREATE POLICY posh_ro  ON supply.purchase_order_status_history
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY posh_wkr ON supply.purchase_order_status_history
  FOR ALL TO dermaos_worker  USING (TRUE);

-- nfe_receipts
CREATE POLICY nfe_app ON supply.nfe_receipts
  FOR ALL TO dermaos_app     USING (clinic_id = shared.current_clinic_id());
CREATE POLICY nfe_ro  ON supply.nfe_receipts
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY nfe_wkr ON supply.nfe_receipts
  FOR ALL TO dermaos_worker  USING (TRUE);

-- tenant_purchase_settings
CREATE POLICY tps_app ON supply.tenant_purchase_settings
  FOR ALL TO dermaos_app     USING (clinic_id = shared.current_clinic_id());
CREATE POLICY tps_ro  ON supply.tenant_purchase_settings
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY tps_wkr ON supply.tenant_purchase_settings
  FOR ALL TO dermaos_worker  USING (TRUE);

-- ─── Grants ──────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON supply.purchase_order_status_history TO dermaos_app;
GRANT SELECT                          ON supply.purchase_order_status_history TO dermaos_readonly;
GRANT SELECT, INSERT, UPDATE          ON supply.purchase_order_status_history TO dermaos_worker;
GRANT ALL                             ON supply.purchase_order_status_history TO dermaos_admin;

GRANT SELECT, INSERT, UPDATE, DELETE ON supply.nfe_receipts TO dermaos_app;
GRANT SELECT                          ON supply.nfe_receipts TO dermaos_readonly;
GRANT SELECT, INSERT, UPDATE          ON supply.nfe_receipts TO dermaos_worker;
GRANT ALL                             ON supply.nfe_receipts TO dermaos_admin;

GRANT SELECT, INSERT, UPDATE, DELETE ON supply.tenant_purchase_settings TO dermaos_app;
GRANT SELECT                          ON supply.tenant_purchase_settings TO dermaos_readonly;
GRANT SELECT, INSERT, UPDATE          ON supply.tenant_purchase_settings TO dermaos_worker;
GRANT ALL                             ON supply.tenant_purchase_settings TO dermaos_admin;

-- ─── Triggers updated_at ─────────────────────────────────────────────────────

CREATE TRIGGER trg_nfe_receipts_updated_at
  BEFORE UPDATE ON supply.nfe_receipts
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_tenant_purchase_settings_updated_at
  BEFORE UPDATE ON supply.tenant_purchase_settings
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();
