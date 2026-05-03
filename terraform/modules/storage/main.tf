locals {
  prefix = "${var.env}-elosmed"
  labels = {
    env = var.env
    app = "elosmed"
  }
}

# ─── KMS keyring + chaves CMEK ────────────────────────────────────────────────
resource "google_kms_key_ring" "main" {
  project  = var.project_id
  name     = "${local.prefix}-keyring"
  location = var.region
}

resource "google_kms_crypto_key" "phi" {
  name            = "${local.prefix}-phi"
  key_ring        = google_kms_key_ring.main.id
  rotation_period = "7776000s" # 90 dias
  purpose         = "ENCRYPT_DECRYPT"

  lifecycle {
    prevent_destroy = false
  }
}

resource "google_kms_crypto_key" "general" {
  name            = "${local.prefix}-general"
  key_ring        = google_kms_key_ring.main.id
  rotation_period = "7776000s"
  purpose         = "ENCRYPT_DECRYPT"
}

# Permitir que o agente do Cloud Storage use as chaves.
data "google_storage_project_service_account" "gcs_sa" {
  project = var.project_id
}

resource "google_kms_crypto_key_iam_member" "gcs_phi" {
  crypto_key_id = google_kms_crypto_key.phi.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${data.google_storage_project_service_account.gcs_sa.email_address}"
}

resource "google_kms_crypto_key_iam_member" "gcs_general" {
  crypto_key_id = google_kms_crypto_key.general.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${data.google_storage_project_service_account.gcs_sa.email_address}"
}

# ─── Buckets ─────────────────────────────────────────────────────────────────
locals {
  buckets = {
    clinical_images = {
      name          = "${local.prefix}-clinical-images"
      kms_key       = google_kms_crypto_key.phi.id
      lifecycle_age = 0 # nunca expirar
    }
    prescriptions = {
      name          = "${local.prefix}-prescriptions"
      kms_key       = google_kms_crypto_key.phi.id
      lifecycle_age = 0
    }
    product_images = {
      name          = "${local.prefix}-product-images"
      kms_key       = google_kms_crypto_key.general.id
      lifecycle_age = 0
    }
    avatars = {
      name          = "${local.prefix}-avatars"
      kms_key       = google_kms_crypto_key.general.id
      lifecycle_age = 0
    }
  }
}

resource "google_storage_bucket" "buckets" {
  for_each = local.buckets

  project       = var.project_id
  name          = each.value.name
  location      = var.region
  force_destroy = var.force_destroy

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }

  encryption {
    default_kms_key_name = each.value.kms_key
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      num_newer_versions = 5
      days_since_noncurrent_time = 30
    }
  }

  labels = local.labels

  depends_on = [
    google_kms_crypto_key_iam_member.gcs_phi,
    google_kms_crypto_key_iam_member.gcs_general,
  ]
}
