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
  type = string
}

variable "psa_connection" {
  type = string
}

variable "memory_size_gb" {
  type    = number
  default = 1
}

variable "tier" {
  type        = string
  description = "BASIC (no replica) or STANDARD_HA (replica)"
  default     = "BASIC"
}
