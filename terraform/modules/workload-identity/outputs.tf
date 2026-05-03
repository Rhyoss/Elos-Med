output "pool_name" {
  value = google_iam_workload_identity_pool.github.name
}

output "provider_name" {
  description = "Use no GitHub Actions: workload_identity_provider"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_email" {
  description = "Use no GitHub Actions: service_account"
  value       = google_service_account.deployer.email
}

output "github_actions_secrets" {
  description = "Valores que precisam ser setados como GitHub Secrets (não-sensíveis)"
  value = {
    GCP_PROJECT_ID                  = var.project_id
    GCP_REGION                      = var.region
    GCP_WORKLOAD_IDENTITY_PROVIDER  = google_iam_workload_identity_pool_provider.github.name
    GCP_DEPLOYER_SA                 = google_service_account.deployer.email
    GCP_ARTIFACT_REGISTRY           = "${var.region}-docker.pkg.dev/${var.project_id}/${var.registry_repository_id}"
  }
}
