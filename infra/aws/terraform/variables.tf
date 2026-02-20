variable "environment" {
  type        = string
  description = "Environment name: prod only"
  validation {
    condition     = var.environment == "prod"
    error_message = "environment must be prod."
  }
}

variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "Primary AWS region for ECS, RDS, S3, ALB, Secrets Manager."
}

variable "project_name" {
  type        = string
  default     = "zinovia-fans"
  description = "Project name used in resource names"
}

variable "domain_name" {
  type        = string
  default     = "zinovia.ai"
  description = "Root domain (e.g. zinovia.ai)"
}

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
  description = "CIDR for VPC (used when creating new VPC)"
}

# Escape hatch: use existing VPC instead of creating one (default = false, use new dedicated VPC)
variable "use_existing_vpc" {
  type        = bool
  default     = false
  description = "If true, use existing VPC and subnets (provide vpc_id, public_subnet_ids, private_subnet_ids). Default false = create dedicated new VPC."
}

variable "vpc_id" {
  type        = string
  default     = ""
  description = "Existing VPC ID (required when use_existing_vpc = true)"
}

variable "public_subnet_ids" {
  type        = list(string)
  default     = []
  description = "Existing public subnet IDs for ALB (required when use_existing_vpc = true)"
}

variable "private_subnet_ids" {
  type        = list(string)
  default     = []
  description = "Existing private subnet IDs for ECS and RDS (required when use_existing_vpc = true)"
}

variable "nat_gateway_count" {
  type        = number
  default     = 1
  description = "Number of NAT gateways in new VPC (2 for prod HA)"
}

# RDS
variable "db_instance_class" {
  type        = string
  default     = "db.t3.micro"
  description = "RDS instance class (prod: db.t3.small or larger)"
}

variable "db_multi_az" {
  type        = bool
  default     = false
  description = "Enable Multi-AZ for RDS (recommended for prod)"
}

variable "db_deletion_protection" {
  type        = bool
  default     = false
  description = "Enable deletion protection on RDS (true for prod)"
}

variable "db_backup_retention_days" {
  type        = number
  default     = 7
  description = "RDS backup retention in days"
}

# ECS
variable "api_cpu" {
  type        = number
  default     = 256
  description = "API task CPU units"
}

variable "api_memory_mb" {
  type        = number
  default     = 512
  description = "API task memory MB"
}

variable "web_cpu" {
  type        = number
  default     = 256
  description = "Web task CPU units"
}

variable "web_memory_mb" {
  type        = number
  default     = 512
  description = "Web task memory MB"
}

variable "worker_cpu" {
  type        = number
  default     = 512
  description = "Worker task CPU units (ffmpeg needs more)"
}

variable "worker_memory_mb" {
  type        = number
  default     = 1024
  description = "Worker task memory MB"
}

# ECS autoscaling (min/max tasks per service)
variable "api_scaling_min" {
  type        = number
  default     = 1
  description = "Minimum API tasks"
}
variable "api_scaling_max" {
  type        = number
  default     = 3
  description = "Maximum API tasks"
}
variable "web_scaling_min" {
  type        = number
  default     = 1
  description = "Minimum Web tasks"
}
variable "web_scaling_max" {
  type        = number
  default     = 3
  description = "Maximum Web tasks"
}
variable "worker_scaling_min" {
  type        = number
  default     = 1
  description = "Minimum Worker tasks"
}
variable "worker_scaling_max" {
  type        = number
  default     = 2
  description = "Maximum Worker tasks"
}

# S3 / media
variable "media_lifecycle_days" {
  type        = number
  default     = 90
  description = "S3 media bucket: expire objects after N days (0 to disable)"
}

variable "media_versioning" {
  type        = bool
  default     = false
  description = "Enable S3 versioning on media bucket (true for prod)"
}

# When false, do not create ALB/NLB; use CloudFront (web) + API Gateway + Lambda (API) instead (for accounts that cannot create LBs).
variable "enable_alb" {
  type        = bool
  default     = false
  description = "If true, create ALB and route app/api via ALB. If false, use CloudFront (web) and API Gateway + Lambda (API)."
}

# When false, ACM module does not block on certificate validation (apply won't hang; ensure zinovia.ai is delegated to Route53 for validation). 
variable "wait_for_certificate_validation" {
  type        = bool
  default     = false
  description = "If true, Terraform blocks until ACM DNS validation completes. Set true only after domain is delegated to Route53."
}

# No DNS yet: deploy with default CloudFront/API Gateway URLs (no custom domain, no ACM, no Route53).
variable "enable_custom_domain" {
  type        = bool
  default     = false
  description = "If true, use custom domain (zinovia.ai) and create Route53/ACM. If false, use CloudFront/API Gateway default URLs only."
}

variable "enable_acm" {
  type        = bool
  default     = false
  description = "If true, create ACM certificates (requires enable_route53 for DNS validation). If false, no certs; CloudFront/API Gateway use default domains."
}

variable "enable_route53" {
  type        = bool
  default     = false
  description = "If true, create Route53 records. If false, no DNS records (use default CloudFront/API Gateway URLs)."
}

variable "enable_https" {
  type        = bool
  default     = false
  description = "If true, use HTTPS with custom certs where applicable. When false with default domains, CloudFront/API Gateway still serve HTTPS by default."
}

# When false, skip CloudFront (web + media). Use when account cannot create CloudFront (e.g. not verified).
variable "enable_cloudfront" {
  type        = bool
  default     = true
  description = "If true, create CloudFront distributions for web and media. Set false when AWS account cannot add CloudFront resources (e.g. account not verified)."
}

# Optional: existing hosted zone ID (if zone created outside Terraform)
variable "route53_zone_id" {
  type        = string
  default     = ""
  description = "Route53 hosted zone ID for domain_name. Leave empty to create zone (or use data source)."
}

# When false, do not create Route53 A/alias or ACM validation records; output required DNS instead. Set true after delegating zinovia.ai to Route53.
variable "dns_delegated" {
  type        = bool
  default     = false
  description = "If true, create Route53 A/alias and ACM validation records. If false, create no DNS records and output nameservers + ACM CNAMEs for manual setup."
}

# When true, serve Next.js at zinovia.ai and www.zinovia.ai instead of app.zinovia.ai. Mutually exclusive with enable_apex_cloudfront.
variable "web_use_apex" {
  type        = bool
  default     = false
  description = "If true (prod only), frontend is at apex (zinovia.ai) and www.zinovia.ai via ALB; disable enable_apex_cloudfront."

  validation {
    condition     = !var.web_use_apex || !var.enable_apex_cloudfront
    error_message = "web_use_apex and enable_apex_cloudfront cannot both be true; they are mutually exclusive."
  }
}

# Apex + www: CloudFront for zinovia.ai and www.zinovia.ai (ACM in us-east-1 with both names). Requires enable_route53, enable_acm, enable_cloudfront. Mutually exclusive with web_use_apex.
variable "enable_apex_cloudfront" {
  type        = bool
  default     = false
  description = "If true, create CloudFront for apex (zinovia.ai) and www.zinovia.ai with ACM cert covering both; Route53 A/AAAA ALIAS to CloudFront."
}

# Emergency mode: when true, HTTP listener forwards to target groups (host-based) instead of redirecting to HTTPS. Use when ACM cert is PENDING_VALIDATION or for temporary bring-up.
variable "force_http_forwarding" {
  type        = bool
  default     = false
  description = "If true, ALB HTTP listener forwards to target groups (api/web). Use for emergency bring-up when ACM not validated. Set false after HTTPS is working."
}

# Phase feature toggles (propagated as container env vars)
variable "enable_likes" {
  type    = bool
  default = false
}
variable "enable_comments" {
  type    = bool
  default = false
}
variable "enable_notifications" {
  type    = bool
  default = false
}
variable "enable_vault" {
  type    = bool
  default = false
}
variable "enable_scheduled_posts" {
  type    = bool
  default = false
}
variable "enable_promotions" {
  type    = bool
  default = false
}
variable "enable_dm_broadcast" {
  type    = bool
  default = false
}
variable "enable_ppv_posts" {
  type    = bool
  default = true
}
variable "enable_ppvm" {
  type    = bool
  default = false
}
variable "enable_moderation" {
  type    = bool
  default = false
}
variable "enable_analytics" {
  type    = bool
  default = false
}
variable "enable_mobile_nav_polish" {
  type    = bool
  default = false
}
variable "enable_mock_kyc" {
  type        = bool
  default     = false
  description = "Allow mock KYC provider in production (temporary until real KYC vendor integrated)"
}

variable "default_currency" {
  type        = string
  default     = "eur"
  description = "Default currency for subscription pricing and PPV (ISO 4217 lowercase)"
}

# CCBill payment processor
variable "ccbill_account_number" {
  type        = string
  default     = ""
  description = "CCBill merchant account number"
}

variable "ccbill_sub_account" {
  type        = string
  default     = ""
  description = "CCBill sub-account number"
}

variable "ccbill_flex_form_id" {
  type        = string
  default     = ""
  description = "CCBill FlexForms form ID"
}

variable "ccbill_datalink_username" {
  type        = string
  default     = ""
  description = "CCBill Datalink API username"
}

variable "ccbill_test_mode" {
  type        = bool
  default     = false
  description = "Enable CCBill test mode (false for production)"
}

variable "resend_api_key" {
  type        = string
  sensitive   = true
  description = "Resend API key for transactional email delivery"
}

variable "ai_provider" {
  type        = string
  default     = "mock"
  description = "AI image generation provider: mock or replicate"
}
