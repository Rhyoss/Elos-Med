-- ============================================================================
-- DermaOS — Grant role memberships to dermaos_admin
-- ----------------------------------------------------------------------------
-- dermaos_admin precisa ser membro dos papéis de aplicação para:
--   1. SET ROLE nos smoke tests (119_security_smoke.sql) que verificam RLS
--   2. Gerenciar objetos próprios dos papéis de aplicação quando necessário
-- ADMIN OPTION permite redelegar o membership (útil para debugging).
-- ============================================================================
DO $$
BEGIN
  IF NOT pg_has_role('dermaos_admin', 'dermaos_app', 'MEMBER') THEN
    GRANT dermaos_app TO dermaos_admin WITH ADMIN OPTION;
    RAISE NOTICE 'GRANT dermaos_app TO dermaos_admin: OK';
  ELSE
    RAISE NOTICE 'dermaos_admin já é membro de dermaos_app';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'GRANT dermaos_app TO dermaos_admin falhou: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT pg_has_role('dermaos_admin', 'dermaos_worker', 'MEMBER') THEN
    GRANT dermaos_worker TO dermaos_admin WITH ADMIN OPTION;
    RAISE NOTICE 'GRANT dermaos_worker TO dermaos_admin: OK';
  ELSE
    RAISE NOTICE 'dermaos_admin já é membro de dermaos_worker';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'GRANT dermaos_worker TO dermaos_admin falhou: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT pg_has_role('dermaos_admin', 'dermaos_readonly', 'MEMBER') THEN
    GRANT dermaos_readonly TO dermaos_admin WITH ADMIN OPTION;
    RAISE NOTICE 'GRANT dermaos_readonly TO dermaos_admin: OK';
  ELSE
    RAISE NOTICE 'dermaos_admin já é membro de dermaos_readonly';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'GRANT dermaos_readonly TO dermaos_admin falhou: %', SQLERRM;
END $$;
