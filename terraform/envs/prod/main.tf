module "network" {
  source = "../../modules/network"

  project_id = var.project_id
  region     = var.region
  env        = var.env
}

module "secrets" {
  source = "../../modules/secrets"

  project_id = var.project_id
  region     = var.region
  env        = var.env
}

# Registry is shared (created by staging env). Reference it directly.
locals {
  registry_repository_id  = "elosmed-docker"
  artifact_registry_url   = "${var.region}-docker.pkg.dev/${var.project_id}/elosmed-docker"
}

module "storage" {
  source = "../../modules/storage"

  project_id    = var.project_id
  region        = var.region
  env           = var.env
  force_destroy = false # nunca destruir buckets de prod
}

module "database" {
  source = "../../modules/database"

  project_id     = var.project_id
  region         = var.region
  env            = var.env
  vpc_self_link  = module.network.vpc_self_link
  psa_connection = module.network.psa_connection

  tier                     = "db-custom-2-7680" # 2 vCPU, 7.5 GB
  disk_size_gb             = 100
  high_availability        = true
  deletion_protection      = true
  admin_password_secret_id = "postgres-admin-password"

  depends_on = [module.secrets]
}

module "cache" {
  source = "../../modules/cache"

  project_id     = var.project_id
  region         = var.region
  env            = var.env
  vpc_self_link  = module.network.vpc_self_link
  psa_connection = module.network.psa_connection

  memory_size_gb = 2
  tier           = "STANDARD_HA"
}

module "service_accounts" {
  source = "../../modules/service-accounts"

  project_id        = var.project_id
  env               = var.env
  secret_ids        = module.secrets.secret_ids
  bucket_names      = module.storage.buckets
  kms_key_phi       = module.storage.kms_key_phi
  kms_key_general   = module.storage.kms_key_general
  cloudsql_instance = module.database.instance_connection_name
}

module "workload_identity" {
  source = "../../modules/workload-identity"

  project_id             = var.project_id
  region                 = var.region
  env                    = var.env
  github_owner           = var.github_owner
  github_repo            = var.github_repo
  allowed_branches       = ["main"] # deploy de prod via tag/manual no workflow
  registry_repository_id = local.registry_repository_id
  service_account_emails = module.service_accounts.emails
}

module "cloud_run" {
  source = "../../modules/cloud-run"

  project_id             = var.project_id
  region                 = var.region
  env                    = var.env
  vpc_connector_id       = module.network.connector_id
  service_account_emails = module.service_accounts.emails
  cloudsql_instance      = module.database.instance_connection_name
  domain                 = var.domain
  secret_names           = module.secrets.secret_names

  # Em prod: api e web com 1 instância sempre quente; worker com 1 (BullMQ).
  min_instances = {
    api    = 1
    web    = 1
    worker = 1
    ai     = 0
    search = 0
  }
  max_instances = {
    api    = 30
    web    = 30
    worker = 5
    ai     = 10
    search = 5
  }
}
