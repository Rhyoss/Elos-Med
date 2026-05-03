locals {
  prefix = var.env

  services = {
    api = {
      ingress       = "INGRESS_TRAFFIC_ALL"        # exposto via LB com Cloud Armor
      cpu           = "1"
      memory        = "1Gi"
      port          = 4000
      cloudsql      = true
      vpc_egress    = "PRIVATE_RANGES_ONLY"
      sa_key        = "api"
    }
    web = {
      ingress       = "INGRESS_TRAFFIC_ALL"
      cpu           = "1"
      memory        = "1Gi"
      port          = 3000
      cloudsql      = false
      vpc_egress    = "PRIVATE_RANGES_ONLY"
      sa_key        = "web"
    }
    worker = {
      ingress       = "INGRESS_TRAFFIC_INTERNAL_ONLY"
      cpu           = "1"
      memory        = "1Gi"
      port          = 8080
      cloudsql      = true
      vpc_egress    = "PRIVATE_RANGES_ONLY"
      sa_key        = "worker"
    }
    ai = {
      ingress       = "INGRESS_TRAFFIC_INTERNAL_ONLY"
      cpu           = "2"
      memory        = "2Gi"
      port          = 8000
      cloudsql      = false
      vpc_egress    = "PRIVATE_RANGES_ONLY"
      sa_key        = "ai"
    }
    search = {
      ingress       = "INGRESS_TRAFFIC_INTERNAL_ONLY"
      cpu           = "1"
      memory        = "1Gi"
      port          = 7700
      cloudsql      = false
      vpc_egress    = "PRIVATE_RANGES_ONLY"
      sa_key        = "search"
    }
  }
}

resource "google_cloud_run_v2_service" "services" {
  for_each = local.services

  project  = var.project_id
  name     = "${local.prefix}-${each.key}"
  location = var.region
  ingress  = each.value.ingress

  template {
    service_account = var.service_account_emails[each.value.sa_key]

    scaling {
      min_instance_count = var.min_instances[each.key]
      max_instance_count = var.max_instances[each.key]
    }

    vpc_access {
      connector = var.vpc_connector_id
      egress    = each.value.vpc_egress
    }

    timeout = "60s"

    containers {
      image = var.placeholder_image

      ports {
        container_port = each.value.port
      }

      resources {
        limits = {
          cpu    = each.value.cpu
          memory = each.value.memory
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      # Env comuns. Os deploys reais (via GitHub Actions) sobrescrevem com
      # mais variáveis. Os secrets são injetados como env via volume secret.
      env {
        name  = "NODE_ENV"
        value = var.env == "prod" ? "production" : "staging"
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name  = "ENV"
        value = var.env
      }
    }

    dynamic "volumes" {
      for_each = each.value.cloudsql ? [1] : []
      content {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [var.cloudsql_instance]
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  # As envs/imagem são gerenciadas pelo pipeline de deploy (GitHub Actions).
  # Terraform mantém só a forma do serviço (SA, VPC, scaling, ingress).
  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      template[0].containers[0].env,
      client,
      client_version,
    ]
  }

  labels = {
    env = var.env
    app = "elosmed"
  }
}

# Para serviços com ingress=ALL (api, web), permitir acesso público
# (o WAF/Cloud Armor é aplicado no LB acima).
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  for_each = {
    for k, v in local.services : k => v
    if v.ingress == "INGRESS_TRAFFIC_ALL"
  }

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.services[each.key].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# api e worker invocam ai → permitir SAs específicas
resource "google_cloud_run_v2_service_iam_member" "ai_internal_invokers" {
  for_each = toset(["api", "worker"])

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.services["ai"].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.service_account_emails[each.value]}"
}

# api e worker invocam search → permitir SAs específicas
resource "google_cloud_run_v2_service_iam_member" "search_internal_invokers" {
  for_each = toset(["api", "worker"])

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.services["search"].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.service_account_emails[each.value]}"
}
