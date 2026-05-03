output "github_actions_secrets" {
  description = "Setar como GitHub Actions secrets/variables"
  value       = module.workload_identity.github_actions_secrets
}

output "cloudsql_connection_name" {
  value = module.database.instance_connection_name
}

output "redis_host" {
  value = module.cache.host
}

output "buckets" {
  value = module.storage.buckets
}

output "service_account_emails" {
  value = module.service_accounts.emails
}

output "cloud_run_urls" {
  value = module.cloud_run.service_urls
}

output "artifact_registry" {
  value = module.registry.repository_url
}
