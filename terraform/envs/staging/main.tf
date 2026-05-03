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

module "registry" {
  source = "../../modules/registry"

  project_id = var.project_id
  region     = var.region
  env        = var.env
}

module "storage" {
  source = "../../modules/storage"

  project_id    = var.project_id
  region        = var.region
  env           = var.env
  force_destroy = true # staging pode ser recriado
}

module "database" {
  source = "../../modules/database"

  project_id     = var.project_id
  region         = var.region
  env            = var.env
  vpc_self_link  = module.network.vpc_self_link
  psa_connection = module.network.psa_connection

  tier                     = "db-custom-1-3840"
  disk_size_gb             = 50
  high_availability        = false
  deletion_protection      = false
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

  memory_size_gb = 1
  tier           = "BASIC"
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
  allowed_branches       = ["main"]
  registry_repository_id = module.registry.repository_id
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
}
