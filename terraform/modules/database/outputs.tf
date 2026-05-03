output "instance_name" {
  value = google_sql_database_instance.main.name
}

output "instance_connection_name" {
  description = "PROJECT:REGION:INSTANCE — usado pelo Cloud SQL Auth Proxy"
  value       = google_sql_database_instance.main.connection_name
}

output "private_ip_address" {
  value = google_sql_database_instance.main.private_ip_address
}

output "database_name" {
  value = google_sql_database.main.name
}
