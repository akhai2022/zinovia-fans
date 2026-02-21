environment  = "prod"
aws_region   = "us-east-1"
project_name = "zinovia-fans"

vpc_cidr          = "10.0.0.0/16"
use_existing_vpc  = false
nat_gateway_count = 2

# Prod: larger RDS, Multi-AZ, deletion protection
db_instance_class        = "db.t3.small"
db_multi_az              = true
db_deletion_protection   = true
db_backup_retention_days = 14

# ECS prod sizing
api_cpu          = 512
api_memory_mb    = 1024
web_cpu          = 512
web_memory_mb    = 1024
worker_cpu       = 1024
worker_memory_mb = 2048

# Autoscaling: prod min 2, max 10
api_scaling_min    = 2
api_scaling_max    = 10
web_scaling_min    = 2
web_scaling_max    = 10
worker_scaling_min = 1
worker_scaling_max = 5

# Prod: enable ALB + ACM; frontend at zinovia.ai and www.zinovia.ai
enable_alb   = true
enable_acm   = true
enable_route53 = true
enable_custom_domain = true
dns_delegated = true
enable_cloudfront = false  # Blocked: AWS account not verified for CloudFront. Run: aws support create-case
web_use_apex = true
enable_apex_cloudfront = false  # apex reserved for Next.js when web_use_apex

# HTTPS listener: requires zinovia.ai delegated to Route53 and ACM cert validated.
force_http_forwarding = false

# Block until ACM DNS validation completes so HTTPS listener can attach the cert.
wait_for_certificate_validation = true

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

# route53_zone_id = "Z0123456789ABCDEF"
