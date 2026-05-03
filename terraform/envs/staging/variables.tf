variable "project_id" {
  type    = string
  default = "elos-med"
}

variable "region" {
  type    = string
  default = "southamerica-east1"
}

variable "env" {
  type    = string
  default = "staging"
}

variable "domain" {
  type    = string
  default = "elosmed.com.br"
}

variable "github_owner" {
  type        = string
  description = "Org/usuário do GitHub"
}

variable "github_repo" {
  type        = string
  description = "Nome do repositório"
  default     = "elos-med"
}
