variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "env" {
  type = string
}

variable "force_destroy" {
  type        = bool
  description = "Permitir destruir buckets com objetos (true em staging, false em prod)"
  default     = false
}
