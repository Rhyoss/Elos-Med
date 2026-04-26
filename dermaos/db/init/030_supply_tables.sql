-- ============================================================================
-- DermaOS — Supply Schema Tables
-- Gestão de insumos: categorias, produtos, fornecedores, estoque, kits,
-- pedidos de compra e rastreabilidade ANVISA
-- ============================================================================

-- ─── ENUMs ──────────────────────────────────────────────────────────────────

CREATE TYPE supply.storage_type AS ENUM (
  'geladeira',
  'freezer',
  'temperatura_ambiente',
  'controlado',
  'descartavel'
);

CREATE TYPE supply.movement_type AS ENUM (
  'entrada',
  'saida',
  'ajuste',
  'perda',
  'vencimento',
  'transferencia',
  'uso_paciente'
);

CREATE TYPE supply.movement_reference_type AS ENUM (
  'purchase_order',
  'appointment',
  'protocol_session',
  'manual',
  'inventory_count'
);

CREATE TYPE supply.order_status AS ENUM (
  'rascunho',
  'enviado',
  'confirmado',
  'parcialmente_recebido',
  'recebido',
  'cancelado'
);

CREATE TYPE supply.order_urgency AS ENUM (
  'normal',
  'urgente',
  'critico'
);

-- ─── supply.categories ───────────────────────────────────────────────────────

CREATE TABLE supply.categories (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  parent_id   UUID        REFERENCES supply.categories (id) ON DELETE SET NULL,
  name        TEXT        NOT NULL,
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_category_name_parent UNIQUE (clinic_id, parent_id, name)
);

CREATE INDEX idx_categories_clinic_id ON supply.categories (clinic_id);
CREATE INDEX idx_categories_parent_id ON supply.categories (parent_id) WHERE parent_id IS NOT NULL;

-- ─── supply.suppliers ────────────────────────────────────────────────────────

CREATE TABLE supply.suppliers (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  name            TEXT        NOT NULL,
  cnpj            TEXT,
  contact_name    TEXT,
  phone           TEXT,
  email           TEXT,
  address         JSONB       NOT NULL DEFAULT '{}',
  payment_terms   TEXT,
  lead_time_days  INT,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_supplier_name_clinic UNIQUE (clinic_id, name)
);

CREATE INDEX idx_suppliers_clinic_id ON supply.suppliers (clinic_id);
CREATE INDEX idx_suppliers_active    ON supply.suppliers (clinic_id) WHERE is_active = TRUE;

-- ─── supply.storage_locations ─────────────────────────────────────────────────

CREATE TABLE supply.storage_locations (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  name        TEXT        NOT NULL,
  type        supply.storage_type NOT NULL DEFAULT 'temperatura_ambiente',
  description TEXT,
  min_temp_c  DECIMAL(5, 2),
  max_temp_c  DECIMAL(5, 2),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_storage_name_clinic UNIQUE (clinic_id, name)
);

CREATE INDEX idx_storage_locations_clinic_id ON supply.storage_locations (clinic_id);

-- ─── supply.products ─────────────────────────────────────────────────────────

CREATE TABLE supply.products (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id             UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  category_id           UUID        REFERENCES supply.categories (id) ON DELETE SET NULL,
  preferred_supplier_id UUID        REFERENCES supply.suppliers (id) ON DELETE SET NULL,
  name                  TEXT        NOT NULL,
  description           TEXT,
  sku                   TEXT,
  barcode               TEXT,
  unit                  TEXT        NOT NULL DEFAULT 'unidade',   -- 'ml','mg','ampola','frasco'
  unit_cost             DECIMAL(10, 4),
  markup_pct            DECIMAL(5, 2),
  requires_prescription BOOLEAN     NOT NULL DEFAULT FALSE,
  is_controlled         BOOLEAN     NOT NULL DEFAULT FALSE,       -- substância controlada ANVISA
  is_consumable         BOOLEAN     NOT NULL DEFAULT TRUE,
  min_stock             DECIMAL(10, 3) NOT NULL DEFAULT 0,
  max_stock             DECIMAL(10, 3),
  reorder_point         DECIMAL(10, 3),
  anvisa_registration   TEXT,
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_product_sku_clinic UNIQUE (clinic_id, sku)
);

CREATE INDEX idx_products_clinic_category ON supply.products (clinic_id, category_id);
CREATE INDEX idx_products_clinic_active   ON supply.products (clinic_id) WHERE is_active = TRUE;
CREATE INDEX idx_products_low_stock       ON supply.products (clinic_id, reorder_point) WHERE is_active = TRUE;
CREATE INDEX idx_products_name_search     ON supply.products USING gin (name gin_trgm_ops);

-- ─── supply.purchase_orders ───────────────────────────────────────────────────

CREATE TABLE supply.purchase_orders (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id        UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  supplier_id      UUID        NOT NULL REFERENCES supply.suppliers (id) ON DELETE RESTRICT,
  status           supply.order_status   NOT NULL DEFAULT 'rascunho',
  urgency          supply.order_urgency  NOT NULL DEFAULT 'normal',
  order_number     TEXT,
  notes            TEXT,
  expected_delivery DATE,
  delivered_at     TIMESTAMPTZ,
  total_amount     DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID        REFERENCES shared.users (id) ON DELETE SET NULL,

  CONSTRAINT uq_order_number_clinic UNIQUE (clinic_id, order_number)
);

CREATE INDEX idx_purchase_orders_clinic_supplier ON supply.purchase_orders (clinic_id, supplier_id);
CREATE INDEX idx_purchase_orders_clinic_status   ON supply.purchase_orders (clinic_id, status);

-- ─── supply.purchase_order_items ─────────────────────────────────────────────

CREATE TABLE supply.purchase_order_items (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  purchase_order_id UUID        NOT NULL REFERENCES supply.purchase_orders (id) ON DELETE CASCADE,
  product_id        UUID        NOT NULL REFERENCES supply.products (id) ON DELETE RESTRICT,
  quantity_ordered  DECIMAL(10, 3) NOT NULL,
  quantity_received DECIMAL(10, 3) NOT NULL DEFAULT 0,
  unit_cost         DECIMAL(10, 4) NOT NULL,
  total_cost        DECIMAL(12, 2) GENERATED ALWAYS AS (quantity_ordered * unit_cost) STORED,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_poi_qty_ordered   CHECK (quantity_ordered > 0),
  CONSTRAINT chk_poi_qty_received  CHECK (quantity_received >= 0)
);

CREATE INDEX idx_purchase_order_items_order_id   ON supply.purchase_order_items (purchase_order_id);
CREATE INDEX idx_purchase_order_items_product_id ON supply.purchase_order_items (product_id);

-- ─── supply.inventory_lots ───────────────────────────────────────────────────

CREATE TABLE supply.inventory_lots (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id              UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  product_id             UUID        NOT NULL REFERENCES supply.products (id) ON DELETE RESTRICT,
  storage_location_id    UUID        REFERENCES supply.storage_locations (id) ON DELETE SET NULL,
  purchase_order_item_id UUID        REFERENCES supply.purchase_order_items (id) ON DELETE SET NULL,
  lot_number             TEXT        NOT NULL,
  batch_number           TEXT,
  expiry_date            DATE,
  manufactured_date      DATE,
  quantity_initial       DECIMAL(10, 3) NOT NULL,
  quantity_current       DECIMAL(10, 3) NOT NULL,
  unit_cost              DECIMAL(10, 4),
  received_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_quarantined         BOOLEAN     NOT NULL DEFAULT FALSE,
  quarantine_reason      TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_lot_qty_current CHECK (quantity_current >= 0),
  CONSTRAINT chk_lot_qty_initial CHECK (quantity_initial > 0),
  CONSTRAINT uq_lot_number_product UNIQUE (clinic_id, product_id, lot_number)
);

CREATE INDEX idx_inventory_lots_clinic_product ON supply.inventory_lots (clinic_id, product_id);
CREATE INDEX idx_inventory_lots_expiry         ON supply.inventory_lots (clinic_id, expiry_date) WHERE expiry_date IS NOT NULL;
-- Índice parcial para busca de lotes disponíveis (FEFO — First Expired First Out)
CREATE INDEX idx_inventory_lots_available      ON supply.inventory_lots (clinic_id, product_id, expiry_date)
  WHERE quantity_current > 0 AND is_quarantined = FALSE;

-- ─── supply.inventory_movements ──────────────────────────────────────────────
-- Registro imutável: histórico completo de movimentações de estoque

CREATE TABLE supply.inventory_movements (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  product_id      UUID        NOT NULL REFERENCES supply.products (id) ON DELETE RESTRICT,
  lot_id          UUID        REFERENCES supply.inventory_lots (id) ON DELETE SET NULL,
  type            supply.movement_type           NOT NULL,
  reference_type  supply.movement_reference_type,
  reference_id    UUID,                                    -- ID polimórfico do documento gerador
  quantity        DECIMAL(10, 3) NOT NULL,
  quantity_before DECIMAL(10, 3) NOT NULL,
  quantity_after  DECIMAL(10, 3) NOT NULL,
  unit_cost       DECIMAL(10, 4),
  notes           TEXT,
  performed_by    UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  performed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_movement_qty CHECK (quantity > 0)
  -- Sem updated_at: movimentações são imutáveis para garantir integridade do histórico
);

CREATE INDEX idx_inventory_movements_clinic_product ON supply.inventory_movements (clinic_id, product_id);
CREATE INDEX idx_inventory_movements_lot_id         ON supply.inventory_movements (lot_id) WHERE lot_id IS NOT NULL;
CREATE INDEX idx_inventory_movements_clinic_date    ON supply.inventory_movements (clinic_id, performed_at DESC);
CREATE INDEX idx_inventory_movements_reference      ON supply.inventory_movements (reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- ─── supply.kit_templates ────────────────────────────────────────────────────

CREATE TABLE supply.kit_templates (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  name        TEXT        NOT NULL,
  description TEXT,
  service_id  UUID        REFERENCES shared.services (id) ON DELETE SET NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID        REFERENCES shared.users (id) ON DELETE SET NULL,

  CONSTRAINT uq_kit_name_clinic UNIQUE (clinic_id, name)
);

CREATE INDEX idx_kit_templates_clinic_id  ON supply.kit_templates (clinic_id);
CREATE INDEX idx_kit_templates_service_id ON supply.kit_templates (service_id) WHERE service_id IS NOT NULL;

-- ─── supply.kit_items ────────────────────────────────────────────────────────

CREATE TABLE supply.kit_items (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  kit_template_id UUID        NOT NULL REFERENCES supply.kit_templates (id) ON DELETE CASCADE,
  product_id      UUID        NOT NULL REFERENCES supply.products (id) ON DELETE RESTRICT,
  quantity        DECIMAL(10, 3) NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_kit_product UNIQUE (kit_template_id, product_id),
  CONSTRAINT chk_kit_item_qty CHECK (quantity > 0)
);

CREATE INDEX idx_kit_items_template_id ON supply.kit_items (kit_template_id);
CREATE INDEX idx_kit_items_product_id  ON supply.kit_items (product_id);

-- ─── supply.patient_lot_traces ───────────────────────────────────────────────
-- Rastreabilidade ANVISA: qual lote foi aplicado em qual paciente
-- FKs cross-schema para clinical.encounters e clinical.protocol_sessions

CREATE TABLE supply.patient_lot_traces (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID        NOT NULL REFERENCES shared.clinics (id) ON DELETE RESTRICT,
  patient_id          UUID        NOT NULL REFERENCES shared.patients (id) ON DELETE RESTRICT,
  lot_id              UUID        NOT NULL REFERENCES supply.inventory_lots (id) ON DELETE RESTRICT,
  encounter_id        UUID        REFERENCES clinical.encounters (id) ON DELETE SET NULL,
  protocol_session_id UUID        REFERENCES clinical.protocol_sessions (id) ON DELETE SET NULL,
  quantity_used       DECIMAL(10, 3) NOT NULL,
  applied_by          UUID        REFERENCES shared.users (id) ON DELETE SET NULL,
  applied_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_trace_qty_used CHECK (quantity_used > 0)
  -- Sem updated_at: registro de rastreabilidade é imutável por exigência ANVISA
);

CREATE INDEX idx_patient_lot_traces_clinic_patient ON supply.patient_lot_traces (clinic_id, patient_id);
CREATE INDEX idx_patient_lot_traces_lot_id         ON supply.patient_lot_traces (lot_id);
CREATE INDEX idx_patient_lot_traces_encounter_id   ON supply.patient_lot_traces (encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX idx_patient_lot_traces_protocol       ON supply.patient_lot_traces (protocol_session_id) WHERE protocol_session_id IS NOT NULL;

-- ─── Row-Level Security ──────────────────────────────────────────────────────

ALTER TABLE supply.categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply.suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply.storage_locations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply.products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply.purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply.inventory_lots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply.inventory_movements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply.kit_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply.kit_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply.patient_lot_traces   ENABLE ROW LEVEL SECURITY;

ALTER TABLE supply.categories           FORCE ROW LEVEL SECURITY;
ALTER TABLE supply.suppliers            FORCE ROW LEVEL SECURITY;
ALTER TABLE supply.storage_locations    FORCE ROW LEVEL SECURITY;
ALTER TABLE supply.products             FORCE ROW LEVEL SECURITY;
ALTER TABLE supply.purchase_orders      FORCE ROW LEVEL SECURITY;
ALTER TABLE supply.purchase_order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE supply.inventory_lots       FORCE ROW LEVEL SECURITY;
ALTER TABLE supply.inventory_movements  FORCE ROW LEVEL SECURITY;
ALTER TABLE supply.kit_templates        FORCE ROW LEVEL SECURITY;
ALTER TABLE supply.kit_items            FORCE ROW LEVEL SECURITY;
ALTER TABLE supply.patient_lot_traces   FORCE ROW LEVEL SECURITY;

-- categories
CREATE POLICY categories_isolation_app ON supply.categories
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY categories_isolation_readonly ON supply.categories
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY categories_worker_all ON supply.categories
  FOR ALL TO dermaos_worker USING (true);

-- suppliers
CREATE POLICY suppliers_isolation_app ON supply.suppliers
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY suppliers_isolation_readonly ON supply.suppliers
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY suppliers_worker_all ON supply.suppliers
  FOR ALL TO dermaos_worker USING (true);

-- storage_locations
CREATE POLICY storage_locations_isolation_app ON supply.storage_locations
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY storage_locations_isolation_readonly ON supply.storage_locations
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY storage_locations_worker_all ON supply.storage_locations
  FOR ALL TO dermaos_worker USING (true);

-- products
CREATE POLICY products_isolation_app ON supply.products
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY products_isolation_readonly ON supply.products
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY products_worker_all ON supply.products
  FOR ALL TO dermaos_worker USING (true);

-- purchase_orders
CREATE POLICY purchase_orders_isolation_app ON supply.purchase_orders
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY purchase_orders_isolation_readonly ON supply.purchase_orders
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY purchase_orders_worker_all ON supply.purchase_orders
  FOR ALL TO dermaos_worker USING (true);

-- purchase_order_items
CREATE POLICY purchase_order_items_isolation_app ON supply.purchase_order_items
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY purchase_order_items_isolation_readonly ON supply.purchase_order_items
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY purchase_order_items_worker_all ON supply.purchase_order_items
  FOR ALL TO dermaos_worker USING (true);

-- inventory_lots
CREATE POLICY inventory_lots_isolation_app ON supply.inventory_lots
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY inventory_lots_isolation_readonly ON supply.inventory_lots
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY inventory_lots_worker_all ON supply.inventory_lots
  FOR ALL TO dermaos_worker USING (true);

-- inventory_movements
CREATE POLICY inventory_movements_isolation_app ON supply.inventory_movements
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY inventory_movements_isolation_readonly ON supply.inventory_movements
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY inventory_movements_worker_all ON supply.inventory_movements
  FOR ALL TO dermaos_worker USING (true);

-- kit_templates
CREATE POLICY kit_templates_isolation_app ON supply.kit_templates
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY kit_templates_isolation_readonly ON supply.kit_templates
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY kit_templates_worker_all ON supply.kit_templates
  FOR ALL TO dermaos_worker USING (true);

-- kit_items
CREATE POLICY kit_items_isolation_app ON supply.kit_items
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY kit_items_isolation_readonly ON supply.kit_items
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY kit_items_worker_all ON supply.kit_items
  FOR ALL TO dermaos_worker USING (true);

-- patient_lot_traces
CREATE POLICY patient_lot_traces_isolation_app ON supply.patient_lot_traces
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY patient_lot_traces_isolation_readonly ON supply.patient_lot_traces
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY patient_lot_traces_worker_all ON supply.patient_lot_traces
  FOR ALL TO dermaos_worker USING (true);

-- ─── Grants ──────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA supply TO dermaos_app;
GRANT SELECT ON ALL TABLES IN SCHEMA supply TO dermaos_readonly;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA supply TO dermaos_worker;
GRANT ALL ON ALL TABLES IN SCHEMA supply TO dermaos_admin;

-- ─── Triggers updated_at ─────────────────────────────────────────────────────
-- inventory_movements e patient_lot_traces são append-only

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON supply.categories
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON supply.suppliers
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_storage_locations_updated_at
  BEFORE UPDATE ON supply.storage_locations
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON supply.products
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON supply.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_purchase_order_items_updated_at
  BEFORE UPDATE ON supply.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_inventory_lots_updated_at
  BEFORE UPDATE ON supply.inventory_lots
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_kit_templates_updated_at
  BEFORE UPDATE ON supply.kit_templates
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_kit_items_updated_at
  BEFORE UPDATE ON supply.kit_items
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();
