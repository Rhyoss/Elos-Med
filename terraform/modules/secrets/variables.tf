variable "project_id" {
  type = string
}

variable "env" {
  type = string
}

variable "region" {
  type        = string
  description = "Replicação user-managed nesta região"
}

variable "secret_ids" {
  type        = list(string)
  description = "Nomes dos secrets a criar (apenas placeholders — versões inseridas via gcloud)"
  default = [
    "postgres-admin-password",
    "postgres-app-password",
    "postgres-worker-password",
    "postgres-readonly-password",
    "redis-password",
    "redis-url",
    "jwt-secret",
    "jwt-refresh-secret",
    "patient-jwt-secret",
    "cookie-secret",
    "encryption-key",
    "ai-service-key",
    "claude-api-key",
    "openai-api-key",
    "vertex-credentials",
    "meta-app-secret",
    "telegram-webhook-secret",
    "mailgun-signing-key",
  ]
}
