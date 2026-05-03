output "emails" {
  description = "Map de serviço -> email da SA"
  value       = { for k, sa in google_service_account.services : k => sa.email }
}

output "api_email" {
  value = google_service_account.services["api"].email
}

output "web_email" {
  value = google_service_account.services["web"].email
}

output "worker_email" {
  value = google_service_account.services["worker"].email
}

output "ai_email" {
  value = google_service_account.services["ai"].email
}

output "search_email" {
  value = google_service_account.services["search"].email
}
