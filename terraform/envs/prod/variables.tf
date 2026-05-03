variable "project_id" {
  type    = string
  default = "elosmed-prod"
}

variable "region" {
  type    = string
  default = "southamerica-east1"
}

variable "env" {
  type    = string
  default = "prod"
}

variable "domain" {
  type    = string
  default = "elosmed.com.br"
}

variable "github_owner" {
  type = string
}

variable "github_repo" {
  type    = string
  default = "elos-med"
}
