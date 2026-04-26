#!/usr/bin/env bash
# scripts/migrate.sh — Executa migrations SQL em ordem numérica
#
# Comportamento:
#   - Registra migrations executadas em tabela _migrations (idempotência)
#   - Verifica checksum: impede re-execução de arquivo modificado
#   - Executa cada migration em transação (rollback se falhar)
#   - Em produção: faz backup automático antes de iniciar
#   - Suporta --dry-run para listar pending sem executar
#
# Uso:
#   bash scripts/migrate.sh              # executa pending
#   bash scripts/migrate.sh --dry-run   # lista pending sem executar
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$ROOT_DIR/db/migrations"

# ── Cores ──────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[migrate]${NC} $*"; }
ok()   { echo -e "${GREEN}[migrate]${NC} ✓ $*"; }
warn() { echo -e "${YELLOW}[migrate]${NC} ⚠  $*"; }
fail() { echo -e "${RED}[migrate]${NC} ✗ $*" >&2; exit 1; }

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# ── Carrega .env se existir ────────────────────────────────────────────────────
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

# ── Pré-condição: banco acessível ─────────────────────────────────────────────
check_db_connection() {
  log "Verificando conexão com o banco..."
  if ! $PSQL -c "SELECT 1" &>/dev/null 2>&1; then
    fail "Não foi possível conectar ao banco $DB_NAME em $DB_HOST:$DB_PORT. Verifique se o banco está rodando."
  fi
  ok "Conexão ok ($DB_USER@$DB_HOST:$DB_PORT/$DB_NAME)"
}

# ── Cria tabela de controle se não existir ─────────────────────────────────────
ensure_migrations_table() {
  $PSQL <<-SQL
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      filename    TEXT        NOT NULL UNIQUE,
      checksum    TEXT        NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
SQL
}

# ── Calcula checksum do arquivo ───────────────────────────────────────────────
file_checksum() {
  local file="$1"
  if command -v sha256sum &>/dev/null; then
    sha256sum "$file" | awk '{print $1}'
  else
    shasum -a 256 "$file" | awk '{print $1}'
  fi
}

# ── Backup automático em produção ─────────────────────────────────────────────
maybe_backup() {
  if [[ "${NODE_ENV:-development}" == "production" ]]; then
    log "Ambiente de produção detectado — executando backup antes das migrations..."
    if ! bash "$SCRIPT_DIR/backup.sh"; then
      warn "Backup falhou. Continuar mesmo assim? [y/N]"
      read -r answer
      [[ "$answer" =~ ^[Yy]$ ]] || fail "Abortado pelo usuário."
    fi
    ok "Backup concluído"
  fi
}

# ── Lista e executa migrations ─────────────────────────────────────────────────
run_migrations() {
  if [[ ! -d "$MIGRATIONS_DIR" ]]; then
    warn "Diretório $MIGRATIONS_DIR não encontrado — nenhuma migration para executar."
    return 0
  fi

  # Lista arquivos SQL em ordem numérica
  mapfile -t sql_files < <(find "$MIGRATIONS_DIR" -name "*.sql" | sort)

  if [[ ${#sql_files[@]} -eq 0 ]]; then
    ok "Nenhuma migration encontrada em $MIGRATIONS_DIR"
    return 0
  fi

  local pending=0
  local skipped=0
  local executed=0

  for file in "${sql_files[@]}"; do
    local filename
    filename="$(basename "$file")"
    local checksum
    checksum="$(file_checksum "$file")"

    # Consulta se migration já foi executada
    local row
    row=$($PSQL -t -c "SELECT filename, checksum FROM _migrations WHERE filename = '$filename'" 2>/dev/null | xargs)

    if [[ -n "$row" ]]; then
      # Migration já executada — verifica integridade do arquivo
      local stored_checksum
      stored_checksum=$(echo "$row" | awk '{print $2}')

      if [[ "$stored_checksum" != "$checksum" ]]; then
        fail "Migration '$filename' foi MODIFICADA após ter sido executada (checksum diverge). " \
             "Crie uma nova migration para alterar o schema — nunca edite migrations executadas."
      fi

      skipped=$((skipped + 1))
      continue
    fi

    pending=$((pending + 1))

    if [[ "$DRY_RUN" == "true" ]]; then
      echo "  [DRY-RUN] Pendente: $filename"
      continue
    fi

    log "Executando: $filename..."

    # Executa em transação — rollback automático se SQL inválido
    if $PSQL <<-SQL
      BEGIN;
      \i $file
      INSERT INTO _migrations (filename, checksum) VALUES ('$filename', '$checksum');
      COMMIT;
SQL
    then
      ok "$filename"
      executed=$((executed + 1))
    else
      # A transação já fez rollback — migrations anteriores preservadas
      fail "Migration '$filename' falhou. Rollback da migration atual executado. Migrations anteriores preservadas."
    fi
  done

  echo ""
  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY-RUN: $pending migration(s) pendente(s), $skipped já executada(s)"
  else
    ok "$executed migration(s) executada(s), $skipped já aplicada(s), $((skipped + executed)) total"
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  echo ""
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "╔══════════════════════════════════════╗"
    echo "║     DermaOS — Migrations (DRY-RUN)   ║"
    echo "╚══════════════════════════════════════╝"
  else
    echo "╔══════════════════════════════════════╗"
    echo "║        DermaOS — Migrations          ║"
    echo "╚══════════════════════════════════════╝"
  fi
  echo ""

  check_db_connection
  maybe_backup
  ensure_migrations_table
  run_migrations

  echo ""
  ok "Migrations concluídas"
}

main "$@"
