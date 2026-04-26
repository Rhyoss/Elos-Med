-- ============================================================================
-- DermaOS — Settings Module (Prompt 19)
-- Controle de acesso granular, credenciais de integração, auditoria e integridade
-- ============================================================================

-- ─── Extensões de shared.clinics ────────────────────────────────────────────

ALTER TABLE shared.clinics
  ADD COLUMN IF NOT EXISTS dpo_name     TEXT,
  ADD COLUMN IF NOT EXISTS dpo_email    TEXT,
  ADD COLUMN IF NOT EXISTS cnpj_locked  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cnes_locked  BOOLEAN NOT NULL DEFAULT false;

-- ─── Extensões de shared.users ──────────────────────────────────────────────

ALTER TABLE shared.users
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT,
  ADD COLUMN IF NOT EXISTS deactivated_by      UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deactivated_at      TIMESTAMPTZ;

-- ─── Extensões de shared.services ───────────────────────────────────────────

ALTER TABLE shared.services
  ADD COLUMN IF NOT EXISTS tuss_code  VARCHAR(8),   -- 8 dígitos numéricos TUSS
  ADD COLUMN IF NOT EXISTS price_cents INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ; -- soft delete

-- ─── Horário de funcionamento estruturado ────────────────────────────────────
-- Tabela separada para suportar múltiplos turnos por dia

CREATE TABLE IF NOT EXISTS shared.clinic_business_hours (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id    UUID        NOT NULL REFERENCES shared.clinics(id) ON DELETE CASCADE,
  day_of_week  SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Dom, 6=Sab
  is_open      BOOLEAN     NOT NULL DEFAULT true,
  shifts       JSONB       NOT NULL DEFAULT '[{"start":"08:00","end":"18:00"}]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_business_hours_clinic
  ON shared.clinic_business_hours (clinic_id);

COMMENT ON TABLE  shared.clinic_business_hours IS 'Horários de funcionamento — múltiplos turnos por dia suportados';
COMMENT ON COLUMN shared.clinic_business_hours.shifts IS '[{start:"HH:MM",end:"HH:MM"}] — até 3 turnos por dia';

-- ─── Histórico de preços de serviços ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shared.service_price_history (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id      UUID        NOT NULL REFERENCES shared.services(id) ON DELETE CASCADE,
  clinic_id       UUID        NOT NULL REFERENCES shared.clinics(id) ON DELETE CASCADE,
  old_price_cents INT         NOT NULL,
  new_price_cents INT         NOT NULL,
  changed_by      UUID        REFERENCES shared.users(id) ON DELETE SET NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_price_history_service
  ON shared.service_price_history (service_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_price_history_clinic
  ON shared.service_price_history (clinic_id, changed_at DESC);

-- ─── Credenciais de integração (criptografadas AES-256-GCM) ─────────────────

CREATE TABLE IF NOT EXISTS shared.integration_credentials (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id         UUID        NOT NULL REFERENCES shared.clinics(id) ON DELETE CASCADE,
  channel           VARCHAR(50) NOT NULL,      -- whatsapp | instagram | telegram | email
  credentials_enc   TEXT        NOT NULL,      -- AES-256-GCM de JSON das credenciais
  token_preview     VARCHAR(4),                -- últimos 4 chars do token principal
  is_active         BOOLEAN     NOT NULL DEFAULT false,
  last_verified_at  TIMESTAMPTZ,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_integration_creds_clinic
  ON shared.integration_credentials (clinic_id, channel);

COMMENT ON TABLE  shared.integration_credentials IS 'Credenciais de integração — AES-256-GCM, nunca em texto puro';
COMMENT ON COLUMN shared.integration_credentials.credentials_enc IS 'JSON das credenciais cifrado com AES-256-GCM';
COMMENT ON COLUMN shared.integration_credentials.token_preview   IS 'Últimos 4 chars do token principal para exibição na UI';

-- ─── Configuração de webhooks ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shared.webhook_configs (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id          UUID        NOT NULL REFERENCES shared.clinics(id) ON DELETE CASCADE,
  channel            VARCHAR(50) NOT NULL,
  webhook_secret_enc TEXT        NOT NULL,     -- AES-256-GCM do secret (32 bytes hex)
  secret_preview     VARCHAR(4)  NOT NULL,     -- últimos 4 chars para UI
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_webhook_configs_clinic
  ON shared.webhook_configs (clinic_id, channel);

COMMENT ON TABLE shared.webhook_configs IS 'Secrets de webhook — exibido UMA VEZ ao gerar, nunca recuperável via API';

-- ─── Versões de system prompt da Aurora ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS shared.system_prompt_versions (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id      UUID        NOT NULL REFERENCES shared.clinics(id) ON DELETE CASCADE,
  prompt_text    TEXT        NOT NULL,
  token_estimate INT,
  created_by     UUID        REFERENCES shared.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_prompt_clinic
  ON shared.system_prompt_versions (clinic_id, created_at DESC);

COMMENT ON TABLE shared.system_prompt_versions IS 'Histórico de versões do system prompt da Aurora — últimas 5 retidas';

-- ─── Convites de usuário ─────────────────────────────────────────────────────
-- Token gerado como UUID v4 → hash SHA-256 → armazenado. TTL 72h, uso único.

CREATE TABLE IF NOT EXISTS shared.user_invitations (
  id          UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID              NOT NULL REFERENCES shared.clinics(id) ON DELETE CASCADE,
  email       VARCHAR(255)      NOT NULL,
  token_hash  VARCHAR(64)       NOT NULL UNIQUE,  -- SHA-256 hex do token em texto
  role        shared.user_role  NOT NULL,
  permissions JSONB,
  invited_by  UUID              REFERENCES shared.users(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ       NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_clinic
  ON shared.user_invitations (clinic_id, email, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token
  ON shared.user_invitations (token_hash) WHERE used_at IS NULL;

COMMENT ON TABLE  shared.user_invitations IS 'Convites de usuário — token SHA-256, TTL 72h, uso único';
COMMENT ON COLUMN shared.user_invitations.token_hash IS 'SHA-256 do token UUID v4 — nunca armazenar o token em texto';

-- ─── Tokens de reset de senha ────────────────────────────────────────────────
-- Token UUID v4 → hash SHA-256. TTL 1h, uso único.

CREATE TABLE IF NOT EXISTS shared.password_reset_tokens (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES shared.users(id) ON DELETE CASCADE,
  clinic_id     UUID        NOT NULL REFERENCES shared.clinics(id) ON DELETE CASCADE,
  token_hash    VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hex do token
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,
  requested_by  UUID        REFERENCES shared.users(id) ON DELETE SET NULL,
  requested_ip  INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pwd_reset_user
  ON shared.password_reset_tokens (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_token
  ON shared.password_reset_tokens (token_hash) WHERE used_at IS NULL;

COMMENT ON TABLE  shared.password_reset_tokens IS 'Tokens de reset de senha — SHA-256, TTL 1h, uso único, never plaintext';
COMMENT ON COLUMN shared.password_reset_tokens.token_hash IS 'SHA-256 do token UUID v4 — somente hash armazenado';

-- ─── Triggers updated_at ────────────────────────────────────────────────────

CREATE TRIGGER trg_integration_creds_updated_at
  BEFORE UPDATE ON shared.integration_credentials
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_webhook_configs_updated_at
  BEFORE UPDATE ON shared.webhook_configs
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE TRIGGER trg_business_hours_updated_at
  BEFORE UPDATE ON shared.clinic_business_hours
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

-- ─── RLS: novas tabelas ──────────────────────────────────────────────────────

ALTER TABLE shared.clinic_business_hours   ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared.service_price_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared.integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared.webhook_configs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared.system_prompt_versions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared.user_invitations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared.password_reset_tokens   ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_business_hours       ON shared.clinic_business_hours   USING (clinic_id = shared.current_clinic_id());
CREATE POLICY rls_service_price_hist   ON shared.service_price_history   USING (clinic_id = shared.current_clinic_id());
CREATE POLICY rls_integration_creds    ON shared.integration_credentials USING (clinic_id = shared.current_clinic_id());
CREATE POLICY rls_webhook_configs      ON shared.webhook_configs         USING (clinic_id = shared.current_clinic_id());
CREATE POLICY rls_system_prompt        ON shared.system_prompt_versions  USING (clinic_id = shared.current_clinic_id());
CREATE POLICY rls_user_invitations     ON shared.user_invitations        USING (clinic_id = shared.current_clinic_id());
CREATE POLICY rls_password_reset       ON shared.password_reset_tokens   USING (clinic_id = shared.current_clinic_id());

-- ─── Grants ─────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON shared.clinic_business_hours   TO dermaos_app;
GRANT SELECT, INSERT          ON shared.service_price_history   TO dermaos_app;
GRANT SELECT, INSERT, UPDATE  ON shared.integration_credentials TO dermaos_app;
GRANT SELECT, INSERT, UPDATE  ON shared.webhook_configs         TO dermaos_app;
GRANT SELECT, INSERT          ON shared.system_prompt_versions  TO dermaos_app;
GRANT SELECT, INSERT, UPDATE  ON shared.user_invitations        TO dermaos_app;
GRANT SELECT, INSERT, UPDATE  ON shared.password_reset_tokens   TO dermaos_app;

-- Permite que a app leia logs de auditoria (com RLS — somente do próprio tenant)
GRANT SELECT ON audit.domain_events TO dermaos_app;
GRANT SELECT ON audit.access_log    TO dermaos_app;

CREATE POLICY audit_events_app_read ON audit.domain_events
  FOR SELECT TO dermaos_app
  USING (clinic_id = shared.current_clinic_id());

CREATE POLICY audit_access_app_read ON audit.access_log
  FOR SELECT TO dermaos_app
  USING (clinic_id = shared.current_clinic_id());
