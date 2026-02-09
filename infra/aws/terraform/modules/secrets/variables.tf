variable "name_prefix" {
  type        = string
  description = "Prefix for secret names"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "RDS master password to store"
}

variable "jwt_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "JWT secret (leave empty to create placeholder)"
}

variable "csrf_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "CSRF secret (leave empty to create placeholder)"
}
