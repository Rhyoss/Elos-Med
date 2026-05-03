locals {
  prefix = "${var.env}-elosmed"
  labels = {
    env = var.env
    app = "elosmed"
  }
}

resource "google_compute_network" "main" {
  project                 = var.project_id
  name                    = "${local.prefix}-vpc"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

resource "google_compute_subnetwork" "main" {
  project                  = var.project_id
  name                     = "${local.prefix}-subnet"
  region                   = var.region
  network                  = google_compute_network.main.id
  ip_cidr_range            = var.vpc_cidr
  private_ip_google_access = true

  log_config {
    aggregation_interval = "INTERVAL_10_MIN"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

resource "google_compute_router" "nat" {
  project = var.project_id
  name    = "${local.prefix}-router"
  region  = var.region
  network = google_compute_network.main.id
}

resource "google_compute_router_nat" "nat" {
  project                            = var.project_id
  name                               = "${local.prefix}-nat"
  router                             = google_compute_router.nat.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Private Service Access — necessário para Cloud SQL e Memorystore com IP privado.
resource "google_compute_global_address" "psa" {
  project       = var.project_id
  name          = "${local.prefix}-psa"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
  address       = split("/", var.psa_cidr)[0]
}

resource "google_service_networking_connection" "psa" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.psa.name]
  deletion_policy         = "ABANDON"
}

# Serverless VPC Connector — Cloud Run -> VPC (Cloud SQL, Memorystore, AI interno).
resource "google_vpc_access_connector" "main" {
  project        = var.project_id
  name           = "${local.prefix}-connector"
  region         = var.region
  network        = google_compute_network.main.name
  ip_cidr_range  = var.connector_cidr
  min_instances  = 2
  max_instances  = 10
  machine_type   = "e2-micro"
}

# Firewall: bloqueio default + permitir health checks Google.
resource "google_compute_firewall" "deny_all_ingress" {
  project   = var.project_id
  name      = "${local.prefix}-deny-all-ingress"
  network   = google_compute_network.main.name
  direction = "INGRESS"
  priority  = 65534

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]
}

resource "google_compute_firewall" "allow_health_checks" {
  project   = var.project_id
  name      = "${local.prefix}-allow-hc"
  network   = google_compute_network.main.name
  direction = "INGRESS"
  priority  = 1000

  allow {
    protocol = "tcp"
  }

  # Faixas reservadas pelos health checkers do Google Cloud.
  source_ranges = ["35.191.0.0/16", "130.211.0.0/22"]
  target_tags   = ["allow-health-check"]
}

resource "google_compute_firewall" "allow_iap_ssh" {
  project   = var.project_id
  name      = "${local.prefix}-allow-iap-ssh"
  network   = google_compute_network.main.name
  direction = "INGRESS"
  priority  = 1000

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  # IAP TCP forwarding (para administração via gcloud, sem expor SSH).
  source_ranges = ["35.235.240.0/20"]
}
