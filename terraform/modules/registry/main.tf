resource "google_artifact_registry_repository" "docker" {
  project       = var.project_id
  location      = var.region
  repository_id = "elosmed-docker"
  format        = "DOCKER"
  description   = "Imagens Docker dos serviços ELOS MED (${var.env})"

  cleanup_policies {
    id     = "keep-recent-tagged"
    action = "KEEP"
    most_recent_versions {
      keep_count = 20
    }
  }

  cleanup_policies {
    id     = "delete-old-untagged"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "604800s" # 7 dias
    }
  }

  labels = {
    env = var.env
    app = "elosmed"
  }
}
