#!/usr/bin/env bash
# scripts/setup.sh — Configuração inicial do ambiente DermaOS
# Idempotente: pode ser executado múltiplas vezes com o mesmo resultado final.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Cores para output ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[setup]${NC} $*"; }
ok()   { echo -e "${GREEN}[setup]${NC} ✓ $*"; }
warn() { echo -e "${YELLOW}[setup]${NC} ⚠  $*"; }
fail() { echo -e "${RED}[setup]${NC} ✗ $*" >&2; exit 1; }

# ── Pré-condições ──────────────────────────────────────────────────────────────
check_prerequisites() {
  log "Verificando pré-condições..."

  if ! command -v docker &>/dev/null; then
    fail "Docker não encontrado. Instale em: https://docs.docker.com/get-docker/"
  fi

  if ! docker info &>/dev/null 2>&1; then
    fail "Docker não está rodando. Inicie o Docker Desktop ou 'sudo systemctl start docker'."
  fi
  ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"

  if ! command -v node &>/dev/null; then
    fail "Node.js não encontrado. Instale Node.js >= 22 em: https://nodejs.org"
  fi
  NODE_MAJOR=$(node -e "process.stdout.write(process.version.split('.')[0].replace('v',''))")
  if [[ "$NODE_MAJOR" -lt 22 ]]; then
    fail "Node.js >= 22 necessário (encontrado: $(node --version)). Atualize em: https://nodejs.org"
  fi
  ok "Node.js $(node --version)"

  if ! command -v pnpm &>/dev/null; then
    warn "pnpm não encontrado — instalando globalmente..."
    npm install -g pnpm@9.15.0
  fi
  ok "pnpm $(pnpm --version)"
}

# ── Arquivo de variáveis de ambiente ──────────────────────────────────────────
setup_env() {
  log "Configurando .env..."

  cd "$ROOT_DIR"

  if [[ -f .env ]]; then
    ok ".env já existe — preservando configurações existentes"
  else
    if [[ ! -f .env.example ]]; then
      fail ".env.example não encontrado em $ROOT_DIR"
    fi
    cp .env.example .env
    ok ".env criado a partir de .env.example"
    warn "AÇÃO NECESSÁRIA: edite .env com suas configurações antes de continuar."
    warn "Em particular: POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET, ENCRYPTION_KEY"
  fi
}

# ── Infraestrutura (apenas serviços de dados) ──────────────────────────────────
start_infra() {
  log "Iniciando infraestrutura (postgres, redis, minio, typesense)..."

  cd "$ROOT_DIR"

  # Sobe apenas os serviços de infraestrutura — não os apps da aplicação
  docker compose up -d db cache storage search

  log "Aguardando serviços ficarem saudáveis..."

  local max_attempts=30
  local attempt=0

  # PostgreSQL
  while ! docker compose exec -T db pg_isready -U "${POSTGRES_USER:-dermaos}" &>/dev/null; do
    attempt=$((attempt + 1))
    [[ $attempt -ge $max_attempts ]] && fail "PostgreSQL não ficou saudável após ${max_attempts}s"
    echo -n "."
    sleep 1
  done
  ok "PostgreSQL pronto"

  # Redis
  attempt=0
  while ! docker compose exec -T cache redis-cli -a "${REDIS_PASSWORD:-}" ping &>/dev/null 2>&1; do
    attempt=$((attempt + 1))
    [[ $attempt -ge $max_attempts ]] && fail "Redis não ficou saudável após ${max_attempts}s"
    echo -n "."
    sleep 1
  done
  ok "Redis pronto"

  # MinIO (aguarda healthcheck do Docker)
  attempt=0
  while [[ "$(docker inspect --format='{{.State.Health.Status}}' dermaos-storage 2>/dev/null)" != "healthy" ]]; do
    attempt=$((attempt + 1))
    [[ $attempt -ge $max_attempts ]] && fail "MinIO não ficou saudável após ${max_attempts}s"
    echo -n "."
    sleep 1
  done
  ok "MinIO pronto"
}

# ── Dependências Node.js ───────────────────────────────────────────────────────
install_dependencies() {
  log "Instalando dependências Node.js..."
  cd "$ROOT_DIR"

  # --frozen-lockfile garante consistência com pnpm-lock.yaml
  pnpm install --frozen-lockfile
  ok "Dependências instaladas"
}

# ── Migrations ────────────────────────────────────────────────────────────────
run_migrations() {
  log "Executando migrations..."
  cd "$ROOT_DIR"
  bash scripts/migrate.sh
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo "╔══════════════════════════════════════╗"
  echo "║        DermaOS — Setup Inicial       ║"
  echo "╚══════════════════════════════════════╝"
  echo ""

  cd "$ROOT_DIR"

  check_prerequisites
  setup_env

  # Recarrega .env para que as variáveis fiquem disponíveis
  # shellcheck disable=SC1091
  set -a; source .env 2>/dev/null || true; set +a

  start_infra
  install_dependencies
  run_migrations

  echo ""
  ok "Setup concluído com sucesso!"
  echo ""
  echo "  Próximos passos:"
  echo "  1. Execute 'pnpm dev' para iniciar o servidor de desenvolvimento"
  echo "  2. Execute 'bash scripts/seed.sh' para popular o banco com dados de exemplo"
  echo "  3. Acesse http://localhost:3000 (web) e http://localhost:3001 (api)"
  echo ""
}

main "$@"
