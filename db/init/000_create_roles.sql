-- ============================================================================
-- DermaOS — Bootstrap das roles de aplicação (Cloud SQL / migrate runner)
-- ============================================================================
-- Este arquivo é o equivalente SQL de 000_app_roles.sh para uso pelo
-- migration runner (que só processa .sql). Em Docker local, 000_app_roles.sh
-- roda primeiro e cria as roles com senhas via variáveis de ambiente.
--
-- Aqui apenas garantimos que as roles existem com os atributos corretos:
--   - dermaos_app / dermaos_worker / dermaos_readonly: criadas via Cloud SQL
--     Console ou Terraform com senha — este script só reforça os atributos.
--   - dermaos_authn: NOLOGIN + BYPASSRLS — owner das funções SECURITY DEFINER
--     pré-tenant (login lookup, refresh). Sem BYPASSRLS, as funções SD falham.
-- ============================================================================

-- ─── dermaos_authn (SECURITY DEFINER owner — BYPASSRLS + NOLOGIN) ────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dermaos_authn') THEN
    BEGIN
      -- cloudsqlsuperuser pode criar roles com BYPASSRLS (Cloud SQL 13+).
      CREATE ROLE dermaos_authn NOLOGIN BYPASSRLS NOSUPERUSER;
      RAISE NOTICE 'dermaos_authn criada com BYPASSRLS';
    EXCEPTION WHEN insufficient_privilege THEN
      -- Fallback: sem BYPASSRLS. Funções SD de login vão falhar com RLS.
      -- Corrigir manualmente: ALTER ROLE dermaos_authn BYPASSRLS (como postgres).
      CREATE ROLE dermaos_authn NOLOGIN NOSUPERUSER;
      RAISE WARNING 'dermaos_authn criada SEM BYPASSRLS — execute como postgres: ALTER ROLE dermaos_authn BYPASSRLS';
    END;
  ELSE
    -- Role existe: garantir BYPASSRLS está setado.
    BEGIN
      ALTER ROLE dermaos_authn BYPASSRLS NOLOGIN NOSUPERUSER;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE WARNING 'dermaos_authn já existe mas não foi possível confirmar BYPASSRLS — verifique manualmente';
    END;
  END IF;
END $$;

-- ─── Roles da aplicação — reforçar atributos mínimos ──────────────────────────
-- Em Cloud SQL, as roles de app são criadas com senha via gcloud/Terraform.
-- Aqui apenas garantimos que existem (sem senha — idempotente).
DO $$
DECLARE
  r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['dermaos_app', 'dermaos_worker', 'dermaos_readonly']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      BEGIN
        EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOBYPASSRLS', r);
        RAISE NOTICE 'Role % criada (sem senha — configure via Cloud SQL)', r;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Não foi possível criar role %: %', r, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;
