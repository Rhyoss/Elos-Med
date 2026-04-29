#!/bin/bash
# DermaOS Docker Getting Started Guide
# This script can be sourced or executed to set up the development environment

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  DermaOS Docker Setup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"
for cmd in docker docker-compose git; do
  if command -v "$cmd" &> /dev/null; then
    echo -e "${GREEN}✓${NC} $cmd is installed"
  else
    echo -e "${RED}✗${NC} $cmd is NOT installed. Please install it first."
    exit 1
  fi
done

echo

# Copy .env if needed
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠${NC} .env file not found"
  if [ -f ".env.local.example" ]; then
    echo -e "${BLUE}ℹ${NC} Copying .env.local.example to .env"
    cp .env.local.example .env
    echo -e "${YELLOW}⚠${NC} Please edit .env and fill in sensitive values before starting services"
  fi
else
  echo -e "${GREEN}✓${NC} .env file exists"
fi

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Quick Start Commands${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

echo -e "${GREEN}Development Mode:${NC}"
echo "  # Start services with hot reload"
echo "  pnpm docker:dev"
echo "  # OR manually:"
echo "  docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev up -d"
echo ""
echo -e "${GREEN}Production Mode:${NC}"
echo "  docker compose up -d"
echo ""
echo -e "${GREEN}Useful Commands:${NC}"
echo "  docker compose logs -f api           # View API logs"
echo "  docker compose exec api pnpm build   # Rebuild in container"
echo "  docker compose ps                    # List running services"
echo "  docker compose down                  # Stop all services"
echo ""
echo -e "${BLUE}For more helpers, run:${NC}"
echo "  source ./docker-helpers.sh"
echo "  usage  # Show all available commands"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
