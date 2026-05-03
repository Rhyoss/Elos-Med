variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "env" {
  type = string
}

variable "vpc_connector_id" {
  type = string
}

variable "service_account_emails" {
  type        = map(string)
  description = "Map de serviço -> SA email"
}

variable "cloudsql_instance" {
  type        = string
  description = "PROJECT:REGION:INSTANCE — anexado via --add-cloudsql-instances"
}

variable "domain" {
  type        = string
  description = "Domínio raiz (elosmed.com.br)"
}

variable "domain_subdomains" {
  type        = map(string)
  description = "Map de serviço -> subdomínio"
  default = {
    web    = "app"
    api    = "api"
    portal = "portal"
  }
}

variable "secret_names" {
  type        = map(string)
  description = "Map de short-name -> Secret Manager name (output do módulo secrets)"
}

variable "min_instances" {
  type        = map(number)
  description = "min instances por serviço"
  default = {
    api    = 0
    web    = 0
    worker = 1 # BullMQ não pode escalar a zero
    ai     = 0
    search = 0
  }
}

variable "max_instances" {
  type    = map(number)
  default = {
    api    = 10
    web    = 10
    worker = 3
    ai     = 5
    search = 3
  }
}

variable "placeholder_image" {
  type        = string
  description = "Imagem inicial usada na primeira criação. Os deploys reais vêm pelo GitHub Actions."
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}
