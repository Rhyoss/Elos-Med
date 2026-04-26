#!/usr/bin/env bash
# scripts/seed.sh — Popula o banco com dados de desenvolvimento/demonstração
#
# Comportamento:
#   - Bloqueia execução em NODE_ENV=production sem --force-production
#   - Verifica se migrations foram aplicadas antes de semear
#   - Idempotente: usa UPSERT — executar duas vezes = mesmo resultado
#   - Detecta se seed já foi executado (tabela _seed_history)
#
# Uso:
#   bash scripts/seed.sh                        # desenvolvimento
#   bash scripts/seed.sh --force-production     # produção (use com cautela)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Cores ──────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[seed]${NC} $*"; }
ok()   { echo -e "${GREEN}[seed]${NC} ✓ $*"; }
warn() { echo -e "${YELLOW}[seed]${NC} ⚠  $*"; }
fail() { echo -e "${RED}[seed]${NC} ✗ $*" >&2; exit 1; }

FORCE_PRODUCTION=false
for arg in "$@"; do
  [[ "$arg" == "--force-production" ]] && FORCE_PRODUCTION=true
done

# ── Carrega .env ───────────────────────────────────────────────────────────────
cd "$ROOT_DIR"
# shellcheck disable=SC1091
[[ -f .env ]] && set -a && source .env && set +a

# ── Variáveis de conexão ───────────────────────────────────────────────────────
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-dermaos}"
DB_USER="${POSTGRES_USER:-dermaos}"
export PGPASSWORD="${POSTGRES_PASSWORD}"

PSQL="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"

# ── Guarda de produção ─────────────────────────────────────────────────────────
guard_production() {
  local env="${NODE_ENV:-development}"
  if [[ "$env" == "production" ]] && [[ "$FORCE_PRODUCTION" != "true" ]]; then
    fail "BLOQUEADO: seed em NODE_ENV=production é proibido sem --force-production.
         Use 'bash scripts/seed.sh --force-production' APENAS se souber o que está fazendo."
  fi
  if [[ "$env" == "production" ]]; then
    warn "⚠️  Executando seed em PRODUÇÃO (--force-production fornecido)"
    warn "Isso sobrescreverá dados existentes via UPSERT."
    warn "Continuar? [y/N]"
    read -r answer
    [[ "$answer" =~ ^[Yy]$ ]] || fail "Abortado pelo usuário."
  fi
}

# ── Pré-condições ─────────────────────────────────────────────────────────────
check_db_connection() {
  log "Verificando conexão..."
  if ! $PSQL -c "SELECT 1" &>/dev/null 2>&1; then
    fail "Banco inacessível. Execute 'bash scripts/setup.sh' primeiro."
  fi
  ok "Banco acessível"
}

check_migrations_applied() {
  log "Verificando se migrations foram aplicadas..."

  # Verifica se tabela _migrations existe
  local has_table
  has_table=$($PSQL -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '_migrations'" | xargs)

  if [[ "$has_table" -eq 0 ]]; then
    fail "Tabela _migrations não encontrada. Execute 'bash scripts/migrate.sh' antes do seed."
  fi

  local migration_count
  migration_count=$($PSQL -t -c "SELECT COUNT(*) FROM _migrations" | xargs)
  ok "$migration_count migration(s) aplicada(s)"
}

# ── Controle de idempotência ───────────────────────────────────────────────────
ensure_seed_history_table() {
  $PSQL <<-SQL
    CREATE TABLE IF NOT EXISTS _seed_history (
      id         SERIAL PRIMARY KEY,
      seed_name  TEXT        NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      row_count  INTEGER
    );
SQL
}

check_seed_already_run() {
  local seed_name="initial"
  local already_run
  already_run=$($PSQL -t -c "SELECT COUNT(*) FROM _seed_history WHERE seed_name = '$seed_name'" | xargs)

  if [[ "$already_run" -gt 0 ]]; then
    warn "Seed '$seed_name' já foi executado anteriormente."
    warn "Re-executar vai fazer UPSERT (atualizar registros existentes). Continuar? [y/N]"
    read -r answer
    [[ "$answer" =~ ^[Yy]$ ]] || { ok "Seed cancelado — banco não foi alterado."; exit 0; }
  fi
}

# ── Seed de dados ──────────────────────────────────────────────────────────────
run_seed() {
  log "Inserindo dados de exemplo..."

  local clinics_created=0
  local users_created=0
  local patients_created=0
  local products_created=0

  # ── Clínicas de demonstração ───────────────────────────────────────────────
  $PSQL <<-'SQL'
    INSERT INTO clinics (id, name, cnpj, email, phone, address, plan, status, created_at)
    VALUES
      ('00000000-0000-0000-0000-000000000001',
       'Clínica DermaOS Demo', '00.000.000/0001-00',
       'demo@dermaos.com.br', '(11) 9000-0000',
       '{"street":"Av. Paulista","number":"1000","city":"São Paulo","state":"SP","zip":"01310-100"}',
       'professional', 'active', now())
    ON CONFLICT (id) DO UPDATE SET
      name       = EXCLUDED.name,
      email      = EXCLUDED.email,
      updated_at = now();
SQL

  clinics_created=$($PSQL -t -c "SELECT COUNT(*) FROM clinics WHERE id = '00000000-0000-0000-0000-000000000001'" | xargs)

  # ── Usuários de demonstração (senha: Demo@12345) ───────────────────────────
  # Hash bcrypt de 'Demo@12345' (rounds=12) — NÃO use em produção real
  $PSQL <<-'SQL'
    INSERT INTO users (id, clinic_id, name, email, password_hash, role, status, created_at)
    VALUES
      ('00000000-0000-0000-0001-000000000001',
       '00000000-0000-0000-0000-000000000001',
       'Admin Demo', 'admin@dermaos.demo',
       '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeOwOhDlFZIpHOL3a',
       'admin', 'active', now()),
      ('00000000-0000-0000-0001-000000000002',
       '00000000-0000-0000-0000-000000000001',
       'Dr. Ana Lima', 'medico@dermaos.demo',
       '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeOwOhDlFZIpHOL3a',
       'doctor', 'active', now()),
      ('00000000-0000-0000-0001-000000000003',
       '00000000-0000-0000-0000-000000000001',
       'Recepcionista Demo', 'recep@dermaos.demo',
       '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeOwOhDlFZIpHOL3a',
       'receptionist', 'active', now())
    ON CONFLICT (id) DO UPDATE SET
      name       = EXCLUDED.name,
      email      = EXCLUDED.email,
      updated_at = now();
SQL

  users_created=$($PSQL -t -c "SELECT COUNT(*) FROM users WHERE clinic_id = '00000000-0000-0000-0000-000000000001'" | xargs)

  # ── Pacientes de demonstração ─────────────────────────────────────────────
  $PSQL <<-'SQL'
    INSERT INTO patients (id, clinic_id, name, email, cpf, birth_date, sex, phone, status, created_at)
    VALUES
      ('00000000-0000-0000-0002-000000000001',
       '00000000-0000-0000-0000-000000000001',
       'João Silva Demo', 'joao.demo@example.com',
       '000.000.000-00', '1985-03-15', 'M', '(11) 9000-0001',
       'active', now()),
      ('00000000-0000-0000-0002-000000000002',
       '00000000-0000-0000-0000-000000000001',
       'Maria Souza Demo', 'maria.demo@example.com',
       '111.111.111-11', '1990-07-22', 'F', '(11) 9000-0002',
       'active', now())
    ON CONFLICT (id) DO UPDATE SET
      name       = EXCLUDED.name,
      updated_at = now();
SQL

  patients_created=$($PSQL -t -c "SELECT COUNT(*) FROM patients WHERE clinic_id = '00000000-0000-0000-0000-000000000001'" | xargs)

  # ── Registra seed como executado ───────────────────────────────────────────
  local total_rows=$(( clinics_created + users_created + patients_created + products_created ))

  $PSQL <<-SQL
    INSERT INTO _seed_history (seed_name, row_count)
    VALUES ('initial', $total_rows)
    ON CONFLICT (seed_name) DO UPDATE SET
      executed_at = now(),
      row_count   = EXCLUDED.row_count;
SQL

  echo ""
  ok "Seed concluído:"
  ok "  Clínicas:   $clinics_created"
  ok "  Usuários:   $users_created"
  ok "  Pacientes:  $patients_created"
  echo ""
  warn "Credenciais de demonstração (NUNCA usar em produção):"
  warn "  admin@dermaos.demo  / Demo@12345"
  warn "  medico@dermaos.demo / Demo@12345"
  warn "  recep@dermaos.demo  / Demo@12345"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo "╔══════════════════════════════════════╗"
  echo "║         DermaOS — Seed               ║"
  echo "╚══════════════════════════════════════╝"
  echo ""

  guard_production
  check_db_connection
  check_migrations_applied
  ensure_seed_history_table
  check_seed_already_run
  run_seed
}

main "$@"
