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

variable "s3_bucket_regional_domain_name" {
  type        = string
  description = "S3 bucket regional domain name (e.g. bucket.s3.us-east-1.amazonaws.com)"
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

variable "logs_bucket_domain" {
  type        = string
  default     = null
  description = "S3 bucket domain for access logs (e.g. bucket.s3.region.amazonaws.com). Null = disable logging."
}

variable "logs_prefix" {
  type        = string
  default     = "cloudfront/media"
  description = "Prefix for CloudFront log files"
}

variable "web_acl_id" {
  type        = string
  default     = null
  description = "WAF v2 Web ACL ID (CLOUDFRONT scope). Null = no WAF."
}
