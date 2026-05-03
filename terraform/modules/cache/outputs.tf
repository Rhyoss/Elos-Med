output "host" {
  value = google_redis_instance.main.host
}

output "port" {
  value = google_redis_instance.main.port
}

output "auth_string" {
  value     = google_redis_instance.main.auth_string
  sensitive = true
}

# URL completa pronta para popular o secret `redis-url` no Secret Manager.
# `rediss://` força TLS (transit_encryption_mode = SERVER_AUTHENTICATION).
output "redis_url" {
  value = format(
    "rediss://:%s@%s:%d",
    google_redis_instance.main.auth_string,
    google_redis_instance.main.host,
    google_redis_instance.main.port,
  )
  sensitive = true
}

output "current_location_id" {
  value = google_redis_instance.main.current_location_id
}
