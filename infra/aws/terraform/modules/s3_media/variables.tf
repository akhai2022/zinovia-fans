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

variable "logs_bucket_id" {
  type        = string
  default     = null
  description = "S3 bucket ID for server access logs. Null = disable."
}

variable "enable_logging" {
  type        = bool
  default     = false
  description = "Enable server access logging. Set true when logs_bucket_id is provided."
}
