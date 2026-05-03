output "repository_id" {
  value = google_artifact_registry_repository.docker.repository_id
}

output "repository_url" {
  description = "Hostname/path para tags Docker (ex.: southamerica-east1-docker.pkg.dev/PROJECT/elosmed-docker)"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"
}
