#!/bin/bash
# Docker CLI helpers for DermaOS
# Usage: source ./docker-helpers.sh OR chmod +x && ./docker-helpers.sh <command>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─── Helper functions ─────────────────────────────────────────────────────
log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

# ─── Development helpers ──────────────────────────────────────────────────
dev_up() {
  log_info "Starting development environment..."
  docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev up -d
  log_success "Dev environment started"
  log_info "Services: http://localhost:3000 (web), http://localhost:3001 (api), http://localhost:5050 (pgAdmin)"
}

dev_down() {
  log_info "Stopping development environment..."
  docker compose -f docker-compose.yml -f docker-compose.dev.yml down
  log_success "Dev environment stopped"
}

dev_logs() {
  docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f "$@"
}

dev_rebuild() {
  log_info "Rebuilding images..."
  docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache
  log_success "Images rebuilt"
}

# ─── Production helpers ────────────────────────────────────────────────────
prod_up() {
  log_info "Starting production environment..."
  docker compose up -d
  log_success "Production environment started"
}

prod_down() {
  log_info "Stopping production environment..."
  docker compose down
  log_success "Production environment stopped"
}

prod_logs() {
  docker compose logs -f "$@"
}

# ─── Database helpers ─────────────────────────────────────────────────────
db_migrate() {
  log_info "Running database migrations..."
  docker compose exec -T api pnpm run db:migrate
  log_success "Migrations completed"
}

db_shell() {
  log_info "Connecting to database..."
  docker compose exec db psql -U "${POSTGRES_USER:-dermaos_app}" -d "${POSTGRES_DB:-dermaos}"
}

db_reset() {
  log_warn "Resetting database (all data will be lost)..."
  read -p "Are you sure? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker compose down -v
    docker compose up -d db
    sleep 5
    db_migrate
    log_success "Database reset"
  else
    log_info "Cancelled"
  fi
}

# ─── Container helpers ────────────────────────────────────────────────────
container_shell() {
  local container=$1
  if [ -z "$container" ]; then
    log_error "Usage: container_shell <container_name>"
    return 1
  fi
  docker compose exec "$container" /bin/sh
}

container_logs() {
  local container=$1
  docker compose logs -f "$container"
}

# ─── Cleanup helpers ──────────────────────────────────────────────────────
cleanup_images() {
  log_info "Removing unused Docker images..."
  docker image prune -a --force --filter "until=72h"
  log_success "Cleanup complete"
}

cleanup_volumes() {
  log_warn "Removing unused volumes..."
  docker volume prune --force --filter "label!=keep"
  log_success "Cleanup complete"
}

cleanup_all() {
  log_warn "Running full cleanup (images, volumes, networks, buildcache)..."
  docker system prune -a --volumes --force
  log_success "Full cleanup complete"
}

# ─── Health check ─────────────────────────────────────────────────────────
health_check() {
  log_info "Checking service health..."
  docker compose ps
  echo
  log_info "Detailed status:"
  docker compose exec -T db pg_isready -U "${POSTGRES_USER:-dermaos_app}" && log_success "PostgreSQL OK" || log_error "PostgreSQL DOWN"
  docker compose exec -T cache redis-cli -a "${REDIS_PASSWORD}" ping >/dev/null 2>&1 && log_success "Redis OK" || log_error "Redis DOWN"
  docker compose exec -T search wget -q -O- http://localhost:8108/health >/dev/null 2>&1 && log_success "Typesense OK" || log_error "Typesense DOWN"
}

# ─── Print usage ──────────────────────────────────────────────────────────
usage() {
  cat << EOF
Docker helpers for DermaOS

Development:
  dev_up              Start dev environment (docker-compose.yml + dev overrides)
  dev_down            Stop dev environment
  dev_logs [service]  View logs (optionally filtered by service)
  dev_rebuild         Rebuild all images (no cache)

Production:
  prod_up             Start production environment
  prod_down           Stop production environment
  prod_logs [service] View production logs

Database:
  db_migrate          Run pending migrations
  db_shell            Connect to PostgreSQL shell
  db_reset            Reset database (destructive)

Containers:
  container_shell <name>  SSH into a container
  container_logs <name>   View container logs

Cleanup:
  cleanup_images      Remove images older than 72h
  cleanup_volumes     Remove unused volumes
  cleanup_all         Full system cleanup

Monitoring:
  health_check        Check all service health

Usage:
  1. Source this file: source ./docker-helpers.sh
  2. Call functions: dev_up, db_migrate, etc.

  OR run directly: ./docker-helpers.sh dev_up
EOF
}

# ─── Main entry point ─────────────────────────────────────────────────────
if [ "$0" = "${BASH_SOURCE[0]}" ]; then
  # Called as script
  cmd="${1:-}"
  shift || true
  if declare -f "$cmd" > /dev/null; then
    "$cmd" "$@"
  else
    if [ -z "$cmd" ]; then
      usage
    else
      log_error "Unknown command: $cmd"
      usage
      exit 1
    fi
  fi
else
  # Sourced — just make functions available
  log_info "Docker helpers loaded. Run 'usage' for commands."
fi
