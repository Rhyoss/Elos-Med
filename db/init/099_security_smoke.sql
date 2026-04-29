-- ============================================================================
-- DermaOS — Smoke test de segurança (SEC-01 + SEC-02)
-- ----------------------------------------------------------------------------
-- Falha em FATAL se qualquer role da aplicação tiver atributos perigosos.
-- Roda por último (prefixo 099) e aborta o bootstrap se algo estiver errado.
--
-- Cenários cobertos:
--   1. dermaos_app, dermaos_worker e dermaos_readonly devem existir.
--   2. Nenhuma delas pode ser SUPERUSER, BYPASSRLS, CREATEDB ou CREATEROLE.
--   3. RLS deve estar FORCED em shared.patients.
--   4. (SEC-02) dermaos_authn deve existir com BYPASSRLS + NOLOGIN.
--   5. (SEC-02) Funções SECURITY DEFINER devem existir e ser owned por authn.
--   6. (SEC-02) `app.current_clinic_id` ausente → SELECT em shared.patients
--      deve retornar 0 linhas (RLS realmente bloqueia).
-- ============================================================================

DO $smoke$
DECLARE
  expected_roles TEXT[] := ARRAY['dermaos_app', 'dermaos_worker', 'dermaos_readonly'];
  r              RECORD;
BEGIN
  -- 1. Existência
  FOR r IN
    SELECT unnest(expected_roles) AS rolname
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r.rolname) THEN
      RAISE EXCEPTION 'SEC-01 smoke: role % não existe', r.rolname;
    END IF;
  END LOOP;

  -- 2. Atributos seguros
  FOR r IN
    SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
      FROM pg_roles
     WHERE rolname = ANY(expected_roles)
  LOOP
    IF r.rolsuper THEN
      RAISE EXCEPTION 'SEC-01 smoke: role % é SUPERUSER (deveria ser NOSUPERUSER)', r.rolname;
    END IF;
    IF r.rolbypassrls THEN
      RAISE EXCEPTION 'SEC-01 smoke: role % tem BYPASSRLS (deveria ser NOBYPASSRLS)', r.rolname;
    END IF;
    IF r.rolcreatedb THEN
      RAISE EXCEPTION 'SEC-01 smoke: role % tem CREATEDB (não deveria)', r.rolname;
    END IF;
    IF r.rolcreaterole THEN
      RAISE EXCEPTION 'SEC-01 smoke: role % tem CREATEROLE (não deveria)', r.rolname;
    END IF;
  END LOOP;

  -- 3. Verifica que RLS está ativo em pelo menos uma tabela crítica
  IF NOT EXISTS (
    SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'shared'
       AND c.relname = 'patients'
       AND c.relrowsecurity = true
       AND c.relforcerowsecurity = true
  ) THEN
    RAISE EXCEPTION 'SEC-01 smoke: RLS não está FORCED em shared.patients';
  END IF;

  RAISE NOTICE '✓ SEC-01 smoke OK — roles aplicação rebaixadas, RLS forçada em shared.patients';
END
$smoke$;


-- ─── SEC-02 smoke ────────────────────────────────────────────────────────────
DO $sec02$
DECLARE
  authn_row pg_roles%ROWTYPE;
  expected_fns TEXT[] := ARRAY[
    'shared.find_user_for_login',
    'shared.register_login_failure',
    'shared.register_login_success',
    'shared.find_user_for_refresh',
    'shared.find_user_id_by_email',
    'shared.apply_password_reset',
    'omni.find_channel_by_config',
    'omni.find_default_channel'
  ];
  fn_qualified TEXT;
  fn_owner_oid OID;
  authn_oid    OID;
BEGIN
  -- 4. dermaos_authn existe, NOLOGIN, BYPASSRLS
  SELECT * INTO authn_row FROM pg_roles WHERE rolname = 'dermaos_authn';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEC-02 smoke: role dermaos_authn não existe';
  END IF;
  IF authn_row.rolcanlogin THEN
    RAISE EXCEPTION 'SEC-02 smoke: dermaos_authn pode logar (deveria ser NOLOGIN)';
  END IF;
  IF NOT authn_row.rolbypassrls THEN
    RAISE EXCEPTION 'SEC-02 smoke: dermaos_authn não tem BYPASSRLS — funções SD vão falhar';
  END IF;
  IF authn_row.rolsuper THEN
    RAISE EXCEPTION 'SEC-02 smoke: dermaos_authn é SUPERUSER (deveria ser apenas BYPASSRLS)';
  END IF;

  authn_oid := authn_row.oid;

  -- 5. Cada função SD existe e é owned por dermaos_authn
  FOREACH fn_qualified IN ARRAY expected_fns
  LOOP
    SELECT p.proowner INTO fn_owner_oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname || '.' || p.proname = fn_qualified
     LIMIT 1;

    IF fn_owner_oid IS NULL THEN
      RAISE EXCEPTION 'SEC-02 smoke: função % não existe', fn_qualified;
    END IF;
    IF fn_owner_oid <> authn_oid THEN
      RAISE EXCEPTION 'SEC-02 smoke: função % não é owned por dermaos_authn (owner_oid=%, authn_oid=%)',
        fn_qualified, fn_owner_oid, authn_oid;
    END IF;
  END LOOP;

  RAISE NOTICE '✓ SEC-02 smoke OK — dermaos_authn ativa, % funções SD owned corretamente',
    array_length(expected_fns, 1);
END
$sec02$;


-- ─── SEC-02 — RLS bloqueia mesmo SELECT quando clinic_id está ausente ────────
-- Roda como dermaos_app explicitamente; sem `SET LOCAL app.current_clinic_id`,
-- a função `shared.current_clinic_id()` retorna NULL e nenhuma linha deve ser
-- retornada. Aborta se vazar qualquer linha.
SET LOCAL ROLE dermaos_app;

DO $rls_check$
DECLARE
  leaked_count INT;
BEGIN
  -- Garantia: nenhum app.current_clinic_id vinculado nesta sessão.
  PERFORM set_config('app.current_clinic_id', '', false);

  SELECT COUNT(*) INTO leaked_count FROM shared.patients;
  IF leaked_count > 0 THEN
    RAISE EXCEPTION 'SEC-02 smoke: RLS NÃO está bloqueando — % linhas vazaram em shared.patients sem clinic_id',
      leaked_count;
  END IF;

  SELECT COUNT(*) INTO leaked_count FROM shared.users;
  IF leaked_count > 0 THEN
    RAISE EXCEPTION 'SEC-02 smoke: RLS NÃO está bloqueando — % linhas vazaram em shared.users sem clinic_id',
      leaked_count;
  END IF;

  RAISE NOTICE '✓ SEC-02 RLS smoke OK — sem clinic_id, dermaos_app vê 0 linhas (esperado)';
END
$rls_check$;

RESET ROLE;


-- ─── Sprint 2 — Audit policies endurecidas (WITH CHECK clinic_id = GUC) ──────
-- Garante que policies de INSERT em audit.* validam clinic_id contra o GUC.
-- Sem isso, app/worker poderiam logar audits forjados (CWE-639).
DO $audit_policy$
DECLARE
  policy_def TEXT;
  expected   TEXT := '(clinic_id = shared.current_clinic_id())';
BEGIN
  SELECT pg_get_expr(polwithcheck, polrelid) INTO policy_def
    FROM pg_policy
   WHERE polname = 'audit_events_insert';

  IF policy_def IS NULL THEN
    RAISE EXCEPTION 'Sprint 2 smoke: policy audit_events_insert não existe';
  END IF;
  IF policy_def <> expected THEN
    RAISE EXCEPTION 'Sprint 2 smoke: audit_events_insert.WITH CHECK = %, esperado %',
      policy_def, expected;
  END IF;

  SELECT pg_get_expr(polwithcheck, polrelid) INTO policy_def
    FROM pg_policy
   WHERE polname = 'audit_access_insert';

  IF policy_def IS NULL THEN
    RAISE EXCEPTION 'Sprint 2 smoke: policy audit_access_insert não existe';
  END IF;
  IF policy_def <> expected THEN
    RAISE EXCEPTION 'Sprint 2 smoke: audit_access_insert.WITH CHECK = %, esperado %',
      policy_def, expected;
  END IF;

  -- Confirma FORCE RLS em audit (mesmo o owner respeita policies)
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'audit' AND c.relname = 'domain_events'
       AND c.relrowsecurity AND c.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'Sprint 2 smoke: FORCE ROW LEVEL SECURITY ausente em audit.domain_events';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'audit' AND c.relname = 'access_log'
       AND c.relrowsecurity AND c.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'Sprint 2 smoke: FORCE ROW LEVEL SECURITY ausente em audit.access_log';
  END IF;

  RAISE NOTICE '✓ Sprint 2 smoke OK — audit.* INSERT validado contra GUC, FORCE RLS ativo';
END
$audit_policy$;


-- ─── Sprint 2 — INSERT em audit sem GUC deve falhar para dermaos_app ─────────
-- Confere o caminho real: tenta inserir uma linha em audit.access_log
-- como dermaos_app sem ter setado app.current_clinic_id. Esperado: erro.
DO $audit_insert$
DECLARE
  blocked BOOLEAN := FALSE;
BEGIN
  PERFORM set_config('app.current_clinic_id', '', false);
  SET LOCAL ROLE dermaos_app;

  BEGIN
    INSERT INTO audit.access_log
      (clinic_id, user_id, resource_type, resource_id, action, ip_address)
    VALUES
      (gen_random_uuid(), gen_random_uuid(), 'smoke', gen_random_uuid(), 'read', '127.0.0.1'::inet);
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR others THEN
      blocked := TRUE;
  END;

  RESET ROLE;

  IF NOT blocked THEN
    RAISE EXCEPTION 'Sprint 2 smoke: INSERT em audit.access_log sem GUC PASSOU — policy quebrada';
  END IF;

  RAISE NOTICE '✓ Sprint 2 INSERT smoke OK — audit bloqueia INSERT sem clinic_id no GUC';
END
$audit_insert$;
