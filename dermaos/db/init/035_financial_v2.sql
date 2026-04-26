-- ============================================================================
-- DermaOS — Financial v2
-- • Converte money columns para BIGINT (centavos) — elimina float imprecision
-- • Adiciona audit trail completo (updated_by, ip_origin, deleted_at)
-- • Adiciona colunas de desconto estruturado (type, reason, approved_by)
-- • Expande payments para estornos e detalhes por método
-- • Cria service_price_history, invoice_sequences, financial_config
-- ============================================================================

-- ─── Novos valores no ENUM invoice_status ────────────────────────────────────
-- 'emitida' é o status após rascunho (substitui semanticamente 'enviada')
-- 'parcial'  é pagamento parcial (substitui semanticamente 'parcialmente_paga')
ALTER TYPE financial.invoice_status ADD VALUE IF NOT EXISTS 'emitida';
ALTER TYPE financial.invoice_status ADD VALUE IF NOT EXISTS 'parcial';

-- ─── financial.service_catalog — centavos + audit ────────────────────────────

-- Converter price DECIMAL → BIGINT centavos (ex: 150.00 → 15000)
ALTER TABLE financial.service_catalog
  ALTER COLUMN price TYPE BIGINT USING ROUND(price * 100)::BIGINT;

-- Audit + soft-delete
ALTER TABLE financial.service_catalog
  ADD COLUMN IF NOT EXISTS updated_by  UUID REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;

-- ─── financial.invoices — centavos + audit + desconto + soft-delete ──────────

-- A coluna gerada amount_due impede ALTER TYPE nas colunas base.
-- Deve ser dropped primeiro e re-criada após conversão.
ALTER TABLE financial.invoices DROP COLUMN IF EXISTS amount_due;

ALTER TABLE financial.invoices
  ALTER COLUMN subtotal       TYPE BIGINT USING ROUND(subtotal       * 100)::BIGINT,
  ALTER COLUMN discount_amount TYPE BIGINT USING ROUND(discount_amount * 100)::BIGINT,
  ALTER COLUMN total_amount   TYPE BIGINT USING ROUND(total_amount   * 100)::BIGINT,
  ALTER COLUMN amount_paid    TYPE BIGINT USING ROUND(amount_paid    * 100)::BIGINT;

-- discount_pct: convertido para integer (0–10000 basis-points, 100% = 10000)
ALTER TABLE financial.invoices
  ALTER COLUMN discount_pct TYPE INTEGER USING ROUND(discount_pct * 100)::INTEGER;

-- Re-adiciona coluna gerada em centavos
ALTER TABLE financial.invoices
  ADD COLUMN IF NOT EXISTS amount_due BIGINT GENERATED ALWAYS AS (total_amount - amount_paid) STORED;

-- Campos de desconto estruturado
ALTER TABLE financial.invoices
  ADD COLUMN IF NOT EXISTS discount_type        TEXT CHECK (discount_type IN ('absolute','percentage')),
  ADD COLUMN IF NOT EXISTS discount_reason      TEXT,
  ADD COLUMN IF NOT EXISTS discount_approved_by UUID REFERENCES shared.users (id) ON DELETE SET NULL;

-- Audit trail completo
ALTER TABLE financial.invoices
  ADD COLUMN IF NOT EXISTS updated_by  UUID REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ip_origin   TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;

-- ─── financial.invoice_items — centavos ──────────────────────────────────────

ALTER TABLE financial.invoice_items DROP COLUMN IF EXISTS total_price;

ALTER TABLE financial.invoice_items
  ALTER COLUMN quantity        TYPE BIGINT USING ROUND(quantity)::BIGINT,
  ALTER COLUMN unit_price      TYPE BIGINT USING ROUND(unit_price      * 100)::BIGINT,
  ALTER COLUMN discount_amount TYPE BIGINT USING ROUND(discount_amount * 100)::BIGINT;

-- Remove CHECK existente em quantity (era DECIMAL > 0) e recria para BIGINT
ALTER TABLE financial.invoice_items DROP CONSTRAINT IF EXISTS chk_item_qty;
ALTER TABLE financial.invoice_items DROP CONSTRAINT IF EXISTS chk_item_price;
ALTER TABLE financial.invoice_items
  ADD CONSTRAINT chk_item_qty   CHECK (quantity > 0),
  ADD CONSTRAINT chk_item_price CHECK (unit_price >= 0);

-- Re-adiciona coluna gerada
ALTER TABLE financial.invoice_items
  ADD COLUMN IF NOT EXISTS total_price BIGINT GENERATED ALWAYS AS (quantity * unit_price - discount_amount) STORED;

-- ─── financial.payments — centavos + estorno + detalhes por método ───────────

-- Remove CHECK amount > 0 para permitir estorno (amount negativo)
ALTER TABLE financial.payments DROP CONSTRAINT IF EXISTS chk_payment_amount;

ALTER TABLE financial.payments
  ALTER COLUMN amount TYPE BIGINT USING ROUND(amount * 100)::BIGINT;

-- Tipo de lançamento + estorno
ALTER TABLE financial.payments
  ADD COLUMN IF NOT EXISTS payment_type   TEXT NOT NULL DEFAULT 'pagamento'
                             CHECK (payment_type IN ('pagamento','estorno')),
  ADD COLUMN IF NOT EXISTS refund_reason  TEXT,
  ADD COLUMN IF NOT EXISTS refund_of_id   UUID REFERENCES financial.payments (id) ON DELETE SET NULL;

-- Detalhes por método de pagamento
ALTER TABLE financial.payments
  ADD COLUMN IF NOT EXISTS card_brand        TEXT,
  ADD COLUMN IF NOT EXISTS card_last4        TEXT,
  ADD COLUMN IF NOT EXISTS card_installments INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pix_txid          TEXT,
  ADD COLUMN IF NOT EXISTS boleto_barcode    TEXT,
  ADD COLUMN IF NOT EXISTS convenio_name     TEXT,
  ADD COLUMN IF NOT EXISTS convenio_guide    TEXT;

-- Audit trail
ALTER TABLE financial.payments
  ADD COLUMN IF NOT EXISTS registered_by UUID REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ip_origin     TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ;

-- Índice de performance para caixa do dia (paid_at + clinic_id)
CREATE INDEX IF NOT EXISTS idx_payments_clinic_paid_at
  ON financial.payments (clinic_id, received_at)
  WHERE deleted_at IS NULL;

-- ─── financial.service_price_history ─────────────────────────────────────────
-- Guarda histórico de preço do serviço. Faturas históricas referenciam o
-- preço vigente no momento da emissão via unit_price copiado em invoice_items.

CREATE TABLE IF NOT EXISTS financial.service_price_history (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id    UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  service_id   UUID        NOT NULL REFERENCES financial.service_catalog (id) ON DELETE CASCADE,
  price        BIGINT      NOT NULL,  -- centavos
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by   UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sph_service_time
  ON financial.service_price_history (service_id, effective_from DESC);

ALTER TABLE financial.service_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial.service_price_history FORCE ROW LEVEL SECURITY;

CREATE POLICY sph_isolation_app ON financial.service_price_history
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY sph_worker_all ON financial.service_price_history
  FOR ALL TO dermaos_worker USING (true);

GRANT SELECT, INSERT ON financial.service_price_history TO dermaos_app;
GRANT SELECT, INSERT ON financial.service_price_history TO dermaos_worker;
GRANT ALL ON financial.service_price_history TO dermaos_admin;

-- ─── financial.invoice_sequences ─────────────────────────────────────────────
-- Garante números de fatura sequenciais sem gaps em concorrência.
-- SELECT FOR UPDATE nesta tabela garante serialização por clínica+ano.

CREATE TABLE IF NOT EXISTS financial.invoice_sequences (
  clinic_id  UUID    NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  year       INTEGER NOT NULL,
  last_seq   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (clinic_id, year)
);

-- Sem RLS (worker e app precisam de acesso; controle no service layer via tx)
GRANT SELECT, INSERT, UPDATE ON financial.invoice_sequences TO dermaos_app;
GRANT SELECT, INSERT, UPDATE ON financial.invoice_sequences TO dermaos_worker;
GRANT ALL ON financial.invoice_sequences TO dermaos_admin;

-- ─── financial.financial_config ──────────────────────────────────────────────
-- Configuração financeira por tenant: teto de desconto, parcelamento, timezone.

CREATE TABLE IF NOT EXISTS financial.financial_config (
  clinic_id              UUID    PRIMARY KEY REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  timezone               TEXT    NOT NULL DEFAULT 'America/Sao_Paulo',
  max_discount_pct       INTEGER NOT NULL DEFAULT 100,   -- % máxima sem aprovação de admin
  admin_discount_floor   INTEGER NOT NULL DEFAULT 30,    -- acima disto exige aprovação admin
  max_installments       INTEGER NOT NULL DEFAULT 12,
  invoice_prefix         TEXT    NOT NULL DEFAULT 'DRM', -- prefixo no número da fatura
  due_days               INTEGER NOT NULL DEFAULT 30,    -- dias para vencimento padrão
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE financial.financial_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial.financial_config FORCE ROW LEVEL SECURITY;

CREATE POLICY fin_config_isolation_app ON financial.financial_config
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY fin_config_worker_all ON financial.financial_config
  FOR ALL TO dermaos_worker USING (true);

GRANT SELECT, INSERT, UPDATE ON financial.financial_config TO dermaos_app;
GRANT SELECT, INSERT, UPDATE ON financial.financial_config TO dermaos_worker;
GRANT ALL ON financial.financial_config TO dermaos_admin;

CREATE TRIGGER trg_financial_config_updated_at
  BEFORE UPDATE ON financial.financial_config
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();
