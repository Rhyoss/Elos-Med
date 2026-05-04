-- Garante que dermaos_admin é membro de dermaos_authn para poder executar
-- ALTER FUNCTION ... OWNER TO dermaos_authn em 100_security_definer_functions.sql.
-- Em bancos provisionados antes de 2026-05-04 este GRANT não existia.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_auth_members m
      JOIN pg_roles r  ON r.oid  = m.roleid
      JOIN pg_roles mr ON mr.oid = m.member
     WHERE r.rolname = 'dermaos_authn'
       AND mr.rolname = 'dermaos_admin'
  ) THEN
    GRANT dermaos_authn TO dermaos_admin WITH ADMIN OPTION;
    RAISE NOTICE 'GRANT dermaos_authn TO dermaos_admin concedido';
  ELSE
    RAISE NOTICE 'dermaos_admin já é membro de dermaos_authn — nada a fazer';
  END IF;
END $$;
