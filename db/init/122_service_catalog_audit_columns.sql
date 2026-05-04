-- ─── 122_service_catalog_audit_columns.sql ────────────────────────────────
-- Adiciona colunas de soft-delete e auditoria em financial.service_catalog
-- que o código (catalog.service.ts) já referenciava mas a migração 040
-- não criou. Sem elas, INSERT/UPDATE/SELECT no catálogo falham com
--   ERROR: column "deleted_at" does not exist
--
-- Idempotente — pode ser re-aplicada com segurança.

BEGIN;

ALTER TABLE financial.service_catalog
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES shared.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES shared.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_service_catalog_deleted_at
  ON financial.service_catalog (deleted_at)
  WHERE deleted_at IS NULL;

COMMIT;
