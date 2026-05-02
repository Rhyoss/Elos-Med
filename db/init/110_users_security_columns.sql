-- ============================================================================
-- DermaOS — Security columns para shared.users (SEC-11 + SEC-14)
-- ----------------------------------------------------------------------------
-- SEC-11: substitui o hash placeholder 'INVITE_PENDING' por uma coluna
--          booleana explícita. password_hash passa a aceitar NULL enquanto
--          o convite não é aceito.
-- SEC-14: adiciona password_version. Cada changePassword/resetPassword
--          incrementa o valor; tokens emitidos com versão antiga são
--          rejeitados imediatamente sem precisar de revogação por jti.
-- ============================================================================

-- ─── SEC-11: invite_pending boolean ──────────────────────────────────────────
ALTER TABLE shared.users
  ADD COLUMN IF NOT EXISTS is_invite_pending BOOLEAN NOT NULL DEFAULT FALSE;

-- Permite hash NULL durante o convite (a senha real será definida quando
-- o usuário aceitar o convite e configurar a senha).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'shared' AND table_name = 'users'
       AND column_name  = 'password_hash' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE shared.users ALTER COLUMN password_hash DROP NOT NULL;
  END IF;
END $$;

-- Constraint: ou is_invite_pending=true (hash pode ser NULL/placeholder),
-- ou hash deve estar preenchido com valor válido.
ALTER TABLE shared.users
  DROP CONSTRAINT IF EXISTS chk_users_password_or_invite;
ALTER TABLE shared.users
  ADD CONSTRAINT chk_users_password_or_invite CHECK (
    is_invite_pending = TRUE OR (password_hash IS NOT NULL AND password_hash <> 'INVITE_PENDING')
  );

-- Backfill: usuários com 'INVITE_PENDING' ganham flag explícita e hash NULL.
UPDATE shared.users
   SET is_invite_pending = TRUE,
       password_hash     = NULL
 WHERE password_hash = 'INVITE_PENDING';

CREATE INDEX IF NOT EXISTS idx_users_invite_pending
  ON shared.users (clinic_id, is_invite_pending)
  WHERE is_invite_pending = TRUE;

COMMENT ON COLUMN shared.users.is_invite_pending IS
  'SEC-11: TRUE enquanto o usuário não aceitou o convite e definiu senha';

-- ─── SEC-14: password_version ────────────────────────────────────────────────
ALTER TABLE shared.users
  ADD COLUMN IF NOT EXISTS password_version INT NOT NULL DEFAULT 1;

COMMENT ON COLUMN shared.users.password_version IS
  'SEC-14: incrementado em cada change/reset; tokens com versão antiga são rejeitados';

-- Atualiza apply_password_reset (SEC-02) para incrementar password_version.
CREATE OR REPLACE FUNCTION shared.apply_password_reset(
  p_user_id  UUID,
  p_new_hash TEXT
) RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, shared
AS $$
  UPDATE shared.users
     SET password_hash         = p_new_hash,
         password_changed_at   = NOW(),
         failed_login_attempts = 0,
         locked_until          = NULL,
         is_invite_pending     = FALSE,
         password_version      = password_version + 1
   WHERE id = p_user_id;
$$;

ALTER FUNCTION shared.apply_password_reset(UUID, TEXT) OWNER TO dermaos_authn;
REVOKE ALL ON FUNCTION shared.apply_password_reset(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shared.apply_password_reset(UUID, TEXT) TO dermaos_app;

-- find_user_for_login agora retorna password_version e is_invite_pending
DROP FUNCTION IF EXISTS shared.find_user_for_login(TEXT);
CREATE OR REPLACE FUNCTION shared.find_user_for_login(p_email TEXT)
RETURNS TABLE (
  id                     UUID,
  clinic_id              UUID,
  name                   TEXT,
  email                  TEXT,
  password_hash          TEXT,
  password_version       INT,
  is_invite_pending      BOOLEAN,
  role                   shared.user_role,
  is_active              BOOLEAN,
  failed_login_attempts  INT,
  locked_until           TIMESTAMPTZ,
  clinic_slug            TEXT,
  clinic_name            TEXT,
  clinic_active          BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, shared
AS $$
  SELECT u.id, u.clinic_id, u.name, u.email, u.password_hash,
         u.password_version, u.is_invite_pending, u.role,
         u.is_active, u.failed_login_attempts, u.locked_until,
         c.slug, c.name, c.is_active
    FROM shared.users u
    JOIN shared.clinics c ON c.id = u.clinic_id
   WHERE u.email = lower(p_email)
   ORDER BY u.created_at ASC
   LIMIT 1;
$$;

ALTER FUNCTION shared.find_user_for_login(TEXT) OWNER TO dermaos_authn;
REVOKE ALL ON FUNCTION shared.find_user_for_login(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shared.find_user_for_login(TEXT) TO dermaos_app;

-- find_user_for_refresh também retorna password_version
DROP FUNCTION IF EXISTS shared.find_user_for_refresh(UUID);
CREATE OR REPLACE FUNCTION shared.find_user_for_refresh(p_user_id UUID)
RETURNS TABLE (
  id                UUID,
  clinic_id         UUID,
  name              TEXT,
  email             TEXT,
  role              shared.user_role,
  is_active         BOOLEAN,
  password_version  INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, shared
AS $$
  SELECT u.id, u.clinic_id, u.name, u.email, u.role, u.is_active, u.password_version
    FROM shared.users u
   WHERE u.id = p_user_id
   LIMIT 1;
$$;

ALTER FUNCTION shared.find_user_for_refresh(UUID) OWNER TO dermaos_authn;
REVOKE ALL ON FUNCTION shared.find_user_for_refresh(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shared.find_user_for_refresh(UUID) TO dermaos_app;
