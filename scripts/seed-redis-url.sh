#!/usr/bin/env bash
set -euo pipefail

# ─── Seed the `redis-url` Secret Manager entry from Terraform output ─────────
#
# Reads the sensitive `redis_url` output (rediss://:<auth>@<host>:<port>)
# from the staging or prod Terraform env and pushes it as a new version
# of the `redis-url` secret in Google Secret Manager.
#
# The URL is piped directly from Terraform to gcloud — never written to disk.
#
# Usage:
#   bash scripts/seed-redis-url.sh                  # defaults: env=staging, project=elos-med
#   bash scripts/seed-redis-url.sh staging
#   bash scripts/seed-redis-url.sh prod elos-med
#
# Requires: terraform initialized in the env dir, gcloud authenticated with
# permission to write versions to the `redis-url` secret in $PROJECT.

ENV="${1:-staging}"
PROJECT="${2:-elos-med}"
SECRET_NAME="redis-url"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${REPO_ROOT}/terraform/envs/${ENV}"

if [[ ! -d "${TF_DIR}" ]]; then
  echo "✗ Terraform env directory not found: ${TF_DIR}" >&2
  exit 1
fi

echo "▶ Env:     ${ENV}"
echo "▶ Project: ${PROJECT}"
echo "▶ Secret:  ${SECRET_NAME}"
echo ""

# 1. Confirm the secret container exists (created by `module.secrets`)
if ! gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "✗ Secret '${SECRET_NAME}' does not exist in project '${PROJECT}'." >&2
  echo "  Run 'terraform apply' first — module.secrets creates the container." >&2
  exit 1
fi

# 2. Read the URL from Terraform output (sensitive). Pipe straight to gcloud
#    so the rediss:// string never lands on disk or in shell history.
echo "▶ Reading redis_url from Terraform output..."
URL="$(terraform -chdir="${TF_DIR}" output -raw redis_url 2>/dev/null || true)"

if [[ -z "${URL}" ]]; then
  echo "✗ Failed to read 'redis_url' output. Is the cache module applied?" >&2
  echo "  Try: terraform -chdir=${TF_DIR} apply -target=module.cache" >&2
  exit 1
fi

# Sanity check — must be rediss:// (TLS), never plain redis://
if [[ "${URL}" != rediss://* ]]; then
  echo "✗ Refusing to push: URL does not start with 'rediss://' (TLS required)." >&2
  exit 1
fi

# 3. Push as a new secret version
echo "▶ Pushing new version of '${SECRET_NAME}'..."
printf '%s' "${URL}" | gcloud secrets versions add "${SECRET_NAME}" \
  --project="${PROJECT}" \
  --data-file=- \
  >/dev/null

# 4. Show the new version metadata (no value)
LATEST="$(gcloud secrets versions list "${SECRET_NAME}" \
  --project="${PROJECT}" \
  --filter="state=ENABLED" \
  --sort-by=~createTime \
  --limit=1 \
  --format="value(name,createTime)")"

echo ""
echo "✓ ${SECRET_NAME} updated. Latest version: ${LATEST}"
echo ""
echo "Next: redeploy api/worker so they pick up the new secret version."
echo "      git push origin main   # or workflow_dispatch on Deploy"
