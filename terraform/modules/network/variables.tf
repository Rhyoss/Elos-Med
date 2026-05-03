variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  description = "GCP region"
}

variable "env" {
  type        = string
  description = "Environment name (staging|prod)"
}

variable "vpc_cidr" {
  type        = string
  description = "Primary subnet CIDR for the VPC"
  default     = "10.10.0.0/20"
}

variable "connector_cidr" {
  type        = string
  description = "/28 reserved for Serverless VPC Access (Cloud Run egress)"
  default     = "10.10.16.0/28"
}

variable "psa_cidr" {
  type        = string
  description = "/16 reserved for Private Service Access (Cloud SQL, Memorystore peering)"
  default     = "10.20.0.0/16"
}
