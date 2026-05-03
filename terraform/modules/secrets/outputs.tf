output "secret_ids" {
  description = "Map of secret short-name -> full resource id"
  value       = { for k, s in google_secret_manager_secret.secrets : k => s.id }
}

output "secret_names" {
  value = { for k, s in google_secret_manager_secret.secrets : k => s.secret_id }
}
