variable "domain_name" {
  type        = string
  description = "Root domain (e.g. zinovia.ai)"
}

variable "subject_alternative_names" {
  type        = list(string)
  description = "Additional domains (e.g. api.zinovia.ai, app.zinovia.ai, media.zinovia.ai)"
}

variable "zone_id" {
  type        = string
  description = "Route53 hosted zone ID for DNS validation"
}

variable "name_prefix" {
  type        = string
  description = "Prefix for certificate name"
}

# When false, do not create Route53 validation records or aws_acm_certificate_validation; output validation options for manual DNS.
variable "create_validation_records" {
  type        = bool
  default     = true
  description = "If true, create Route53 validation records and optionally wait. If false, do not create records (output validation_options for manual creation)."
}

# When false, do not create aws_acm_certificate_validation (apply won't block; cert must validate before use in CloudFront/ALB).
variable "wait_for_validation" {
  type        = bool
  default     = true
  description = "If true and create_validation_records=true, Terraform blocks until ACM DNS validation completes."
}
