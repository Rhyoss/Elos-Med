variable "project_id" {
  type = string
}

variable "env" {
  type = string
}

variable "secret_ids" {
  type        = map(string)
  description = "Map de secret short-name -> full resource id (output do módulo secrets)"
}

variable "bucket_names" {
  type        = map(string)
  description = "Map de purpose -> bucket name (output do módulo storage)"
}

variable "kms_key_phi" {
  type = string
}

variable "kms_key_general" {
  type = string
}

variable "cloudsql_instance" {
  type        = string
  description = "PROJECT:REGION:INSTANCE"
}
