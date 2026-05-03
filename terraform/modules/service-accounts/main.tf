locals {
  prefix = var.env

  # Cada serviço Cloud Run roda como uma SA dedicada (least privilege).
  service_accounts = {
    api    = "API tRPC + REST"
    web    = "Next.js SSR"
    worker = "BullMQ jobs"
    ai     = "FastAPI AI"
    search = "Meilisearch"
  }
}

resource "google_service_account" "services" {
  for_each = local.service_accounts

  project      = var.project_id
  account_id   = "${local.prefix}-${each.key}-sa"
  display_name = "ELOS MED ${each.key} (${var.env})"
  description  = each.value
}

# ─── api: precisa Cloud SQL, Redis, Secret Manager, GCS (todos buckets), Vertex
resource "google_project_iam_member" "api" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/aiplatform.user",
    "roles/cloudtrace.agent",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.services["api"].email}"
}

resource "google_storage_bucket_iam_member" "api_buckets" {
  for_each = var.bucket_names
  bucket   = each.value
  role     = "roles/storage.objectAdmin"
  member   = "serviceAccount:${google_service_account.services["api"].email}"
}

resource "google_kms_crypto_key_iam_member" "api_phi" {
  crypto_key_id = var.kms_key_phi
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${google_service_account.services["api"].email}"
}

resource "google_kms_crypto_key_iam_member" "api_general" {
  crypto_key_id = var.kms_key_general
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${google_service_account.services["api"].email}"
}

# ─── worker: igual à api (mas escreve em mais lugares — kms p/ rastreabilidade)
resource "google_project_iam_member" "worker" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/cloudtrace.agent",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.services["worker"].email}"
}

resource "google_storage_bucket_iam_member" "worker_buckets" {
  for_each = var.bucket_names
  bucket   = each.value
  role     = "roles/storage.objectAdmin"
  member   = "serviceAccount:${google_service_account.services["worker"].email}"
}

resource "google_kms_crypto_key_iam_member" "worker_phi" {
  crypto_key_id = var.kms_key_phi
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${google_service_account.services["worker"].email}"
}

resource "google_kms_crypto_key_iam_member" "worker_general" {
  crypto_key_id = var.kms_key_general
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${google_service_account.services["worker"].email}"
}

# ─── web: SSR só lê secrets básicos (cookies/jwt) e chama api por HTTP
resource "google_project_iam_member" "web" {
  for_each = toset([
    "roles/secretmanager.secretAccessor",
    "roles/cloudtrace.agent",
    "roles/logging.logWriter",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.services["web"].email}"
}

# ─── ai: lê apenas secret próprio + Vertex/Claude
resource "google_project_iam_member" "ai" {
  for_each = toset([
    "roles/secretmanager.secretAccessor",
    "roles/aiplatform.user",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.services["ai"].email}"
}

# ─── search (Meili): apenas logs + bucket próprio (snapshot)
resource "google_project_iam_member" "search" {
  for_each = toset([
    "roles/secretmanager.secretAccessor",
    "roles/logging.logWriter",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.services["search"].email}"
}
