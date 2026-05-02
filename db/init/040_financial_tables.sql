-- ============================================================================
-- DermaOS — Financial Schema Tables
-- Financeiro: catálogo de serviços, faturas, itens de fatura, pagamentos
-- e metas financeiras
-- ============================================================================

-- ─── ENUMs ──────────────────────────────────────────────────────────────────

CREATE TYPE financial.invoice_status AS ENUM (
  'rascunho',
  'enviada',
  'paga',
  'parcialmente_paga',
  'vencida',
  'cancelada',
  'estornada'
);

CREATE TYPE financial.payment_method AS ENUM (
  'dinheiro',
  'pix',
  'cartao_credito',
  'cartao_debito',
  'boleto',
  'transferencia',
  'cortesia',
  'plano_saude'
);

CREATE TYPE financial.payment_status AS ENUM (
  'pendente',
  'processando',
  'aprovado',
  'recusado',
  'estornado',
  'expirado'
);

CREATE TYPE financial.period_type AS ENUM (
  'diario',
  'semanal',
  'mensal',
  'trimestral',
  'anual'
);

CREATE TYPE financial.service_category AS ENUM (
  'consulta',
  'procedimento_estetico',
  'procedimento_cirurgico',
  'exame',
  'produto',
  'outro'
);

-- ─── financial.service_catalog ───────────────────────────────────────────────

CREATE TABLE financial.service_catalog (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id    UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  name         TEXT        NOT NULL,
  description  TEXT,
  category     financial.service_category NOT NULL DEFAULT 'consulta',
  tuss_code    TEXT,                                        -- Tabela Unificada de Procedimentos (ANS)
  cbhpm_code   TEXT,                                        -- Classificação Brasileira de Hierarquização
  price        DECIMAL(10, 2) NOT NULL DEFAULT 0,
  duration_min INT         NOT NULL DEFAULT 30,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_service_name_clinic UNIQUE (clinic_id, name)
);

CREATE INDEX idx_service_catalog_clinic_category ON financial.service_catalog (clinic_id, category);
CREATE INDEX idx_service_catalog_active          ON financial.service_catalog (clinic_id) WHERE is_active = TRUE;

-- ─── financial.invoices ──────────────────────────────────────────────────────

CREATE TABLE financial.invoices (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  patient_id          UUID        NOT NULL REFERENCES shared.patients (id) ON DELETE RESTRICT,
  provider_id         UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  appointment_id      UUID        REFERENCES shared.appointments (id) ON DELETE SET NULL,
  invoice_number      TEXT        NOT NULL,
  status              financial.invoice_status NOT NULL DEFAULT 'rascunho',
  issue_date          DATE        NOT NULL DEFAULT CURRENT_DATE,
  due_date            DATE,
  subtotal            DECIMAL(12, 2) NOT NULL DEFAULT 0,
  discount_amount     DECIMAL(12, 2) NOT NULL DEFAULT 0,
  discount_pct        DECIMAL(5, 2)  NOT NULL DEFAULT 0,
  total_amount        DECIMAL(12, 2) NOT NULL DEFAULT 0,
  amount_paid         DECIMAL(12, 2) NOT NULL DEFAULT 0,
  amount_due          DECIMAL(12, 2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  notes               TEXT,
  internal_notes      TEXT,
  nfse_number         TEXT,                                 -- Nota Fiscal de Serviço Eletrônica
  nfse_issued_at      TIMESTAMPTZ,
  nfse_url            TEXT,
  sent_at             TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID        REFERENCES shared.users (id) ON DELETE SET NULL,

  CONSTRAINT uq_invoice_number_clinic UNIQUE (clinic_id, invoice_number),
  CONSTRAINT chk_invoice_amounts CHECK (
    total_amount >= 0 AND amount_paid >= 0 AND
    discount_amount >= 0 AND subtotal >= 0
  )
);

CREATE INDEX idx_invoices_clinic_patient  ON financial.invoices (clinic_id, patient_id);
CREATE INDEX idx_invoices_clinic_status   ON financial.invoices (clinic_id, status);
CREATE INDEX idx_invoices_clinic_date     ON financial.invoices (clinic_id, issue_date DESC);
CREATE INDEX idx_invoices_unpaid          ON financial.invoices (clinic_id, due_date)
  WHERE status NOT IN ('paga', 'cancelada', 'estornada');

-- ─── financial.invoice_items ─────────────────────────────────────────────────

CREATE TABLE financial.invoice_items (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id      UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  invoice_id     UUID        NOT NULL REFERENCES financial.invoices (id) ON DELETE CASCADE,
  service_id     UUID        REFERENCES financial.service_catalog (id) ON DELETE SET NULL,
  description    TEXT        NOT NULL,
  quantity       DECIMAL(8, 3)  NOT NULL DEFAULT 1,
  unit_price     DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_price    DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * unit_price - discount_amount) STORED,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_item_qty   CHECK (quantity > 0),
  CONSTRAINT chk_item_price CHECK (unit_price >= 0)
);

CREATE INDEX idx_invoice_items_invoice_id ON financial.invoice_items (invoice_id);
CREATE INDEX idx_invoice_items_service_id ON financial.invoice_items (service_id) WHERE service_id IS NOT NULL;

-- ─── financial.payments ──────────────────────────────────────────────────────

CREATE TABLE financial.payments (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  invoice_id          UUID        NOT NULL REFERENCES financial.invoices (id) ON DELETE RESTRICT,
  method              financial.payment_method NOT NULL,
  status              financial.payment_status NOT NULL DEFAULT 'pendente',
  amount              DECIMAL(12, 2) NOT NULL,
  received_by         UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  received_at         TIMESTAMPTZ,
  installments        INT         NOT NULL DEFAULT 1,
  installment_number  INT,
  gateway_id          TEXT,                                 -- ID externo do gateway de pagamento
  gateway_response    JSONB       NOT NULL DEFAULT '{}',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_payment_amount       CHECK (amount > 0),
  CONSTRAINT chk_payment_installments CHECK (installments >= 1)
);

CREATE INDEX idx_payments_clinic_invoice    ON financial.payments (clinic_id, invoice_id);
CREATE INDEX idx_payments_clinic_status     ON financial.payments (clinic_id, status);
CREATE INDEX idx_payments_clinic_received   ON financial.payments (clinic_id, received_at DESC)
  WHERE received_at IS NOT NULL;

-- ─── financial.financial_goals ───────────────────────────────────────────────

CREATE TABLE financial.financial_goals (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  user_id             UUID        REFERENCES shared.users (id) ON DELETE SET NULL,  -- NULL = meta da clínica
  period_type         financial.period_type NOT NULL,
  period_start        DATE        NOT NULL,
  period_end          DATE        NOT NULL,
  target_revenue      DECIMAL(12, 2) NOT NULL,
  target_appointments INT,
  target_new_patients INT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID        REFERENCES shared.users (id) ON DELETE SET NULL,

  CONSTRAINT chk_goal_period CHECK (period_end > period_start),
  CONSTRAINT uq_goal_period_user UNIQUE (clinic_id, user_id, period_type, period_start)
);

CREATE INDEX idx_financial_goals_clinic_id ON financial.financial_goals (clinic_id);
CREATE INDEX idx_financial_goals_period    ON financial.financial_goals (clinic_id, period_start, period_end);

-- ─── Row-Level Security ──────────────────────────────────────────────────────

ALTER TABLE financial.service_catalog   ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial.invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial.invoice_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial.payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial.financial_goals   ENABLE ROW LEVEL SECURITY;

ALTER TABLE financial.service_catalog   FORCE ROW LEVEL SECURITY;
ALTER TABLE financial.invoices          FORCE ROW LEVEL SECURITY;
ALTER TABLE financial.invoice_items     FORCE ROW LEVEL SECURITY;
ALTER TABLE financial.payments          FORCE ROW LEVEL SECURITY;
ALTER TABLE financial.financial_goals   FORCE ROW LEVEL SECURITY;

-- service_catalog
CREATE POLICY service_catalog_isolation_app ON financial.service_catalog
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY service_catalog_isolation_readonly ON financial.service_catalog
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY service_catalog_worker_all ON financial.service_catalog
  FOR ALL TO dermaos_worker USING (true);

-- invoices
CREATE POLICY invoices_isolation_app ON financial.invoices
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY invoices_isolation_readonly ON financial.invoices
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY invoices_worker_all ON financial.invoices
  FOR ALL TO dermaos_worker USING (true);

-- invoice_items
CREATE POLICY invoice_items_isolation_app ON financial.invoice_items
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY invoice_items_isolation_readonly ON financial.invoice_items
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY invoice_items_worker_all ON financial.invoice_items
  FOR ALL TO dermaos_worker USING (true);

-- payments
CREATE POLICY payments_isolation_app ON financial.payments
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY payments_isolation_readonly ON financial.payments
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY payments_worker_all ON financial.payments
  FOR ALL TO dermaos_worker USING (true);

-- financial_goals
CREATE POLICY financial_goals_isolation_app ON financial.financial_goals
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY financial_goals_isolation_readonly ON financial.financial_goals
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY financial_goals_worker_all ON financial.financial_goals
  FOR ALL TO dermaos_worker USING (true);

-- ─── Grants ──────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA financial TO dermaos_app;
GRANT SELECT ON ALL TABLES IN SCHEMA financial TO dermaos_readonly;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA financial TO dermaos_worker;
GRANT ALL ON ALL TABLES IN SCHEMA financial TO dermaos_admin;

-- ─── Triggers updated_at ─────────────────────────────────────────────────────

CREATE TRIGGER trg_service_catalog_updated_at
  BEFORE UPDATE ON financial.service_catalog
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON financial.invoices
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_invoice_items_updated_at
  BEFORE UPDATE ON financial.invoice_items
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON financial.payments
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_financial_goals_updated_at
  BEFORE UPDATE ON financial.financial_goals
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

-- ─── Soft-delete columns (used by services) ──────────────────────────────────
ALTER TABLE financial.invoices      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE financial.invoice_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE financial.payments      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON financial.invoices(deleted_at) WHERE deleted_at IS NULL;
