-- ============================================================================
-- DermaOS — Security Definer Functions (SEC-02)
-- ----------------------------------------------------------------------------
-- Procedures pré-tenant (login, refresh, webhooks) precisam ler/escrever em
-- tabelas com RLS habilitada ANTES de saber a clinic_id. Para isso usamos
-- funções `SECURITY DEFINER` cujo OWNER é `dermaos_authn` — uma role com
-- BYPASSRLS e NOLOGIN. As funções:
--
--   1. Bypassam RLS apenas para a operação específica documentada
--      (ex: lookup por email retorna no máximo 1 linha).
--   2. São restritas via `GRANT EXECUTE` a `dermaos_app` (e `dermaos_worker`
--      onde aplicável).
--   3. Aceitam apenas parâmetros tipados — não recebem SQL dinâmico.
--
-- Como `dermaos_authn` é NOLOGIN, ninguém pode conectar diretamente como
-- ela; o único caminho é via essas funções.
-- ============================================================================

-- ─── GRANTS para dermaos_authn ───────────────────────────────────────────────
-- BYPASSRLS desativa RLS, mas NÃO substitui USAGE/SELECT de schema/tabela.
-- Como o OWNER de funções SECURITY DEFINER é dermaos_authn, ela precisa de
-- USAGE no schema e SELECT/UPDATE nas tabelas que as funções consultam.
-- Grants pré-aplicados por 099z_schema_grants.sql — repetidos aqui para
-- bancos frescos. Wrapped em exceção para não abortar em caso de permissão
-- insuficiente (Cloud SQL pode requerer intervenção manual).
DO $$
BEGIN
  GRANT USAGE,  CREATE ON SCHEMA shared TO dermaos_authn;
  GRANT USAGE,  CREATE ON SCHEMA omni   TO dermaos_authn;
  GRANT SELECT, UPDATE ON shared.users   TO dermaos_authn;
  GRANT SELECT          ON shared.clinics TO dermaos_authn;
  GRANT SELECT          ON omni.channels  TO dermaos_authn;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'GRANTs para dermaos_authn falharam: % — execute manualmente como postgres', SQLERRM;
END $$;

-- ─── shared.find_user_for_login(email) ───────────────────────────────────────
-- Lookup do usuário por email para o fluxo de login (auth.router.login).
-- Devolve hash da senha (verificação argon2 acontece no app), tentativas
-- falhas e a clínica associada — TUDO NUMA CHAMADA, evitando segunda query
-- pré-tenant.

CREATE OR REPLACE FUNCTION shared.find_user_for_login(p_email TEXT)
RETURNS TABLE (
  id                     UUID,
  clinic_id              UUID,
  name                   TEXT,
  email                  TEXT,
  password_hash          TEXT,
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
  SELECT u.id, u.clinic_id, u.name, u.email, u.password_hash, u.role,
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

-- ─── shared.register_login_failure(user_id, ip) ──────────────────────────────
-- Incrementa failed_login_attempts e aplica lockout depois de 5 falhas.
-- Idempotente; usado quando senha não bate.

CREATE OR REPLACE FUNCTION shared.register_login_failure(
  p_user_id UUID,
  p_ip      TEXT
) RETURNS TABLE (failed_attempts INT, locked_until TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, shared
AS $$
  UPDATE shared.users
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE
           WHEN failed_login_attempts + 1 >= 5
             THEN NOW() + INTERVAL '30 minutes'
           ELSE locked_until
         END,
         last_login_ip = p_ip::inet
   WHERE id = p_user_id
  RETURNING failed_login_attempts, locked_until;
$$;

ALTER FUNCTION shared.register_login_failure(UUID, TEXT) OWNER TO dermaos_authn;
REVOKE ALL ON FUNCTION shared.register_login_failure(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shared.register_login_failure(UUID, TEXT) TO dermaos_app;

-- ─── shared.register_login_success(user_id, ip) ──────────────────────────────

CREATE OR REPLACE FUNCTION shared.register_login_success(
  p_user_id UUID,
  p_ip      TEXT
) RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, shared
AS $$
  UPDATE shared.users
     SET failed_login_attempts = 0,
         locked_until          = NULL,
         last_login_at         = NOW(),
         last_login_ip         = p_ip::inet
   WHERE id = p_user_id;
$$;

ALTER FUNCTION shared.register_login_success(UUID, TEXT) OWNER TO dermaos_authn;
REVOKE ALL ON FUNCTION shared.register_login_success(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shared.register_login_success(UUID, TEXT) TO dermaos_app;

-- ─── shared.find_user_for_refresh(user_id) ───────────────────────────────────
-- Usado pela rota /auth/refresh: token foi validado por HMAC e o sub (user_id)
-- foi extraído. Carregamos o usuário completo para reemitir o access_token.

CREATE OR REPLACE FUNCTION shared.find_user_for_refresh(p_user_id UUID)
RETURNS TABLE (
  id        UUID,
  clinic_id UUID,
  name      TEXT,
  email     TEXT,
  role      shared.user_role,
  is_active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, shared
AS $$
  SELECT u.id, u.clinic_id, u.name, u.email, u.role, u.is_active
    FROM shared.users u
   WHERE u.id = p_user_id
   LIMIT 1;
$$;

ALTER FUNCTION shared.find_user_for_refresh(UUID) OWNER TO dermaos_authn;
REVOKE ALL ON FUNCTION shared.find_user_for_refresh(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shared.find_user_for_refresh(UUID) TO dermaos_app;

-- ─── shared.find_user_id_by_email(email) ─────────────────────────────────────
-- Usado em forgotPassword. Não revela existência ao caller (resposta é
-- silenciosa); apenas retorna id+name se houver match com is_active.

CREATE OR REPLACE FUNCTION shared.find_user_id_by_email(p_email TEXT)
RETURNS TABLE (id UUID, name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, shared
AS $$
  SELECT u.id, u.name
    FROM shared.users u
   WHERE u.email = lower(p_email)
     AND u.is_active = TRUE
   ORDER BY u.created_at ASC
   LIMIT 1;
$$;

ALTER FUNCTION shared.find_user_id_by_email(TEXT) OWNER TO dermaos_authn;
REVOKE ALL ON FUNCTION shared.find_user_id_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shared.find_user_id_by_email(TEXT) TO dermaos_app;

-- ─── shared.apply_password_reset(user_id, hash) ──────────────────────────────
-- Usado em resetPassword (após validar token Redis) e em changePassword.
-- Reseta lockout, reset attempts e atualiza password_changed_at.

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
         locked_until          = NULL
   WHERE id = p_user_id;
$$;

ALTER FUNCTION shared.apply_password_reset(UUID, TEXT) OWNER TO dermaos_authn;
REVOKE ALL ON FUNCTION shared.apply_password_reset(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shared.apply_password_reset(UUID, TEXT) TO dermaos_app;

-- ============================================================================
-- Webhooks (omni) — lookup pré-tenant
-- ============================================================================

-- ─── omni.find_channel_by_config(channel_type, key, value) ───────────────────
-- Localiza um canal por um campo de config (phoneNumberId, pageId, botToken,
-- emailAddress, verifyToken). Usado em webhook handlers.

CREATE OR REPLACE FUNCTION omni.find_channel_by_config(
  p_type  omni.channel_type,
  p_key   TEXT,
  p_value TEXT
) RETURNS TABLE (
  id          UUID,
  clinic_id   UUID,
  type        omni.channel_type,
  config      JSONB,
  is_active   BOOLEAN,
  created_at  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, omni
AS $$
  SELECT id, clinic_id, type, config, is_active, created_at
    FROM omni.channels
   WHERE type = p_type
     AND is_active = TRUE
     AND config ->> p_key = p_value
   LIMIT 1;
$$;

ALTER FUNCTION omni.find_channel_by_config(omni.channel_type, TEXT, TEXT) OWNER TO dermaos_authn;
REVOKE ALL ON FUNCTION omni.find_channel_by_config(omni.channel_type, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION omni.find_channel_by_config(omni.channel_type, TEXT, TEXT) TO dermaos_app;

-- ─── omni.find_default_channel(channel_type) ─────────────────────────────────
-- Fallback de desenvolvimento: primeiro canal ativo do tipo.

CREATE OR REPLACE FUNCTION omni.find_default_channel(p_type omni.channel_type)
RETURNS TABLE (
  id          UUID,
  clinic_id   UUID,
  type        omni.channel_type,
  config      JSONB,
  is_active   BOOLEAN,
  created_at  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, omni
AS $$
  SELECT id, clinic_id, type, config, is_active, created_at
    FROM omni.channels
   WHERE type = p_type
     AND is_active = TRUE
   ORDER BY created_at ASC
   LIMIT 1;
$$;

ALTER FUNCTION omni.find_default_channel(omni.channel_type) OWNER TO dermaos_authn;
REVOKE ALL ON FUNCTION omni.find_default_channel(omni.channel_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION omni.find_default_channel(omni.channel_type) TO dermaos_app;
