output "service_urls" {
  value = { for k, s in google_cloud_run_v2_service.services : k => s.uri }
}

output "service_names" {
  value = { for k, s in google_cloud_run_v2_service.services : k => s.name }
}

output "api_url" {
  value = google_cloud_run_v2_service.services["api"].uri
}

output "web_url" {
  value = google_cloud_run_v2_service.services["web"].uri
}

output "worker_url" {
  value = google_cloud_run_v2_service.services["worker"].uri
}

output "ai_url" {
  value = google_cloud_run_v2_service.services["ai"].uri
}

output "search_url" {
  value = google_cloud_run_v2_service.services["search"].uri
}
