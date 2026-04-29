#!/usr/bin/env bash
# =============================================================================
# DermaOS — Bootstrap das roles de aplicação
# -----------------------------------------------------------------------------
# Roda ANTES dos demais init scripts (.sql) por causa do prefixo "000_".
#
# A imagem oficial do Postgres cria a conta POSTGRES_USER como SUPERUSER. Esse
# usuário é destinado APENAS a manutenção/migrations (POSTGRES_ADMIN_USER).
# A aplicação SEMPRE conecta com uma role rebaixada (POSTGRES_APP_USER) que
# tem NOSUPERUSER + NOBYPASSRLS, garantindo que as policies RLS sejam aplicadas
# em todas as queries.
#
# Roles criadas aqui:
#   - dermaos_app       → tRPC API + Next.js SSR (NOSUPERUSER, NOBYPASSRLS)
#   - dermaos_worker    → BullMQ workers (NOSUPERUSER, NOBYPASSRLS)
#   - dermaos_readonly  → relatórios/BI (NOSUPERUSER, NOBYPASSRLS)
#
# Cloud SQL (GCP) — equivalência:
#   - POSTGRES_ADMIN_USER  ≡ usuário com cloudsqlsuperuser (criado via Console
#     ou Terraform). Usado apenas para migrations.
#   - POSTGRES_APP_USER    ≡ role criada por este script (ou via Terraform
#     `google_sql_user`) — sempre NOSUPERUSER NOBYPASSRLS.
#   - As senhas devem vir do Secret Manager (Cloud Run / GKE Workload
#     Identity), nunca de variáveis de ambiente em texto plano.
# =============================================================================

set -euo pipefail

# Variáveis obrigatórias — cada uma do .env do projeto
: "${POSTGRES_APP_USER:?POSTGRES_APP_USER não definido}"
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD não definido}"
: "${POSTGRES_WORKER_USER:?POSTGRES_WORKER_USER não definido}"
: "${POSTGRES_WORKER_PASSWORD:?POSTGRES_WORKER_PASSWORD não definido}"
: "${POSTGRES_READONLY_USER:?POSTGRES_READONLY_USER não definido}"
: "${POSTGRES_READONLY_PASSWORD:?POSTGRES_READONLY_PASSWORD não definido}"

echo "[000_app_roles] Provisionando roles dermaos_* (NOSUPERUSER, NOBYPASSRLS)..."

# Usamos psql variables (:'NAME') para evitar SQL injection nas senhas.
# `format(... %I ..., %L)` faz o quoting correto de identifier e literal.
# `\gexec` executa o SQL gerado pelo SELECT acima.
psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname   "$POSTGRES_DB" \
  --set=APP_USER="$POSTGRES_APP_USER" \
  --set=APP_PASS="$POSTGRES_APP_PASSWORD" \
  --set=WORKER_USER="$POSTGRES_WORKER_USER" \
  --set=WORKER_PASS="$POSTGRES_WORKER_PASSWORD" \
  --set=READONLY_USER="$POSTGRES_READONLY_USER" \
  --set=READONLY_PASS="$POSTGRES_READONLY_PASSWORD" \
  <<'EOSQL'

-- ─── dermaos_app (API + Web SSR) ──────────────────────────────────────────
SELECT format(
  'CREATE ROLE %I LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L',
  :'APP_USER', :'APP_PASS')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'APP_USER')
\gexec

-- Defensivo: se a role já existia (ex: foi criada como POSTGRES_USER por
-- engano em um setup antigo), removemos privilégios elevados e renovamos a senha.
SELECT format(
  'ALTER ROLE %I LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L',
  :'APP_USER', :'APP_PASS')
\gexec

-- ─── dermaos_worker (jobs em background) ──────────────────────────────────
SELECT format(
  'CREATE ROLE %I LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L',
  :'WORKER_USER', :'WORKER_PASS')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'WORKER_USER')
\gexec

SELECT format(
  'ALTER ROLE %I LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L',
  :'WORKER_USER', :'WORKER_PASS')
\gexec

-- ─── dermaos_readonly (BI/relatórios) ─────────────────────────────────────
SELECT format(
  'CREATE ROLE %I LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L',
  :'READONLY_USER', :'READONLY_PASS')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'READONLY_USER')
\gexec

SELECT format(
  'ALTER ROLE %I LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L',
  :'READONLY_USER', :'READONLY_PASS')
\gexec

-- ─── dermaos_authn (autenticação pré-tenant — BYPASSRLS, NOLOGIN) ──────────
-- Role usada APENAS como `OWNER` de funções `SECURITY DEFINER` que precisam
-- consultar tabelas com RLS antes de saber a clinic_id (ex: login lookup
-- por email). NOLOGIN garante que ninguém pode conectar diretamente como
-- esta role; só é alcançável via funções específicas com `EXECUTE` para
-- dermaos_app/worker. Ver db/init/100_security_definer_functions.sql.
DO $authn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dermaos_authn') THEN
    CREATE ROLE dermaos_authn NOLOGIN BYPASSRLS NOSUPERUSER;
  ELSE
    ALTER ROLE dermaos_authn NOLOGIN BYPASSRLS NOSUPERUSER;
  END IF;
END
$authn$;

-- ─── Verificação final: nenhuma role da aplicação pode ser SUPERUSER ──────
DO $verify$
DECLARE
  bad_role TEXT;
BEGIN
  SELECT rolname INTO bad_role
    FROM pg_roles
   WHERE rolname IN (current_setting('app.app_user_check', true))
     AND (rolsuper OR rolbypassrls);

  IF bad_role IS NOT NULL THEN
    RAISE EXCEPTION 'Role % ainda tem SUPERUSER ou BYPASSRLS — abortando bootstrap', bad_role;
  END IF;
END
$verify$;

EOSQL

echo "[000_app_roles] OK — dermaos_app/worker/readonly criadas com privilégios mínimos."
