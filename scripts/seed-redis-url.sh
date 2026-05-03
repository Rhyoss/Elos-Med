#!/usr/bin/env bash
set -euo pipefail

# ─── Seed the `redis-url` Secret Manager entry ─────────────────────────────────
#
# Builds a `rediss://:<auth>@<host>:<port>` URL and pushes it as a new version
# of the `redis-url` secret in Google Secret Manager. The URL is piped straight
# from the source to gcloud — never written to disk or shell history.
#
# Two source modes:
#   --source=gcloud     (default): `gcloud redis instances describe`
#   --source=terraform           : `terraform output -raw redis_url`
#
# Usage:
#   bash scripts/seed-redis-url.sh                          # staging, gcloud
#   bash scripts/seed-redis-url.sh staging
#   bash scripts/seed-redis-url.sh prod elos-med
#   bash scripts/seed-redis-url.sh staging elos-med --source=terraform

ENV="${1:-staging}"
PROJECT="${2:-elos-med}"
SOURCE="gcloud"
for arg in "$@"; do
  case "$arg" in
    --source=*) SOURCE="${arg#--source=}" ;;
  esac
done

REGION="southamerica-east1"
SECRET_NAME="redis-url"
INSTANCE_NAME="${ENV}-elosmed-redis"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${REPO_ROOT}/terraform/envs/${ENV}"

echo "▶ Env:      ${ENV}"
echo "▶ Project:  ${PROJECT}"
echo "▶ Source:   ${SOURCE}"
echo "▶ Secret:   ${SECRET_NAME}"
echo ""

# 1. Confirm the secret container exists
if ! gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "✗ Secret '${SECRET_NAME}' does not exist in project '${PROJECT}'." >&2
  echo "  Create with: gcloud secrets create ${SECRET_NAME} \\" >&2
  echo "    --project=${PROJECT} --replication-policy=user-managed \\" >&2
  echo "    --locations=${REGION}" >&2
  exit 1
fi

# 2. Build the URL from the chosen source
case "${SOURCE}" in
  terraform)
    if [[ ! -d "${TF_DIR}" ]]; then
      echo "✗ Terraform env directory not found: ${TF_DIR}" >&2
      exit 1
    fi
    echo "▶ Reading redis_url from Terraform output..."
    URL="$(terraform -chdir="${TF_DIR}" output -raw redis_url 2>/dev/null || true)"
    if [[ -z "${URL}" ]]; then
      echo "✗ Failed to read 'redis_url' output. Is module.cache applied?" >&2
      exit 1
    fi
    ;;

  gcloud)
    echo "▶ Reading instance state from gcloud..."
    STATE="$(gcloud redis instances describe "${INSTANCE_NAME}" \
      --region="${REGION}" --project="${PROJECT}" \
      --format='value(state)' 2>/dev/null || true)"
    if [[ -z "${STATE}" ]]; then
      echo "✗ Memorystore instance '${INSTANCE_NAME}' not found in ${REGION}." >&2
      exit 1
    fi
    if [[ "${STATE}" != "READY" ]]; then
      echo "✗ Instance state is '${STATE}' (need READY). Try again in a few minutes." >&2
      exit 1
    fi

    HOST="$(gcloud redis instances describe "${INSTANCE_NAME}" \
      --region="${REGION}" --project="${PROJECT}" --format='value(host)')"
    PORT="$(gcloud redis instances describe "${INSTANCE_NAME}" \
      --region="${REGION}" --project="${PROJECT}" --format='value(port)')"
    AUTH="$(gcloud redis instances get-auth-string "${INSTANCE_NAME}" \
      --region="${REGION}" --project="${PROJECT}" --format='value(authString)')"

    if [[ -z "${HOST}" || -z "${PORT}" || -z "${AUTH}" ]]; then
      echo "✗ Missing host/port/auth from gcloud. Check instance config." >&2
      exit 1
    fi

    URL="rediss://:${AUTH}@${HOST}:${PORT}"
    ;;

  *)
    echo "✗ Unknown --source='${SOURCE}'. Use 'gcloud' or 'terraform'." >&2
    exit 1
    ;;
esac

# 3. Sanity check — must be rediss:// (TLS), never plain redis://
if [[ "${URL}" != rediss://* ]]; then
  echo "✗ Refusing to push: URL does not start with 'rediss://' (TLS required)." >&2
  exit 1
fi

# 4. Push as a new secret version
echo "▶ Pushing new version of '${SECRET_NAME}'..."
printf '%s' "${URL}" | gcloud secrets versions add "${SECRET_NAME}" \
  --project="${PROJECT}" \
  --data-file=- \
  >/dev/null

# 5. Show the new version metadata (no value)
LATEST="$(gcloud secrets versions list "${SECRET_NAME}" \
  --project="${PROJECT}" \
  --filter='state=ENABLED' \
  --sort-by=~createTime \
  --limit=1 \
  --format='value(name,createTime)')"

echo ""
echo "✓ ${SECRET_NAME} updated. Latest version: ${LATEST}"
echo ""
echo "Next: redeploy api/worker so they pick up the new secret version."
echo "      git push origin main   # or workflow_dispatch on Deploy"
