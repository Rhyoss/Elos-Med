-- ============================================================================
-- DermaOS — Prompt 20: Segurança & LGPD
-- Camadas de criptografia versionada, sessão segura, auditoria imutável,
-- exports/anonimização LGPD, registro de consentimento e detecção de IPs.
-- ============================================================================

-- ─── Versão das chaves de criptografia (rotação) ────────────────────────────
-- A app armazena ciphertext no formato vN:iv:tag:ct. Esta tabela é metadado
-- consultado por jobs de re-encrypt e por relatórios de compliance.

CREATE TABLE IF NOT EXISTS shared.encryption_key_versions (
  version       INT  PRIMARY KEY,
  algorithm     TEXT NOT NULL DEFAULT 'aes-256-gcm',
  active        BOOLEAN NOT NULL DEFAULT true,
  rotated_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO shared.encryption_key_versions (version, active)
VALUES (1, true)
ON CONFLICT (version) DO NOTHING;

COMMENT ON TABLE shared.encryption_key_versions IS
  'Registro de versões de chave mestra. Rotação adiciona nova versão active=true e marca anterior active=false após re-encrypt completo';

-- ─── shared.users — extensões de segurança de sessão ────────────────────────

ALTER TABLE shared.users
  ADD COLUMN IF NOT EXISTS password_version    INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_activity_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS known_ip_hashes     TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN shared.users.password_version IS
  'Incrementado a cada troca de senha. JWT inclui o valor; middleware rejeita tokens com versão diferente.';

COMMENT ON COLUMN shared.users.known_ip_hashes IS
  'Últimos IPs (HMAC) usados para login. Usado para detectar acesso de IP novo e disparar email de alerta.';

CREATE INDEX IF NOT EXISTS idx_users_password_version
  ON shared.users (id, password_version);

-- ─── shared.consent_log — append-only ───────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE shared.consent_type AS ENUM (
    'dados_pessoais', 'marketing', 'pesquisa', 'imagens'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE shared.consent_channel AS ENUM (
    'web', 'whatsapp', 'in_person', 'portal', 'paper'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS shared.consent_log (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id      UUID NOT NULL REFERENCES shared.clinics(id) ON DELETE RESTRICT,
  patient_id     UUID NOT NULL REFERENCES shared.patients(id) ON DELETE RESTRICT,
  consent_type   shared.consent_type    NOT NULL,
  version        TEXT NOT NULL,                          -- ex: 'privacy-2026-01'
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at     TIMESTAMPTZ,                            -- só preenchido em registros de revogação
  is_revocation  BOOLEAN NOT NULL DEFAULT false,
  ip_address     INET,
  channel        shared.consent_channel NOT NULL DEFAULT 'web',
  collected_by   UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  evidence       JSONB NOT NULL DEFAULT '{}',            -- assinatura, foto, link etc.
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_log_patient
  ON shared.consent_log (clinic_id, patient_id, consent_type, granted_at DESC);

COMMENT ON TABLE shared.consent_log IS
  'Append-only — revogação = novo registro com is_revocation=true. NUNCA UPDATE/DELETE';

-- Imutabilidade do consent_log
DROP RULE IF EXISTS no_update_consent_log ON shared.consent_log;
DROP RULE IF EXISTS no_delete_consent_log ON shared.consent_log;
CREATE RULE no_update_consent_log AS ON UPDATE TO shared.consent_log DO INSTEAD NOTHING;
CREATE RULE no_delete_consent_log AS ON DELETE TO shared.consent_log DO INSTEAD NOTHING;

-- ─── shared.privacy_notices — versões editáveis pelo DPO ────────────────────

CREATE TABLE IF NOT EXISTS shared.privacy_notices (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id    UUID REFERENCES shared.clinics(id) ON DELETE CASCADE,  -- NULL = global default
  version      TEXT NOT NULL,
  html         TEXT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_current   BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_privacy_notice_version UNIQUE (clinic_id, version)
);

CREATE INDEX IF NOT EXISTS idx_privacy_notices_current
  ON shared.privacy_notices (clinic_id) WHERE is_current = true;

-- Default global se nenhuma clinic-specific existir
INSERT INTO shared.privacy_notices (clinic_id, version, html, is_current)
VALUES (
  NULL,
  'global-2026-04',
  '<h1>Política de Privacidade — DermaOS</h1>'
  || '<p>Tratamos seus dados conforme a Lei Geral de Proteção de Dados (LGPD).</p>'
  || '<p>Em caso de dúvidas, contate o DPO da clínica responsável pelo seu atendimento.</p>',
  true
)
ON CONFLICT DO NOTHING;

-- ─── shared.lgpd_export_jobs — export assíncrono (LGPD art. 9 / 18) ─────────

DO $$ BEGIN
  CREATE TYPE shared.lgpd_export_status AS ENUM (
    'pending', 'processing', 'ready', 'downloaded', 'expired', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS shared.lgpd_export_jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES shared.clinics(id) ON DELETE RESTRICT,
  patient_id      UUID NOT NULL REFERENCES shared.patients(id) ON DELETE RESTRICT,
  requested_by    UUID REFERENCES shared.users(id) ON DELETE SET NULL,
  requested_role  TEXT NOT NULL,                        -- patient | admin | dpo
  status          shared.lgpd_export_status NOT NULL DEFAULT 'pending',
  object_key      TEXT,                                 -- key no MinIO bucket lgpd-exports
  zip_password_hash TEXT,                               -- argon2id da senha do ZIP (auditoria)
  download_url_expires_at TIMESTAMPTZ,
  downloaded_at   TIMESTAMPTZ,
  failed_reason   TEXT,
  bytes           BIGINT,
  ip_address      INET,
  justification   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lgpd_export_clinic_status
  ON shared.lgpd_export_jobs (clinic_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lgpd_export_patient
  ON shared.lgpd_export_jobs (patient_id, created_at DESC);

-- ─── shared.lgpd_anonymization_log — operação irreversível ──────────────────

CREATE TABLE IF NOT EXISTS shared.lgpd_anonymization_log (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id              UUID NOT NULL,
  patient_id             UUID NOT NULL,                 -- preservado para rastreabilidade
  performed_by           UUID NOT NULL,
  approved_by            UUID,                          -- second-admin (two-man rule opcional)
  reason                 TEXT NOT NULL,
  fields_anonymized      TEXT[] NOT NULL DEFAULT '{}',
  clinical_data_preserved BOOLEAN NOT NULL DEFAULT true,
  ip_address             INET,
  performed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anonymization_clinic
  ON shared.lgpd_anonymization_log (clinic_id, performed_at DESC);

DROP RULE IF EXISTS no_update_anonymization ON shared.lgpd_anonymization_log;
DROP RULE IF EXISTS no_delete_anonymization ON shared.lgpd_anonymization_log;
CREATE RULE no_update_anonymization AS ON UPDATE TO shared.lgpd_anonymization_log DO INSTEAD NOTHING;
CREATE RULE no_delete_anonymization AS ON DELETE TO shared.lgpd_anonymization_log DO INSTEAD NOTHING;

-- ─── audit.security_events — alertas de segurança para o DPO/owner ──────────

CREATE TABLE IF NOT EXISTS audit.security_events (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id      UUID NOT NULL,
  user_id        UUID,
  event_type     TEXT NOT NULL,
  severity       TEXT NOT NULL DEFAULT 'info',          -- info | warning | critical
  ip_address     INET,
  user_agent     TEXT,
  geo            JSONB NOT NULL DEFAULT '{}',           -- {city, country, asn}
  metadata       JSONB NOT NULL DEFAULT '{}',
  correlation_id UUID,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_security_severity CHECK (severity IN ('info', 'warning', 'critical')),
  CONSTRAINT chk_security_event_type CHECK (event_type ~ '^[a-z_]+\.[a-z_]+$')
);

CREATE INDEX IF NOT EXISTS idx_security_events_clinic
  ON audit.security_events (clinic_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user
  ON audit.security_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity
  ON audit.security_events (clinic_id, severity, occurred_at DESC) WHERE severity <> 'info';

DROP RULE IF EXISTS no_update_security_events ON audit.security_events;
DROP RULE IF EXISTS no_delete_security_events ON audit.security_events;
CREATE RULE no_update_security_events AS ON UPDATE TO audit.security_events DO INSTEAD NOTHING;
CREATE RULE no_delete_security_events AS ON DELETE TO audit.security_events DO INSTEAD NOTHING;

-- ─── audit.domain_events — colunas de correlation/redaction ─────────────────

ALTER TABLE audit.domain_events
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS old_data       JSONB,
  ADD COLUMN IF NOT EXISTS new_data       JSONB;

CREATE INDEX IF NOT EXISTS idx_domain_events_correlation
  ON audit.domain_events (correlation_id) WHERE correlation_id IS NOT NULL;

-- Imutabilidade adicional: revogar UPDATE/DELETE do role da app
-- (rules acima apenas silenciam; com REVOKE o erro é explícito ao tentar)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dermaos_app') THEN
    EXECUTE 'REVOKE UPDATE, DELETE ON audit.domain_events  FROM dermaos_app';
    EXECUTE 'REVOKE UPDATE, DELETE ON audit.access_log     FROM dermaos_app';
    EXECUTE 'REVOKE UPDATE, DELETE ON audit.security_events FROM dermaos_app';
    EXECUTE 'GRANT  INSERT          ON audit.security_events TO   dermaos_app, dermaos_worker';
    EXECUTE 'GRANT  SELECT          ON audit.security_events TO   dermaos_admin, dermaos_readonly';
  END IF;
END$$;

-- ─── Bucket policy: lgpd-exports retém 24h ──────────────────────────────────
-- Bucket criado pela app no startup. Documentado aqui para referência:
--   bucket name: lgpd-exports
--   lifecycle  : auto-expire em 24h (configurado pela app via minio client)

-- ─── RLS para tabelas LGPD (multi-tenant) ───────────────────────────────────

ALTER TABLE shared.consent_log              ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared.privacy_notices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared.lgpd_export_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared.lgpd_anonymization_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.security_events           ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dermaos_app') THEN
    EXECUTE $POL$
      DROP POLICY IF EXISTS consent_log_isolation        ON shared.consent_log;
      CREATE POLICY consent_log_isolation        ON shared.consent_log
        FOR ALL TO dermaos_app
        USING      (clinic_id = shared.current_clinic_id())
        WITH CHECK (clinic_id = shared.current_clinic_id());

      DROP POLICY IF EXISTS privacy_notices_isolation    ON shared.privacy_notices;
      CREATE POLICY privacy_notices_isolation    ON shared.privacy_notices
        FOR ALL TO dermaos_app
        USING      (clinic_id IS NULL OR clinic_id = shared.current_clinic_id())
        WITH CHECK (clinic_id IS NULL OR clinic_id = shared.current_clinic_id());

      DROP POLICY IF EXISTS lgpd_export_isolation        ON shared.lgpd_export_jobs;
      CREATE POLICY lgpd_export_isolation        ON shared.lgpd_export_jobs
        FOR ALL TO dermaos_app
        USING      (clinic_id = shared.current_clinic_id())
        WITH CHECK (clinic_id = shared.current_clinic_id());

      DROP POLICY IF EXISTS lgpd_anonymization_isolation ON shared.lgpd_anonymization_log;
      CREATE POLICY lgpd_anonymization_isolation ON shared.lgpd_anonymization_log
        FOR ALL TO dermaos_app
        USING      (clinic_id = shared.current_clinic_id())
        WITH CHECK (clinic_id = shared.current_clinic_id());

      DROP POLICY IF EXISTS security_events_isolation    ON audit.security_events;
      CREATE POLICY security_events_isolation    ON audit.security_events
        FOR SELECT TO dermaos_app, dermaos_admin, dermaos_readonly
        USING      (clinic_id = shared.current_clinic_id());

      DROP POLICY IF EXISTS security_events_insert       ON audit.security_events;
      CREATE POLICY security_events_insert       ON audit.security_events
        FOR INSERT TO dermaos_app, dermaos_worker
        WITH CHECK (true);
    $POL$;
  END IF;
END$$;

-- ─── Função utilitária: registrar evento de segurança ───────────────────────

CREATE OR REPLACE FUNCTION audit.log_security_event(
  p_clinic_id      UUID,
  p_user_id        UUID,
  p_event_type     TEXT,
  p_severity       TEXT,
  p_ip             INET,
  p_user_agent     TEXT,
  p_metadata       JSONB,
  p_correlation_id UUID
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO audit.security_events
    (clinic_id, user_id, event_type, severity, ip_address, user_agent, metadata, correlation_id)
  VALUES
    (p_clinic_id, p_user_id, p_event_type, p_severity, p_ip, p_user_agent, COALESCE(p_metadata, '{}'::jsonb), p_correlation_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
