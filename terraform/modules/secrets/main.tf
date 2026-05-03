# Cria os "containers" de secret no Secret Manager. Os valores (versões)
# devem ser inseridos manualmente uma única vez:
#
#   echo -n "<senha>" | gcloud secrets versions add postgres-admin-password \
#     --project=elosmed-staging --data-file=-
#
# O Terraform NUNCA coloca o segredo em state.

locals {
  labels = {
    env = var.env
    app = "elosmed"
  }
}

resource "google_secret_manager_secret" "secrets" {
  for_each = toset(var.secret_ids)

  project   = var.project_id
  secret_id = each.value

  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }

  labels = local.labels
}
