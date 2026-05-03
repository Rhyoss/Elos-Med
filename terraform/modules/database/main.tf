locals {
  prefix = "${var.env}-elosmed"
}

data "google_secret_manager_secret_version" "admin_password" {
  project = var.project_id
  secret  = var.admin_password_secret_id
}

resource "google_sql_database_instance" "main" {
  project          = var.project_id
  name             = "${local.prefix}-db"
  region           = var.region
  database_version = "POSTGRES_16"

  deletion_protection = var.deletion_protection

  depends_on = [var.psa_connection]

  settings {
    tier              = var.tier
    availability_type = var.high_availability ? "REGIONAL" : "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = var.disk_size_gb
    disk_autoresize   = true

    # IP privado, sem IP público.
    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.vpc_self_link
      enable_private_path_for_google_cloud_services = true
      require_ssl                                   = true
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = var.env == "prod" ? 30 : 7
        retention_unit   = "COUNT"
      }
    }

    maintenance_window {
      day          = 7 # Sunday
      hour         = 4
      update_track = "stable"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }

    database_flags {
      name  = "cloudsql.iam_authentication"
      value = "on"
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"
    }

    database_flags {
      name  = "max_connections"
      value = "200"
    }

    user_labels = {
      env = var.env
      app = "elosmed"
    }
  }
}

# Senha administrativa lida do Secret Manager (criada via bootstrap).
resource "google_sql_user" "admin" {
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  name     = "dermaos_admin"
  password = data.google_secret_manager_secret_version.admin_password.secret_data
}

resource "google_sql_database" "main" {
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  name     = "dermaos"

  depends_on = [google_sql_user.admin]
}

# pgvector e roles `dermaos_app/_worker/_readonly` (NOSUPERUSER NOBYPASSRLS)
# devem ser criadas via job de migração rodando como `dermaos_admin`.
# O script `db/init/000_app_roles.sh` permanece a fonte de verdade.
