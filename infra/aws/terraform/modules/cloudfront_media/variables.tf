variable "name_prefix" {
  type        = string
  description = "Prefix for distribution name"
}

variable "s3_bucket_id" {
  type        = string
  description = "S3 bucket ID (origin)"
}

variable "s3_bucket_arn" {
  type        = string
  description = "S3 bucket ARN (for OAC)"
}

variable "domain_aliases" {
  type        = list(string)
  default     = []
  description = "Custom domain aliases (e.g. media.zinovia.ai). Empty = use default CloudFront domain only."
}

variable "acm_certificate_arn" {
  type        = string
  default     = null
  description = "ACM certificate ARN (us-east-1). Null = use CloudFront default certificate (no custom domain)."
}

variable "environment" {
  type        = string
  description = "Environment name"
}
