#!/usr/bin/env bash
# scripts/backup.sh — Backup do banco de dados DermaOS
#
# Comportamento:
#   1. Verifica espaço disponível (mínimo 500MB)
#   2. pg_dump formato custom (-Fc) para restauração eficiente
#   3. Verifica integridade do dump (pg_restore --list)
#   4. Criptografa com AES-256-CBC antes do upload
#   5. Upload para MinIO bucket 'backups'
#   6. Retenção: últimos 30 diários, 12 mensais
#
# Uso:
#   bash scripts/backup.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Cores ──────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[backup]${NC} $*"; }
ok()   { echo -e "${GREEN}[backup]${NC} ✓ $*"; }
warn() { echo -e "${YELLOW}[backup]${NC} ⚠  $*"; }
fail() { echo -e "${RED}[backup]${NC} ✗ $*" >&2; exit 1; }

# ── Carrega .env ───────────────────────────────────────────────────────────────
cd "$ROOT_DIR"
# shellcheck disable=SC1091
[[ -f .env ]] && set -a && source .env && set +a

# ── Variáveis ──────────────────────────────────────────────────────────────────
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-dermaos}"
DB_USER="${POSTGRES_USER:-dermaos}"
export PGPASSWORD="${POSTGRES_PASSWORD}"

BACKUP_DIR="${BACKUP_LOCAL_DIR:-/tmp/dermaos-backups}"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
DUMP_FILE="$BACKUP_DIR/backup_dermaos_${TIMESTAMP}.dump"
ENCRYPTED_FILE="${DUMP_FILE}.enc"

MINIO_ENDPOINT="${MINIO_ENDPOINT:-localhost}"
MINIO_PORT_NUM="${MINIO_PORT:-9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-${MINIO_ROOT_USER:-}}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-${MINIO_ROOT_PASSWORD:-}}"
MINIO_BUCKET="backups"

BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

START_TIME=$(date +%s)

# ── Pré-condições ──────────────────────────────────────────────────────────────
check_prerequisites() {
  command -v pg_dump     &>/dev/null || fail "pg_dump não encontrado. Instale postgresql-client."
  command -v pg_restore  &>/dev/null || fail "pg_restore não encontrado."
  command -v openssl     &>/dev/null || fail "openssl não encontrado."

  if [[ -z "$BACKUP_ENCRYPTION_KEY" ]]; then
    fail "BACKUP_ENCRYPTION_KEY não definida. Configure no .env antes de executar backup."
  fi

  mkdir -p "$BACKUP_DIR"
}

check_disk_space() {
  log "Verificando espaço em disco..."
  local min_mb=500
  local available_mb

  if command -v df &>/dev/null; then
    available_mb=$(df -m "$BACKUP_DIR" | awk 'NR==2 {print $4}')
    if [[ "$available_mb" -lt "$min_mb" ]]; then
      fail "Espaço insuficiente em $BACKUP_DIR: ${available_mb}MB disponível (mínimo ${min_mb}MB)"
    fi
    ok "Espaço disponível: ${available_mb}MB"
  fi
}

check_db_connection() {
  log "Verificando conexão com o banco..."
  if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &>/dev/null 2>&1; then
    fail "Não foi possível conectar ao banco. Verifique se o PostgreSQL está rodando."
  fi
  ok "Banco acessível"
}

# ── Backup ─────────────────────────────────────────────────────────────────────
create_dump() {
  log "Executando pg_dump (formato custom -Fc)..."

  pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -Fc \
    --no-password \
    -f "$DUMP_FILE"

  local dump_size
  dump_size=$(du -sh "$DUMP_FILE" | cut -f1)
  ok "Dump criado: $(basename "$DUMP_FILE") ($dump_size)"
}

verify_dump_integrity() {
  log "Verificando integridade do dump..."

  if ! pg_restore --list "$DUMP_FILE" &>/dev/null 2>&1; then
    rm -f "$DUMP_FILE"
    fail "Dump corrompido — arquivo removido. Verifique o PostgreSQL."
  fi

  local object_count
  object_count=$(pg_restore --list "$DUMP_FILE" | grep -c '^[0-9]' || echo "0")
  ok "Dump válido ($object_count objetos)"
}

encrypt_dump() {
  log "Criptografando dump (AES-256-CBC)..."

  openssl enc -aes-256-cbc -pbkdf2 -iter 100000 \
    -in  "$DUMP_FILE" \
    -out "$ENCRYPTED_FILE" \
    -k   "$BACKUP_ENCRYPTION_KEY"

  # Verifica que o arquivo criptografado pode ser descriptografado (sem extrair)
  if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
    -in "$ENCRYPTED_FILE" \
    -k  "$BACKUP_ENCRYPTION_KEY" \
    -out /dev/null 2>/dev/null; then
    rm -f "$DUMP_FILE" "$ENCRYPTED_FILE"
    fail "Falha na verificação da criptografia. Backup removido."
  fi

  # Remove dump não-criptografado imediatamente após verificação
  rm -f "$DUMP_FILE"

  local enc_size
  enc_size=$(du -sh "$ENCRYPTED_FILE" | cut -f1)
  ok "Arquivo criptografado: $(basename "$ENCRYPTED_FILE") ($enc_size)"
}

# ── Upload para MinIO ─────────────────────────────────────────────────────────
upload_to_minio() {
  if ! command -v mc &>/dev/null; then
    warn "mc (MinIO Client) não encontrado — pulando upload. Backup salvo em $ENCRYPTED_FILE"
    return 0
  fi

  log "Fazendo upload para MinIO ($MINIO_BUCKET)..."

  mc alias set dermaos-backup \
    "http://${MINIO_ENDPOINT}:${MINIO_PORT_NUM}" \
    "$MINIO_ACCESS_KEY" \
    "$MINIO_SECRET_KEY" \
    &>/dev/null

  mc cp "$ENCRYPTED_FILE" "dermaos-backup/$MINIO_BUCKET/" &>/dev/null

  ok "Upload concluído: s3://$MINIO_BUCKET/$(basename "$ENCRYPTED_FILE")"

  # Remove arquivo local após upload bem-sucedido
  rm -f "$ENCRYPTED_FILE"
}

# ── Retenção ───────────────────────────────────────────────────────────────────
apply_retention() {
  if ! command -v mc &>/dev/null; then
    return 0
  fi

  log "Aplicando política de retenção (30 diários, 12 mensais)..."

  # Lista todos os backups ordenados por data (mais antigos primeiro)
  mapfile -t all_backups < <(
    mc ls "dermaos-backup/$MINIO_BUCKET/" 2>/dev/null \
    | grep "backup_dermaos_" \
    | awk '{print $NF}' \
    | sort
  )

  local total=${#all_backups[@]}
  local keep_daily=30
  local keep_monthly=12

  # Backups mensais: primeiro backup de cada mês (identificado por YYYY-MM)
  declare -A monthly_kept=()
  declare -a to_keep=()

  for backup in "${all_backups[@]}"; do
    local month
    month=$(echo "$backup" | grep -oP '\d{4}-\d{2}' | head -1 || echo "")
    if [[ -n "$month" ]] && [[ ${#monthly_kept[@]} -lt $keep_monthly ]]; then
      if [[ -z "${monthly_kept[$month]:-}" ]]; then
        monthly_kept["$month"]="$backup"
        to_keep+=("$backup")
      fi
    fi
  done

  # Backups diários: últimos N
  local daily_start=$(( total > keep_daily ? total - keep_daily : 0 ))
  for (( i=daily_start; i<total; i++ )); do
    to_keep+=("${all_backups[$i]}")
  done

  # Remove os que não estão na lista de retenção
  local removed=0
  for backup in "${all_backups[@]}"; do
    local keep=false
    for k in "${to_keep[@]}"; do
      [[ "$backup" == "$k" ]] && keep=true && break
    done
    if [[ "$keep" == "false" ]]; then
      mc rm "dermaos-backup/$MINIO_BUCKET/$backup" &>/dev/null && removed=$((removed + 1))
    fi
  done

  ok "Retenção aplicada: $removed backup(s) removido(s), $((total - removed)) mantido(s)"
}

# ── Log final ─────────────────────────────────────────────────────────────────
log_summary() {
  local end_time duration
  end_time=$(date +%s)
  duration=$(( end_time - START_TIME ))

  echo ""
  ok "Backup concluído em ${duration}s"
  log "Timestamp: $TIMESTAMP"
  log "Banco: $DB_NAME @ $DB_HOST:$DB_PORT"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo "╔══════════════════════════════════════╗"
  echo "║        DermaOS — Backup              ║"
  echo "╚══════════════════════════════════════╝"
  echo ""

  check_prerequisites
  check_disk_space
  check_db_connection
  create_dump
  verify_dump_integrity
  encrypt_dump
  upload_to_minio
  apply_retention
  log_summary
}

main "$@"
