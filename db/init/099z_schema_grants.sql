-- Diagnóstico e correção de ownership dos schemas para dermaos_admin.
-- Roda antes de 100_security_definer_functions.sql que precisa GRANT USAGE.
DO $$
DECLARE
  r RECORD;
  s TEXT;
BEGIN
  -- 1. Logar owners atuais dos schemas
  FOR r IN
    SELECT nspname, pg_get_userbyid(nspowner) AS owner
      FROM pg_namespace
     WHERE nspname IN ('shared','clinical','omni','supply','financial','analytics','audit')
     ORDER BY nspname
  LOOP
    RAISE NOTICE 'Schema %: owner=%', r.nspname, r.owner;
  END LOOP;

  -- 2. Logar atributos das roles relevantes
  FOR r IN
    SELECT rolname,
           rolsuper, rolcreaterole, rolbypassrls, rolcanlogin,
           pg_has_role('dermaos_admin', rolname, 'MEMBER') AS admin_is_member
      FROM pg_roles
     WHERE rolname IN ('dermaos_admin','dermaos_authn','dermaos_app','dermaos_worker')
     ORDER BY rolname
  LOOP
    RAISE NOTICE 'Role %: super=% createrole=% bypassrls=% canlogin=% admin_member=%',
      r.rolname, r.rolsuper, r.rolcreaterole, r.rolbypassrls, r.rolcanlogin, r.admin_is_member;
  END LOOP;

  -- 3. Tentar assumir ownership dos schemas (precisa ser owner ou superuser)
  FOREACH s IN ARRAY ARRAY['shared','clinical','omni','supply','financial','analytics','audit']
  LOOP
    BEGIN
      EXECUTE format('ALTER SCHEMA %I OWNER TO dermaos_admin', s);
      RAISE NOTICE 'ALTER SCHEMA % OWNER TO dermaos_admin: OK', s;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'ALTER SCHEMA % OWNER: % (skipping)', s, SQLERRM;
    END;
  END LOOP;
END $$;

-- 4. Conceder schema access a dermaos_authn (necessário para funções SD em 100)
DO $$
BEGIN
  GRANT USAGE ON SCHEMA shared TO dermaos_authn;
  GRANT USAGE ON SCHEMA omni   TO dermaos_authn;
  RAISE NOTICE 'GRANT USAGE ON SCHEMA shared, omni TO dermaos_authn: OK';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'GRANT USAGE ON SCHEMA failed: % — as funções SECURITY DEFINER podem não funcionar', SQLERRM;
END $$;

-- 5. Conceder acesso a tabelas específicas para dermaos_authn
DO $$
BEGIN
  GRANT SELECT, UPDATE ON shared.users   TO dermaos_authn;
  GRANT SELECT          ON shared.clinics TO dermaos_authn;
  GRANT SELECT          ON omni.channels  TO dermaos_authn;
  RAISE NOTICE 'GRANT em shared.users, clinics, omni.channels TO dermaos_authn: OK';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'GRANT em tabelas falhou: %', SQLERRM;
END $$;
