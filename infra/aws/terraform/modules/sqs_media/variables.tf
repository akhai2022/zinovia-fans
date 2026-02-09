variable "name_prefix" {
  type        = string
  description = "Prefix for queue name"
}

variable "message_retention_seconds" {
  type        = number
  default     = 86400
  description = "Message retention (24h default)"
}

variable "visibility_timeout_seconds" {
  type        = number
  default     = 600
  description = "Visibility timeout (10 min for worker processing)"
}
