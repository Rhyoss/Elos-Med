variable "project_id" {
  type = string
}

variable "env" {
  type = string
}

variable "github_owner" {
  type        = string
  description = "Dono do repositório GitHub (org/usuário)"
}

variable "github_repo" {
  type        = string
  description = "Nome do repositório GitHub"
}

variable "allowed_branches" {
  type        = list(string)
  description = "Branches permitidas a fazer deploy neste env"
  default     = ["main"]
}

variable "registry_repository_id" {
  type        = string
  description = "Artifact Registry repo onde o GitHub vai fazer push"
}

variable "region" {
  type = string
}

variable "service_account_emails" {
  type        = map(string)
  description = "SAs de runtime (output do módulo service-accounts) — para impersonation no deploy"
}
