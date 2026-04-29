#!/bin/bash
# Verify Docker setup for DermaOS

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

passed=0
failed=0

test_file() {
  local file=$1
  local desc=$2
  
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} $desc"
    ((passed++))
  else
    echo -e "${RED}✗${NC} $desc (missing: $file)"
    ((failed++))
  fi
}

test_dir() {
  local dir=$1
  local desc=$2
  
  if [ -d "$dir" ]; then
    echo -e "${GREEN}✓${NC} $desc"
    ((passed++))
  else
    echo -e "${RED}✗${NC} $desc (missing: $dir)"
    ((failed++))
  fi
}

echo -e "${BLUE}DermaOS Docker Setup Verification${NC}\n"

echo "Dockerfiles:"
test_file "./apps/api/Dockerfile" "API Dockerfile (multi-stage)"
test_file "./apps/api/Dockerfile.dev" "API Dockerfile dev"
test_file "./apps/web/Dockerfile" "Web Dockerfile (multi-stage)"
test_file "./apps/web/Dockerfile.dev" "Web Dockerfile dev"
test_file "./apps/worker/Dockerfile" "Worker Dockerfile (multi-stage)"
test_file "./apps/worker/Dockerfile.dev" "Worker Dockerfile dev"
test_file "./apps/ai/Dockerfile" "AI Dockerfile (multi-stage)"

echo
echo ".dockerignore files:"
test_file "./.dockerignore" "Root .dockerignore"
test_file "./apps/api/.dockerignore" "API .dockerignore"
test_file "./apps/web/.dockerignore" "Web .dockerignore"
test_file "./apps/worker/.dockerignore" "Worker .dockerignore"
test_file "./apps/ai/.dockerignore" "AI .dockerignore"

echo
echo "Docker Compose configuration:"
test_file "./docker-compose.yml" "Production compose"
test_file "./docker-compose.dev.yml" "Development compose overrides"

echo
echo "Nginx configuration:"
test_file "./nginx/nginx.conf" "Main Nginx config"
test_file "./nginx/conf.d/locations.conf" "Location routing config"

echo
echo "Helper scripts:"
test_file "./docker-helpers.sh" "Docker helpers (functions)"
test_file "./docker-start.sh" "Docker setup script"

echo
echo "Environment templates:"
test_file "./.env.example" "Production env template"
test_file "./.env.local.example" "Development env template"

echo
echo "Documentation:"
test_file "./DOCKER.md" "Docker best practices guide"

echo
echo -e "${BLUE}Summary:${NC} ${GREEN}$passed passed${NC}, ${RED}$failed failed${NC}"

if [ $failed -eq 0 ]; then
  echo -e "\n${GREEN}✓ All checks passed! Docker setup is complete.${NC}\n"
  echo "Next steps:"
  echo "  1. cp .env.local.example .env"
  echo "  2. Edit .env with your local values"
  echo "  3. docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev up -d"
  echo ""
  exit 0
else
  echo -e "\n${RED}✗ Some checks failed. Please fix the missing files.${NC}\n"
  exit 1
fi
