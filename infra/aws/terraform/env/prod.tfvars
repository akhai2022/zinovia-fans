environment  = "prod"
aws_region   = "us-east-1"
project_name = "zinovia-fans"

# HA toggle: set true for production launch (2 NATs, Multi-AZ RDS, ECS min 2, WAF)
enable_ha = false  # Pre-launch: saves ~$58/mo. Flip to true before launch.

vpc_cidr          = "10.0.0.0/16"
use_existing_vpc  = false
nat_gateway_count = 1

# RDS
db_instance_class        = "db.t3.small"
db_multi_az              = false
db_deletion_protection   = true
db_backup_retention_days = 14

# ECS sizing
api_cpu          = 512
api_memory_mb    = 1024
web_cpu          = 512
web_memory_mb    = 1024
worker_cpu       = 1024
worker_memory_mb = 2048

# Autoscaling
api_scaling_min    = 1
api_scaling_max    = 10
web_scaling_min    = 1
web_scaling_max    = 10
worker_scaling_min = 1
worker_scaling_max = 5

# Networking
enable_alb   = true
enable_acm   = true
enable_route53 = true
enable_custom_domain = true
dns_delegated = true
enable_cloudfront = false  # Blocked: AWS account not verified for CloudFront
web_use_apex = true
enable_apex_cloudfront = false

# HTTPS
force_http_forwarding = false
wait_for_certificate_validation = true

# Media
media_lifecycle_days = 0
media_versioning     = true

# Phase flags
enable_likes           = true
enable_comments        = true
enable_notifications   = true
enable_vault           = true
enable_scheduled_posts = false
enable_promotions      = false
enable_dm_broadcast    = false
enable_ppv_posts       = false
enable_ppvm            = true
enable_moderation      = false
enable_analytics       = false
enable_mock_kyc        = true

# Currency
default_currency = "eur"

# AI
ai_provider = "replicate"
