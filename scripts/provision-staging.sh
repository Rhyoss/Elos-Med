#!/usr/bin/env bash
set -euo pipefail

# ─── Provisioning: staging environment on GCP ────────────────────────────────
# Run from Cloud Shell (already authenticated as alex@elostec.com.br)
# Usage: bash provision-staging.sh

PROJECT=elos-med
REGION=southamerica-east1
ENV=staging
PREFIX=${ENV}-elosmed

echo "══════════════════════════════════════════════════════════"
echo "  ELOS MED — Provisioning ${ENV} environment"
echo "══════════════════════════════════════════════════════════"
echo ""

# ─── 1. Artifact Registry ───────────────────────────────────────────────────
echo "▶ [1/8] Artifact Registry..."
gcloud artifacts repositories create elosmed-docker \
  --repository-format=docker \
  --location=$REGION \
  --description="Docker images ELOS MED" \
  --project=$PROJECT 2>/dev/null || echo "  (already exists)"

# ─── 2. VPC + Subnet + NAT ──────────────────────────────────────────────────
echo "▶ [2/8] VPC network..."
gcloud compute networks create ${PREFIX}-vpc \
  --subnet-mode=custom \
  --project=$PROJECT 2>/dev/null || echo "  (already exists)"

gcloud compute networks subnets create ${PREFIX}-subnet \
  --network=${PREFIX}-vpc \
  --region=$REGION \
  --range=10.10.0.0/20 \
  --enable-private-ip-google-access \
  --project=$PROJECT 2>/dev/null || echo "  (already exists)"

gcloud compute routers create ${PREFIX}-router \
  --network=${PREFIX}-vpc \
  --region=$REGION \
  --project=$PROJECT 2>/dev/null || echo "  (already exists)"

gcloud compute routers nats create ${PREFIX}-nat \
  --router=${PREFIX}-router \
  --region=$REGION \
  --auto-allocate-nat-external-ips \
  --nat-all-subnet-ip-ranges \
  --project=$PROJECT 2>/dev/null || echo "  (already exists)"

# ─── 3. VPC Access Connector (Cloud Run → VPC) ──────────────────────────────
echo "▶ [3/8] VPC Access Connector..."
gcloud compute networks vpc-access connectors create ${PREFIX}-connector \
  --network=${PREFIX}-vpc \
  --region=$REGION \
  --range=10.10.16.0/28 \
  --min-instances=2 \
  --max-instances=10 \
  --machine-type=e2-micro \
  --project=$PROJECT 2>/dev/null || echo "  (already exists)"

# ─── 4. Private Service Access (Cloud SQL peering) ───────────────────────────
echo "▶ [4/8] Private Service Access..."
gcloud compute addresses create ${PREFIX}-psa \
  --global \
  --purpose=VPC_PEERING \
  --network=${PREFIX}-vpc \
  --addresses=10.20.0.0 \
  --prefix-length=16 \
  --project=$PROJECT 2>/dev/null || echo "  (already exists)"

gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --network=${PREFIX}-vpc \
  --ranges=${PREFIX}-psa \
  --project=$PROJECT 2>/dev/null || echo "  (already exists)"

# ─── 5. Cloud SQL (Postgres 16) ─────────────────────────────────────────────
echo "▶ [5/8] Cloud SQL instance (async, ~10 min)..."
gcloud sql instances create ${PREFIX}-db \
  --database-version=POSTGRES_16 \
  --edition=ENTERPRISE \
  --tier=db-custom-1-3840 \
  --region=$REGION \
  --network=projects/${PROJECT}/global/networks/${PREFIX}-vpc \
  --no-assign-ip \
  --storage-type=SSD \
  --storage-size=50GB \
  --storage-auto-increase \
  --availability-type=zonal \
  --backup-start-time=03:00 \
  --enable-point-in-time-recovery \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=4 \
  --database-flags=cloudsql.iam_authentication=on,log_min_duration_statement=1000,max_connections=200 \
  --no-deletion-protection \
  --project=$PROJECT \
  --async 2>/dev/null || echo "  (already exists)"

# ─── 6. Service Accounts (per-service runtime SAs) ──────────────────────────
echo "▶ [6/8] Service Accounts..."
for SVC in api web worker ai; do
  gcloud iam service-accounts create ${PREFIX}-${SVC} \
    --display-name="ELOS MED ${SVC} (${ENV})" \
    --project=$PROJECT 2>/dev/null || echo "  ${PREFIX}-${SVC} (already exists)"
done

echo "  Binding IAM roles..."
# API
for ROLE in roles/cloudsql.client roles/secretmanager.secretAccessor roles/cloudtrace.agent roles/logging.logWriter roles/monitoring.metricWriter; do
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:${PREFIX}-api@${PROJECT}.iam.gserviceaccount.com" \
    --role="$ROLE" --quiet > /dev/null
done
# Worker
for ROLE in roles/cloudsql.client roles/secretmanager.secretAccessor roles/cloudtrace.agent roles/logging.logWriter roles/monitoring.metricWriter; do
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:${PREFIX}-worker@${PROJECT}.iam.gserviceaccount.com" \
    --role="$ROLE" --quiet > /dev/null
done
# Web
for ROLE in roles/secretmanager.secretAccessor roles/cloudtrace.agent roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:${PREFIX}-web@${PROJECT}.iam.gserviceaccount.com" \
    --role="$ROLE" --quiet > /dev/null
done
# AI
for ROLE in roles/secretmanager.secretAccessor roles/logging.logWriter roles/monitoring.metricWriter; do
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:${PREFIX}-ai@${PROJECT}.iam.gserviceaccount.com" \
    --role="$ROLE" --quiet > /dev/null
done

echo "  Deployer → actAs runtime SAs..."
for SVC in api web worker ai; do
  gcloud iam service-accounts add-iam-policy-binding \
    ${PREFIX}-${SVC}@${PROJECT}.iam.gserviceaccount.com \
    --member="serviceAccount:github-deployer@${PROJECT}.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser" \
    --quiet > /dev/null
done

# ─── 7. Secret Manager + GCS Buckets ────────────────────────────────────────
echo "▶ [7/8] Secret Manager & Storage..."
SECRETS=(
  postgres-admin-password
  postgres-app-password
  postgres-worker-password
  redis-password
  jwt-secret
  jwt-refresh-secret
  cookie-secret
  encryption-key
  search-index-key
  ai-service-key
)
for SECRET in "${SECRETS[@]}"; do
  gcloud secrets create $SECRET \
    --replication-policy=user-managed \
    --locations=$REGION \
    --project=$PROJECT 2>/dev/null || true
done

echo "  Generating & storing secret values..."
openssl rand -base64 32 | tr -d '\n' | gcloud secrets versions add postgres-admin-password --data-file=- --project=$PROJECT
openssl rand -base64 32 | tr -d '\n' | gcloud secrets versions add postgres-app-password --data-file=- --project=$PROJECT
openssl rand -base64 32 | tr -d '\n' | gcloud secrets versions add postgres-worker-password --data-file=- --project=$PROJECT
openssl rand -base64 32 | tr -d '\n' | gcloud secrets versions add redis-password --data-file=- --project=$PROJECT
openssl rand -base64 64 | tr -d '\n' | gcloud secrets versions add jwt-secret --data-file=- --project=$PROJECT
openssl rand -base64 64 | tr -d '\n' | gcloud secrets versions add jwt-refresh-secret --data-file=- --project=$PROJECT
openssl rand -base64 64 | tr -d '\n' | gcloud secrets versions add cookie-secret --data-file=- --project=$PROJECT
openssl rand -hex 32 | tr -d '\n' | gcloud secrets versions add encryption-key --data-file=- --project=$PROJECT
openssl rand -hex 32 | tr -d '\n' | gcloud secrets versions add search-index-key --data-file=- --project=$PROJECT
openssl rand -hex 32 | tr -d '\n' | gcloud secrets versions add ai-service-key --data-file=- --project=$PROJECT

echo "  Creating GCS buckets..."
for BUCKET in ${PREFIX}-uploads ${PREFIX}-documents ${PREFIX}-exports ${PREFIX}-backups; do
  gsutil mb -l $REGION -b on gs://${BUCKET}/ 2>/dev/null || true
done

# Grant bucket access to api + worker SAs
for BUCKET in ${PREFIX}-uploads ${PREFIX}-documents ${PREFIX}-exports ${PREFIX}-backups; do
  for SVC in api worker; do
    gsutil iam ch \
      serviceAccount:${PREFIX}-${SVC}@${PROJECT}.iam.gserviceaccount.com:roles/storage.objectAdmin \
      gs://${BUCKET}/ 2>/dev/null || true
  done
done

# ─── 8. Terraform state bucket ──────────────────────────────────────────────
echo "▶ [8/8] Terraform state bucket..."
gsutil mb -l $REGION -b on gs://elos-med-tfstate/ 2>/dev/null || echo "  (already exists)"
gsutil versioning set on gs://elos-med-tfstate/

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  ✓ Provisioning complete!"
echo ""
echo "  Cloud SQL is being created asynchronously (~10 min)."
echo "  Check status: gcloud sql instances describe ${PREFIX}-db --project=$PROJECT"
echo ""
echo "  After Cloud SQL is RUNNABLE, complete DB setup:"
echo "    ADMIN_PASS=\$(gcloud secrets versions access latest --secret=postgres-admin-password --project=$PROJECT)"
echo "    gcloud sql users set-password postgres --instance=${PREFIX}-db --password=\"\${ADMIN_PASS}\" --project=$PROJECT"
echo "    gcloud sql databases create dermaos --instance=${PREFIX}-db --project=$PROJECT"
echo "══════════════════════════════════════════════════════════"
