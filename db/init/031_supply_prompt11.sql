-- ============================================================================
-- DermaOS — DermSupply Prompt 11
-- Adiciona auditoria, soft-delete, cadeia fria, controlados, foto, substitutos
-- e posição de estoque otimizada ao módulo de supply criado no Prompt 09/030.
-- ============================================================================

-- ─── Produtos: colunas adicionais ────────────────────────────────────────────

ALTER TABLE supply.products
  ADD COLUMN IF NOT EXISTS brand                    TEXT,
  ADD COLUMN IF NOT EXISTS is_cold_chain            BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS control_class            TEXT,        -- Classe ANVISA: A1, B1, C1…
  ADD COLUMN IF NOT EXISTS sale_price               DECIMAL(10, 4),
  ADD COLUMN IF NOT EXISTS photo_object_key         TEXT,
  ADD COLUMN IF NOT EXISTS default_storage_location_id UUID      REFERENCES supply.storage_locations (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by               UUID         REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by               UUID         REFERENCES shared.users (id) ON DELETE SET NULL;

-- Substitui constraint que não funciona bem com soft-delete
ALTER TABLE supply.products DROP CONSTRAINT IF EXISTS uq_product_sku_clinic;
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_sku_clinic_live
  ON supply.products (clinic_id, sku)
  WHERE deleted_at IS NULL;

-- Índice parcial: registros vivos (é_active=TRUE e não deletados)
CREATE INDEX IF NOT EXISTS idx_products_live
  ON supply.products (clinic_id)
  WHERE is_active = TRUE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_cold_chain
  ON supply.products (clinic_id)
  WHERE is_cold_chain = TRUE AND deleted_at IS NULL;

-- ─── Categorias: auditoria e soft-delete ─────────────────────────────────────

ALTER TABLE supply.categories
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by  UUID REFERENCES shared.users (id) ON DELETE SET NULL;

-- Substitui constraint com índice parcial que suporta NULL em parent_id
ALTER TABLE supply.categories DROP CONSTRAINT IF EXISTS uq_category_name_parent;
CREATE UNIQUE INDEX IF NOT EXISTS uq_category_name_parent_live
  ON supply.categories (clinic_id, COALESCE(parent_id::text, ''), name)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_categories_live
  ON supply.categories (clinic_id)
  WHERE deleted_at IS NULL;

-- ─── Fornecedores: auditoria, soft-delete e CNPJ único por tenant ────────────

ALTER TABLE supply.suppliers
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by  UUID REFERENCES shared.users (id) ON DELETE SET NULL;

-- Constraint de nome respeitando soft-delete
ALTER TABLE supply.suppliers DROP CONSTRAINT IF EXISTS uq_supplier_name_clinic;
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_name_clinic_live
  ON supply.suppliers (clinic_id, name)
  WHERE deleted_at IS NULL;

-- CNPJ único por tenant (apenas registros não deletados)
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_cnpj_clinic_live
  ON supply.suppliers (clinic_id, cnpj)
  WHERE cnpj IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_live
  ON supply.suppliers (clinic_id)
  WHERE deleted_at IS NULL;

-- ─── Locais de armazenamento: auditoria e soft-delete ────────────────────────

ALTER TABLE supply.storage_locations
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by  UUID REFERENCES shared.users (id) ON DELETE SET NULL;

ALTER TABLE supply.storage_locations DROP CONSTRAINT IF EXISTS uq_storage_name_clinic;
CREATE UNIQUE INDEX IF NOT EXISTS uq_storage_name_clinic_live
  ON supply.storage_locations (clinic_id, name)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_storage_locations_live
  ON supply.storage_locations (clinic_id)
  WHERE deleted_at IS NULL;

-- ─── supply.product_substitutes ──────────────────────────────────────────────
-- Relação M:M de substitutos dentro do mesmo tenant.
-- Soft-delete não se aplica — ao deletar produto, ON DELETE CASCADE remove a linha.

CREATE TABLE IF NOT EXISTS supply.product_substitutes (
  product_id    UUID        NOT NULL REFERENCES supply.products (id) ON DELETE CASCADE,
  substitute_id UUID        NOT NULL REFERENCES supply.products (id) ON DELETE CASCADE,
  clinic_id     UUID        NOT NULL REFERENCES shared.clinics  (id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (product_id, substitute_id),
  CONSTRAINT chk_no_self_substitute CHECK (product_id != substitute_id)
);

CREATE INDEX IF NOT EXISTS idx_product_substitutes_lookup
  ON supply.product_substitutes (clinic_id, substitute_id);

ALTER TABLE supply.product_substitutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply.product_substitutes FORCE ROW LEVEL SECURITY;

CREATE POLICY product_substitutes_app ON supply.product_substitutes
  FOR ALL TO dermaos_app USING (clinic_id = shared.current_clinic_id());
CREATE POLICY product_substitutes_readonly ON supply.product_substitutes
  FOR SELECT TO dermaos_readonly USING (clinic_id = shared.current_clinic_id());
CREATE POLICY product_substitutes_worker ON supply.product_substitutes
  FOR ALL TO dermaos_worker USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON supply.product_substitutes TO dermaos_app;
GRANT SELECT                          ON supply.product_substitutes TO dermaos_readonly;
GRANT SELECT, INSERT, UPDATE          ON supply.product_substitutes TO dermaos_worker;
GRANT ALL                             ON supply.product_substitutes TO dermaos_admin;

-- ─── Índices de suporte à busca full-text ────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_products_sku_search
  ON supply.products USING gin (sku gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_barcode
  ON supply.products (clinic_id, barcode)
  WHERE barcode IS NOT NULL AND deleted_at IS NULL;

-- ─── Índices de performance para posição de estoque ──────────────────────────
-- Suportam a query CTE que agrega inventory_lots + inventory_movements

CREATE INDEX IF NOT EXISTS idx_inventory_lots_agg
  ON supply.inventory_lots (clinic_id, product_id)
  INCLUDE (quantity_current, expiry_date, is_quarantined, storage_location_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_consumption
  ON supply.inventory_movements (clinic_id, product_id, performed_at)
  WHERE type IN ('saida', 'uso_paciente', 'perda', 'vencimento');
