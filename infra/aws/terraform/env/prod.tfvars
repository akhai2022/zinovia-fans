environment  = "prod"
aws_region   = "us-east-1"
project_name = "zinovia-fans"

# HA toggle: set true for production launch (2 NATs, Multi-AZ RDS, ECS min 2, WAF)
enable_ha = false # Pre-launch: saves ~$58/mo. Flip to true before launch.

vpc_cidr          = "10.0.0.0/16"
use_existing_vpc  = false
nat_gateway_count = 1

# RDS
db_instance_class        = "db.t3.small"
db_multi_az              = true
db_deletion_protection   = true
db_backup_retention_days = 14

# ECS sizing
api_cpu          = 512
api_memory_mb    = 1024
web_cpu          = 512
web_memory_mb    = 1024
worker_cpu       = 2048
worker_memory_mb = 8192

# Autoscaling
api_scaling_min    = 1
api_scaling_max    = 10
web_scaling_min    = 1
web_scaling_max    = 10
worker_scaling_min = 1
worker_scaling_max = 5

# Networking
enable_alb             = true
enable_acm             = true
enable_route53         = true
enable_custom_domain   = true
dns_delegated          = true
enable_cloudfront      = true # CloudFront CDN for web (zinovia.ai) + media (media.zinovia.ai)
web_use_apex           = true
enable_apex_cloudfront = false
enable_waf             = true # WAF for ALB + CloudFront distributions

# HTTPS
force_http_forwarding           = false
wait_for_certificate_validation = true

# Media
media_lifecycle_days = 0
media_versioning     = true

# Phase flags
enable_likes           = true
enable_comments        = true
enable_notifications   = true
enable_vault           = true
enable_scheduled_posts = true
enable_promotions      = true
enable_dm_broadcast    = true
enable_ppv_posts       = true
enable_ppvm            = true
enable_moderation      = true
enable_analytics       = true
enable_mock_kyc        = true

# AI & Advanced features
enable_mobile_nav_polish = true
enable_smart_previews    = true
enable_promo_generator   = true
enable_translations      = true
enable_ai_safety         = true
enable_ai_tools          = true
enable_cartoon_avatar    = true

# Currency
default_currency = "eur"

# AI
ai_provider = "replicate"

# GPU Worker (Wan2.2-Animate) — enable when ready to provision GPU instances
# Set to true, then: terraform apply -var-file=env/prod.tfvars
enable_gpu_worker      = true
gpu_instance_type      = "g4dn.xlarge"  # 1x T4 16GB, 4 vCPU, 16GB RAM — ~$0.16/hr Spot
gpu_worker_scaling_min = 0  # Scale to zero when idle (cost optimization)
gpu_worker_scaling_max = 2
gpu_worker_volume_size = 200  # GB — model weights ~30GB + Docker image ~15GB + workspace
gpu_worker_spot_enabled = true  # Spot approved — ~$0.16/hr vs $0.526/hr On-Demand
