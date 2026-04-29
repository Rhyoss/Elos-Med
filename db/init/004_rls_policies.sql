-- ============================================================================
-- DermaOS — Row-Level Security Policies
-- Garante isolamento total entre tenants (clinics) no banco de dados
-- ============================================================================

-- ─── Função auxiliar: obtém clinic_id do contexto da sessão ──────────────────
-- A aplicação executa: SET app.current_clinic_id = '<uuid>' antes de queries

CREATE OR REPLACE FUNCTION shared.current_clinic_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_clinic_id', true), '')::UUID;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION shared.current_clinic_id() IS
  'Retorna o clinic_id da sessão atual. App deve SET app.current_clinic_id antes de queries.';

-- ─── Roles de banco de dados ─────────────────────────────────────────────────
--
-- IMPORTANTE: as roles dermaos_app, dermaos_worker e dermaos_readonly são
-- criadas em `000_app_roles.sh` (com NOSUPERUSER NOBYPASSRLS e senha vinda
-- de POSTGRES_*_PASSWORD). Este script apenas:
--   1. Cria a role administrativa (dermaos_admin) se necessária.
--   2. Reaplica defensivamente os atributos das roles da aplicação
--      (caso o ambiente tenha sido provisionado fora do entrypoint do Docker —
--      ex.: Cloud SQL via Console com defaults indesejados).
--   3. Concede permissões de schema e tabelas.

-- Defensivo: garantir que NENHUMA role da aplicação tem SUPERUSER ou BYPASSRLS.
-- Sem isso, RLS é totalmente ignorada (CWE-269).
DO $$
DECLARE
  app_role TEXT;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['dermaos_app', 'dermaos_worker', 'dermaos_readonly']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format(
        'ALTER ROLE %I NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE',
        app_role
      );
    END IF;
  END LOOP;

  -- Role administrativa — apenas para migrations e manutenção.
  -- Em Cloud SQL, esta role é o usuário com cloudsqlsuperuser provisionado
  -- via Terraform/Console; aqui só criamos se ainda não existe (dev local).
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dermaos_admin') THEN
    CREATE ROLE dermaos_admin LOGIN CREATEDB CREATEROLE;
  END IF;
END $$;

-- ─── Permissões de schema ────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA shared, clinical, omni, supply, financial, analytics, audit
  TO dermaos_app, dermaos_readonly, dermaos_worker;

GRANT ALL ON SCHEMA shared, clinical, omni, supply, financial, analytics, audit
  TO dermaos_admin;

-- dermaos_app: CRUD em todas as tabelas dos schemas de domínio
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA shared
  TO dermaos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA clinical
  TO dermaos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA omni
  TO dermaos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA supply
  TO dermaos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA financial
  TO dermaos_app;
GRANT INSERT ON ALL TABLES IN SCHEMA audit
  TO dermaos_app;

-- dermaos_readonly: somente SELECT
GRANT SELECT ON ALL TABLES IN SCHEMA shared, clinical, omni, supply, financial, analytics
  TO dermaos_readonly;

-- dermaos_worker: acesso cross-clinic (sem RLS) para jobs de background
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA shared, clinical, omni, supply, financial
  TO dermaos_worker;
GRANT INSERT ON ALL TABLES IN SCHEMA audit
  TO dermaos_worker;

-- Garantir que futuras tabelas também recebam as permissões
ALTER DEFAULT PRIVILEGES IN SCHEMA shared
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dermaos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA clinical
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dermaos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA omni
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dermaos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA supply
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dermaos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA financial
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dermaos_app;

-- ─── Ativar RLS nas tabelas shared.* ─────────────────────────────────────────

ALTER TABLE shared.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared.patients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared.services      ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared.appointments  ENABLE ROW LEVEL SECURITY;

-- shared.clinics: RLS especial — usuários só veem a própria clínica
ALTER TABLE shared.clinics ENABLE ROW LEVEL SECURITY;

-- dermaos_admin bypassa RLS (para migrations e manutenção)
ALTER TABLE shared.clinics       FORCE ROW LEVEL SECURITY;
ALTER TABLE shared.users         FORCE ROW LEVEL SECURITY;
ALTER TABLE shared.patients      FORCE ROW LEVEL SECURITY;
ALTER TABLE shared.services      FORCE ROW LEVEL SECURITY;
ALTER TABLE shared.appointments  FORCE ROW LEVEL SECURITY;

-- ─── Policies: shared.clinics ────────────────────────────────────────────────

CREATE POLICY clinics_isolation_app ON shared.clinics
  FOR ALL TO dermaos_app
  USING (id = shared.current_clinic_id());

CREATE POLICY clinics_isolation_readonly ON shared.clinics
  FOR SELECT TO dermaos_readonly
  USING (id = shared.current_clinic_id());

-- dermaos_worker acessa todas as clínicas (jobs de billing, relatórios globais)
CREATE POLICY clinics_worker_all ON shared.clinics
  FOR ALL TO dermaos_worker
  USING (true);

-- ─── Policies: shared.users ──────────────────────────────────────────────────

CREATE POLICY users_isolation_app ON shared.users
  FOR ALL TO dermaos_app
  USING (clinic_id = shared.current_clinic_id());

CREATE POLICY users_isolation_readonly ON shared.users
  FOR SELECT TO dermaos_readonly
  USING (clinic_id = shared.current_clinic_id());

CREATE POLICY users_worker_all ON shared.users
  FOR ALL TO dermaos_worker
  USING (true);

-- ─── Policies: shared.patients ───────────────────────────────────────────────

CREATE POLICY patients_isolation_app ON shared.patients
  FOR ALL TO dermaos_app
  USING (clinic_id = shared.current_clinic_id());

CREATE POLICY patients_isolation_readonly ON shared.patients
  FOR SELECT TO dermaos_readonly
  USING (clinic_id = shared.current_clinic_id());

CREATE POLICY patients_worker_all ON shared.patients
  FOR ALL TO dermaos_worker
  USING (true);

-- ─── Policies: shared.services ───────────────────────────────────────────────

CREATE POLICY services_isolation_app ON shared.services
  FOR ALL TO dermaos_app
  USING (clinic_id = shared.current_clinic_id());

CREATE POLICY services_isolation_readonly ON shared.services
  FOR SELECT TO dermaos_readonly
  USING (clinic_id = shared.current_clinic_id());

CREATE POLICY services_worker_all ON shared.services
  FOR ALL TO dermaos_worker
  USING (true);

-- ─── Policies: shared.appointments ───────────────────────────────────────────

CREATE POLICY appointments_isolation_app ON shared.appointments
  FOR ALL TO dermaos_app
  USING (clinic_id = shared.current_clinic_id());

CREATE POLICY appointments_isolation_readonly ON shared.appointments
  FOR SELECT TO dermaos_readonly
  USING (clinic_id = shared.current_clinic_id());

CREATE POLICY appointments_worker_all ON shared.appointments
  FOR ALL TO dermaos_worker
  USING (true);
