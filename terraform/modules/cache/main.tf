locals {
  prefix = "${var.env}-elosmed"
}

resource "google_redis_instance" "main" {
  project        = var.project_id
  name           = "${local.prefix}-redis"
  region         = var.region
  tier           = var.tier
  memory_size_gb = var.memory_size_gb
  redis_version  = "REDIS_7_2"

  authorized_network      = var.vpc_self_link
  connect_mode            = "PRIVATE_SERVICE_ACCESS"
  reserved_ip_range       = null # gerenciado pela PSA
  auth_enabled            = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"

  redis_configs = {
    maxmemory-policy = "allkeys-lru"
  }

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 4
        minutes = 0
      }
    }
  }

  labels = {
    env = var.env
    app = "elosmed"
  }

  depends_on = [var.psa_connection]
}
