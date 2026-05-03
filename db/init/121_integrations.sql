-- ============================================================================
-- DermaOS — Integrations & Webhooks
-- Tabelas que armazenam credenciais cifradas (AES-256) por clínica/canal
-- e os segredos HMAC dos webhooks de entrada.
-- ============================================================================

-- ─── shared.integration_credentials ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shared.integration_credentials (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID NOT NULL REFERENCES shared.clinics (id) ON DELETE CASCADE,
  channel           TEXT NOT NULL,                          -- whatsapp | instagram | telegram | email
  credentials_enc   TEXT NOT NULL,                          -- AES-256-GCM (JSON serializado)
  token_preview     TEXT,                                   -- últimos 4 chars (não-PHI)
  is_active         BOOLEAN NOT NULL DEFAULT false,
  last_verified_at  TIMESTAMPTZ,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_integration_credentials UNIQUE (clinic_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_integration_credentials_clinic
  ON shared.integration_credentials (clinic_id);

ALTER TABLE shared.integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared.integration_credentials FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_credentials_isolation_app ON shared.integration_credentials;
CREATE POLICY integration_credentials_isolation_app ON shared.integration_credentials
  FOR ALL TO dermaos_app
  USING      (clinic_id = shared.current_clinic_id())
  WITH CHECK (clinic_id = shared.current_clinic_id());

DROP POLICY IF EXISTS integration_credentials_worker_all ON shared.integration_credentials;
CREATE POLICY integration_credentials_worker_all ON shared.integration_credentials
  FOR ALL TO dermaos_worker
  USING (true) WITH CHECK (true);

COMMENT ON TABLE shared.integration_credentials
  IS 'Credenciais cifradas (AES-256-GCM) por clínica/canal. Nunca leia credentials_enc fora do crypto.ts.';

-- ─── shared.webhook_configs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shared.webhook_configs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID NOT NULL REFERENCES shared.clinics (id) ON DELETE CASCADE,
  channel             TEXT NOT NULL,
  webhook_secret_enc  TEXT NOT NULL,                        -- AES-256-GCM (segredo HMAC)
  secret_preview      TEXT,                                 -- últimos 4 chars
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_webhook_configs UNIQUE (clinic_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_webhook_configs_clinic
  ON shared.webhook_configs (clinic_id);

ALTER TABLE shared.webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared.webhook_configs FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_configs_isolation_app ON shared.webhook_configs;
CREATE POLICY webhook_configs_isolation_app ON shared.webhook_configs
  FOR ALL TO dermaos_app
  USING      (clinic_id = shared.current_clinic_id())
  WITH CHECK (clinic_id = shared.current_clinic_id());

-- Worker bypassa RLS para validar HMAC nas requisições inbound dos webhooks
-- (clinic_id é resolvido pelo slug na URL antes de carregar o segredo).
DROP POLICY IF EXISTS webhook_configs_worker_all ON shared.webhook_configs;
CREATE POLICY webhook_configs_worker_all ON shared.webhook_configs
  FOR ALL TO dermaos_worker
  USING (true) WITH CHECK (true);

COMMENT ON TABLE shared.webhook_configs
  IS 'Segredos HMAC dos webhooks inbound (whatsapp/instagram/telegram/email).';
