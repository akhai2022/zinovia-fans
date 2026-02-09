variable "environment" {
  type        = string
  description = "Environment name: staging or prod"
  validation {
    condition     = contains(["staging", "prod"], var.environment)
    error_message = "environment must be staging or prod."
  }
}

variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "Primary AWS region for ECS, RDS, S3, ALB, Secrets Manager (staging must use us-east-1)."
  validation {
    condition     = var.environment != "staging" || var.aws_region == "us-east-1"
    error_message = "Staging must use aws_region = us-east-1."
  }
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

# NAT: 1 for staging (cost), 2 for prod (HA)
variable "nat_gateway_count" {
  type        = number
  default     = 1
  description = "Number of NAT gateways in new VPC (1 = staging, 2 = prod)"
}

# RDS
variable "db_instance_class" {
  type        = string
  default     = "db.t3.micro"
  description = "RDS instance class (staging: db.t3.micro; prod: db.t3.small or larger)"
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

# S3 / media
variable "media_lifecycle_days" {
  type        = number
  default     = 90
  description = "S3 media bucket: expire objects after N days (0 to disable; staging only)"
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
