output "vpc_id" {
  value = google_compute_network.main.id
}

output "vpc_name" {
  value = google_compute_network.main.name
}

output "vpc_self_link" {
  value = google_compute_network.main.self_link
}

output "subnet_id" {
  value = google_compute_subnetwork.main.id
}

output "subnet_name" {
  value = google_compute_subnetwork.main.name
}

output "connector_id" {
  value = google_vpc_access_connector.main.id
}

output "connector_name" {
  value = google_vpc_access_connector.main.name
}

output "psa_connection" {
  value = google_service_networking_connection.psa.id
}
