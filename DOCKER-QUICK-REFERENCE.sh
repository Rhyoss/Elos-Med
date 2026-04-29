#!/bin/bash
# Quick Reference Card for DermaOS Docker Commands

# Colors (for reference)
: '
export RED="\033[0;31m"
export GREEN="\033[0;32m"
export YELLOW="\033[1;33m"
export BLUE="\033[0;34m"
export NC="\033[0m"  # No Color
'

cat << 'EOF'
╔══════════════════════════════════════════════════════════════════════════════╗
║                   DermaOS Docker Quick Reference                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

📋 SETUP
─────────────────────────────────────────────────────────────────────────────
1. First time:
   cp .env.local.example .env          # Create env file
   nano .env                           # Edit secrets (optional for dev)

2. Source helpers (optional):
   source ./docker-helpers.sh          # Load helper functions

3. Start services:
   docker compose -f docker-compose.yml -f docker-compose.dev.yml \
     --profile dev up -d               # Development mode
   # OR
   pnpm docker:dev                     # Shortcut from package.json


🚀 DEVELOPMENT WORKFLOW
─────────────────────────────────────────────────────────────────────────────
# View logs
docker compose logs -f api             # Single service
docker compose logs -f                 # All services

# Run commands in containers
docker compose exec api pnpm build     # Rebuild API
docker compose exec api pnpm lint      # Run linter
docker compose exec web pnpm build     # Rebuild frontend

# Database access
docker compose exec db psql \
  -U dermaos_app -d dermaos            # Connect to PostgreSQL
docker compose exec db pg_dump \
  -U dermaos_app dermaos > backup.sql  # Backup database

# Run migrations
docker compose exec api pnpm run db:migrate

# Hot reload (watches source code)
docker compose watch


📊 MONITORING
─────────────────────────────────────────────────────────────────────────────
# Container status
docker compose ps                      # List running services
docker compose stats                   # Resource usage (CPU, memory)
docker compose top api                 # Top processes in container

# Service health
docker inspect dermaos-db              # Detailed container info
docker compose exec api curl \
  -I http://localhost:3001/health      # Health endpoint


🧹 CLEANUP
─────────────────────────────────────────────────────────────────────────────
# Stop services (keep volumes)
docker compose down                    # Stop all services

# Stop and remove volumes (warning: deletes database)
docker compose down -v                 # Remove volumes too

# Remove images/volumes/networks
docker system prune -a --volumes       # Full cleanup
docker image prune -a                  # Remove unused images
docker volume prune                    # Remove unused volumes

# Clean build cache
docker builder prune --all-unused


🏗️ BUILDING & TESTING
─────────────────────────────────────────────────────────────────────────────
# Build images
docker compose build                   # Build all services
docker compose build api --no-cache    # Rebuild without cache

# Test specific service
docker compose build --no-cache api    # Rebuild API
docker compose up -d api               # Start (or restart with new build)

# Use BuildKit for faster builds (recommended)
DOCKER_BUILDKIT=1 docker compose build


🔧 TROUBLESHOOTING
─────────────────────────────────────────────────────────────────────────────
# Check container logs
docker logs dermaos-api                # Raw logs
docker logs -f dermaos-api             # Follow logs
docker logs --tail 100 dermaos-api     # Last 100 lines

# Check why container exited
docker inspect dermaos-api | grep -A 5 '"State"'

# Network issues
docker network ls                      # List networks
docker network inspect dermaos-internal # Network details
docker compose exec api nslookup cache # DNS test

# Test connectivity
docker compose exec api curl -I http://api:3001/health
docker compose exec api redis-cli -a password ping

# View environment variables
docker compose exec api env | grep DB


📋 SERVICES REFERENCE
─────────────────────────────────────────────────────────────────────────────
Infrastructure:
  db           PostgreSQL 16 + pgvector    :5432 (localhost)
  cache        Redis 7                     :6379 (localhost)
  storage      MinIO (S3)                  :9000, :9001 (console)
  search       Typesense                   :8108 (localhost)
  ollama       Ollama (AI)                 :11434 (localhost)
  proxy        Nginx reverse proxy         :80, :443

Applications:
  api          Fastify + tRPC backend      :3001
  web          Next.js frontend            :3000
  worker       BullMQ jobs                 (no port)
  ai           FastAPI AI service          :8000

Development only:
  pgadmin      PostgreSQL GUI              :5050


🌐 WEB URLS (Development)
─────────────────────────────────────────────────────────────────────────────
Frontend:           http://localhost:3000
API:                http://localhost:3001
AI Service:         http://localhost:8000
pgAdmin:            http://localhost:5050
MinIO Console:      http://localhost:9001
Ollama:             http://localhost:11434
Typesense:          http://localhost:8108


📚 FOR MORE HELP
─────────────────────────────────────────────────────────────────────────────
Helper functions:
  source ./docker-helpers.sh
  usage                               # Show all commands

Comprehensive guide:
  cat DOCKER.md                       # Best practices & troubleshooting

Full Docker Compose reference:
  docker compose --help
  docker compose up --help


🎯 COMMON PATTERNS
─────────────────────────────────────────────────────────────────────────────
# Start fresh (clean slate)
docker compose down -v && docker compose up -d

# Rebuild and restart a service
docker compose up -d --build --force-recreate api

# Check if service is healthy
docker compose exec api curl -f http://localhost:3001/health

# Run one-off command
docker compose run --rm api pnpm lint

# Monitor real-time activity
watch -n 1 'docker compose stats --no-stream'

# Backup & restore
docker compose exec db pg_dump -U dermaos_app dermaos | gzip > backup.sql.gz
gunzip < backup.sql.gz | docker compose exec -T db psql -U dermaos_app dermaos


╚══════════════════════════════════════════════════════════════════════════════╝
EOF
