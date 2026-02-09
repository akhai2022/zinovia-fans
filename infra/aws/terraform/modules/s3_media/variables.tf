variable "name_prefix" {
  type        = string
  description = "Prefix for bucket name (e.g. zinovia-fans-stg-media)"
}

variable "versioning" {
  type        = bool
  default     = false
  description = "Enable versioning"
}

variable "lifecycle_days" {
  type        = number
  default     = 0
  description = "Expire objects after N days (0 = disable)"
}

variable "environment" {
  type        = string
  description = "Environment name"
}
