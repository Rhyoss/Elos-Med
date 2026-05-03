variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "env" {
  type = string
}

variable "vpc_self_link" {
  type        = string
  description = "VPC self_link (produced by network module)"
}

variable "psa_connection" {
  type        = string
  description = "Forces dependency on Private Service Access being ready"
}

variable "tier" {
  type        = string
  description = "Cloud SQL machine tier"
  default     = "db-custom-1-3840" # 1 vCPU, 3.75 GB
}

variable "disk_size_gb" {
  type    = number
  default = 50
}

variable "deletion_protection" {
  type    = bool
  default = true
}

variable "high_availability" {
  type        = bool
  description = "REGIONAL availability (HA) — habilitar em prod"
  default     = false
}

variable "admin_password_secret_id" {
  type        = string
  description = "Secret Manager ID containing the dermaos_admin password"
}
