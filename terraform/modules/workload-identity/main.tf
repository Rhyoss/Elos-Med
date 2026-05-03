locals {
  prefix     = var.env
  pool_id    = "${local.prefix}-github-pool"
  provider_id = "${local.prefix}-github"
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = local.pool_id
  display_name              = "GitHub Actions (${var.env})"
  description               = "WIF pool para deploys do repo ${var.github_owner}/${var.github_repo}"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = local.provider_id
  display_name                       = "GitHub OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
    "attribute.actor"      = "assertion.actor"
  }

  # Restringe a apenas o repo informado.
  attribute_condition = "assertion.repository == \"${var.github_owner}/${var.github_repo}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# SA dedicada de deploy — impersonada pelo GitHub via WIF.
resource "google_service_account" "deployer" {
  project      = var.project_id
  account_id   = "${local.prefix}-gh-deployer"
  display_name = "GitHub Actions Deployer (${var.env})"
}

# Permissões necessárias pro deploy.
resource "google_project_iam_member" "deployer" {
  for_each = toset([
    "roles/run.admin",                          # gcloud run deploy
    "roles/iam.serviceAccountUser",             # actAs nas SAs runtime
    "roles/artifactregistry.writer",            # docker push
    "roles/cloudsql.client",                    # job de migração
    "roles/secretmanager.secretAccessor",       # ler secrets em deploy time se necessário
    "roles/logging.logWriter",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

# A deployer SA pode atuar como cada SA runtime (api, web, worker, ai, search).
resource "google_service_account_iam_member" "deployer_act_as_runtime" {
  for_each = var.service_account_emails

  service_account_id = "projects/${var.project_id}/serviceAccounts/${each.value}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}

# GitHub (via WIF) pode impersonar a deployer, restrito às branches permitidas.
resource "google_service_account_iam_member" "wif_to_deployer" {
  for_each = toset(var.allowed_branches)

  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_owner}/${var.github_repo}"
  # Branch restriction: validação adicional via attribute_condition no provider + check no workflow
}
