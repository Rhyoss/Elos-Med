-- ============================================================================
-- DermaOS — Patient Portal Schema (Migration 037)
-- Portal do paciente: auth isolada, sessões, documentos, mensagens, notificações.
-- Isolamento total de sessão: JWT com aud='patient-portal' nunca aceito na API principal.
-- ============================================================================

BEGIN;

-- ─── Schema do portal ────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS portal;

-- ─── Estender shared.patients com campos do portal ───────────────────────────
-- Nota: portal_enabled e portal_password_hash já existem em 003_shared_tables.sql
-- Adicionamos os campos de controle de segurança que faltam.

ALTER TABLE shared.patients
  ADD COLUMN IF NOT EXISTS portal_email_verified     BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS portal_failed_attempts    INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS portal_locked_until       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS portal_captcha_required   BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS portal_last_login_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS portal_last_login_ip      INET;

COMMENT ON COLUMN shared.patients.portal_email_verified   IS 'E-mail do portal confirmado no primeiro acesso';
COMMENT ON COLUMN shared.patients.portal_failed_attempts  IS 'Tentativas consecutivas de login com falha (reset ao fazer login com sucesso)';
COMMENT ON COLUMN shared.patients.portal_locked_until     IS 'Conta bloqueada até esta data/hora (lockout progressivo)';
COMMENT ON COLUMN shared.patients.portal_captcha_required IS 'CAPTCHA obrigatório após 3 tentativas falhas';

-- ─── Enum: patient_portal como source de agendamento ─────────────────────────

DO $$
BEGIN
  ALTER TYPE shared.appointment_source ADD VALUE IF NOT EXISTS 'patient_portal';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── portal.refresh_tokens ───────────────────────────────────────────────────
-- Refresh tokens com rotation — família rastreia roubo de token.

CREATE TABLE IF NOT EXISTS portal.refresh_tokens (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID        NOT NULL REFERENCES shared.patients(id) ON DELETE CASCADE,
  token_hash    TEXT        NOT NULL UNIQUE,  -- SHA-256 do token bruto
  family        TEXT        NOT NULL,          -- UUID da família; detecta theft (reuse de token revogado)
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address    INET,
  user_agent    TEXT
);

CREATE INDEX IF NOT EXISTS idx_portal_rt_patient   ON portal.refresh_tokens (patient_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_portal_rt_expires   ON portal.refresh_tokens (expires_at)  WHERE revoked_at IS NULL;

COMMENT ON TABLE  portal.refresh_tokens IS 'Refresh tokens do portal — rotacionados a cada uso, invalidados ao trocar senha';
COMMENT ON COLUMN portal.refresh_tokens.family IS 'ID de família; reuso de token revogado da mesma família indica roubo → invalida todos do paciente';

-- ─── portal.magic_links ──────────────────────────────────────────────────────
-- Links de uso único para primeiro acesso, reset de senha, troca de e-mail e desbloqueio.

CREATE TABLE IF NOT EXISTS portal.magic_links (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID        NOT NULL REFERENCES shared.patients(id) ON DELETE CASCADE,
  token_hash   TEXT        NOT NULL UNIQUE,  -- SHA-256 do token bruto (nunca armazena token em claro)
  purpose      TEXT        NOT NULL CHECK (purpose IN (
                 'first_access', 'password_reset', 'email_change',
                 'account_unlock', 'email_verify'
               )),
  metadata     JSONB       NOT NULL DEFAULT '{}',  -- ex: {new_email: "x@y.com"} para email_change
  used_at      TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_ip INET
);

CREATE INDEX IF NOT EXISTS idx_portal_ml_patient ON portal.magic_links (patient_id);
CREATE INDEX IF NOT EXISTS idx_portal_ml_expires ON portal.magic_links (expires_at) WHERE used_at IS NULL;

-- ─── portal.login_attempts ───────────────────────────────────────────────────
-- Auditoria de tentativas de login para lockout progressivo (por IP e por e-mail).

CREATE TABLE IF NOT EXISTS portal.login_attempts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier      TEXT        NOT NULL,   -- e-mail ou IP
  identifier_type TEXT        NOT NULL CHECK (identifier_type IN ('email', 'ip')),
  success         BOOLEAN     NOT NULL DEFAULT FALSE,
  attempted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address      INET
);

CREATE INDEX IF NOT EXISTS idx_portal_la_identifier ON portal.login_attempts (identifier, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_la_cleanup    ON portal.login_attempts (attempted_at);

-- ─── portal.document_access_log ──────────────────────────────────────────────
-- Auditoria imutável de cada acesso a documento (prescrição PDF, laudo).

CREATE TABLE IF NOT EXISTS portal.document_access_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID        NOT NULL REFERENCES shared.patients(id) ON DELETE CASCADE,
  document_type TEXT        NOT NULL CHECK (document_type IN ('prescription_pdf', 'biopsy_result')),
  document_id   UUID        NOT NULL,
  accessed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address    INET,
  user_agent    TEXT
);

CREATE INDEX IF NOT EXISTS idx_portal_dal_patient ON portal.document_access_log (patient_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_dal_doc     ON portal.document_access_log (document_id, document_type);

-- ─── portal.profile_audit ────────────────────────────────────────────────────
-- Auditoria de cada alteração de perfil pelo paciente.

CREATE TABLE IF NOT EXISTS portal.profile_audit (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID        NOT NULL REFERENCES shared.patients(id) ON DELETE CASCADE,
  field_name  TEXT        NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address  INET
);

CREATE INDEX IF NOT EXISTS idx_portal_pa_patient ON portal.profile_audit (patient_id, changed_at DESC);

-- ─── portal.push_subscriptions ───────────────────────────────────────────────
-- Web Push API — VAPID subscriptions por paciente.

CREATE TABLE IF NOT EXISTS portal.push_subscriptions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID        NOT NULL REFERENCES shared.patients(id) ON DELETE CASCADE,
  endpoint     TEXT        NOT NULL UNIQUE,
  p256dh       TEXT        NOT NULL,
  auth         TEXT        NOT NULL,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_portal_ps_patient ON portal.push_subscriptions (patient_id) WHERE is_active = TRUE;

-- ─── portal.notifications ────────────────────────────────────────────────────
-- Avisos administrativos da clínica para o paciente (visíveis no portal).

CREATE TABLE IF NOT EXISTS portal.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID        NOT NULL REFERENCES shared.clinics(id) ON DELETE CASCADE,
  patient_id  UUID        NOT NULL REFERENCES shared.patients(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN (
                'result_available', 'appointment_reminder', 'billing', 'general'
              )),
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_portal_notif_patient ON portal.notifications (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_notif_unread  ON portal.notifications (patient_id) WHERE read_at IS NULL;

-- ─── Resultado de biópsia: flag de liberação ao paciente ─────────────────────
-- Apenas laudos explicitamente liberados aparecem no portal (resultado não liberado
-- simplesmente não existe para o paciente — 403 se tentar acessar diretamente).

ALTER TABLE clinical.biopsies
  ADD COLUMN IF NOT EXISTS released_to_patient  BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS released_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_by          UUID        REFERENCES shared.users(id);

CREATE INDEX IF NOT EXISTS idx_biopsies_released
  ON clinical.biopsies (clinic_id, patient_id)
  WHERE released_to_patient = TRUE;

COMMENT ON COLUMN clinical.biopsies.released_to_patient IS 'Laudo explicitamente liberado pelo médico — visível no portal do paciente';

-- ─── omni.conversations: link com portal do paciente ─────────────────────────
-- Conversas iniciadas pelo paciente via portal são vinculadas ao patient_id.

ALTER TABLE omni.conversations
  ADD COLUMN IF NOT EXISTS portal_patient_id UUID REFERENCES shared.patients(id);

CREATE INDEX IF NOT EXISTS idx_omni_conv_portal
  ON omni.conversations (portal_patient_id)
  WHERE portal_patient_id IS NOT NULL;

-- ─── Scheduling holds: source do portal ──────────────────────────────────────
-- Rastreia reservas temporárias de slot iniciadas pelo portal.
-- A tabela shared.scheduling_holds pode não ter coluna source ainda.

ALTER TABLE shared.scheduling_holds
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'internal'
    CHECK (source IN ('internal', 'patient_portal'));

-- ─── RLS no schema portal ─────────────────────────────────────────────────────
-- As tabelas do portal são isoladas pela camada de aplicação (patient_id do JWT).
-- RLS adicional aqui como defesa em profundidade.

ALTER TABLE portal.refresh_tokens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.magic_links        ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.document_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.profile_audit      ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.notifications      ENABLE ROW LEVEL SECURITY;

-- O app usa a role dermaos_app para todas as operações — RLS é validado na camada app.
-- Policies permissivas para a role da aplicação (o isolamento real é via código).

CREATE POLICY IF NOT EXISTS portal_rt_app     ON portal.refresh_tokens     FOR ALL TO dermaos_app USING (TRUE);
CREATE POLICY IF NOT EXISTS portal_ml_app     ON portal.magic_links        FOR ALL TO dermaos_app USING (TRUE);
CREATE POLICY IF NOT EXISTS portal_dal_app    ON portal.document_access_log FOR ALL TO dermaos_app USING (TRUE);
CREATE POLICY IF NOT EXISTS portal_pa_app     ON portal.profile_audit      FOR ALL TO dermaos_app USING (TRUE);
CREATE POLICY IF NOT EXISTS portal_ps_app     ON portal.push_subscriptions FOR ALL TO dermaos_app USING (TRUE);
CREATE POLICY IF NOT EXISTS portal_notif_app  ON portal.notifications      FOR ALL TO dermaos_app USING (TRUE);

-- ─── Índices auxiliares em shared.appointments para o portal ──────────────────
-- Consultas do portal: appointments futuros/passados por patient_id.

CREATE INDEX IF NOT EXISTS idx_appointments_portal
  ON shared.appointments (patient_id, scheduled_at DESC)
  WHERE status NOT IN ('cancelled', 'no_show');

-- ─── Índices auxiliares em clinical.prescriptions para o portal ───────────────

CREATE INDEX IF NOT EXISTS idx_prescriptions_portal
  ON clinical.prescriptions (patient_id, created_at DESC)
  WHERE status IN ('emitida', 'enviada_digital', 'impressa');

COMMIT;
