environment  = "staging"
aws_region   = "us-east-1"
project_name = "zinovia-fans"

vpc_cidr          = "10.0.0.0/16"
use_existing_vpc  = false
nat_gateway_count = 1

# ALB + target groups for ECS Fargate (API port 8000, Web port 3000); HTTP listener when no ACM
enable_alb                      = true
wait_for_certificate_validation = false

# Custom domain zinovia.ai: stg-api.zinovia.ai, stg-app.zinovia.ai (create Route53 hosted zone first if needed)
enable_custom_domain = true
enable_acm           = true
enable_route53       = true
enable_https         = true
# dns_delegated=false: use HTTP listener until ACM cert validates. Set true after cert is ISSUED to get HTTPS + A records.
dns_delegated = false

# CloudFront for media (stg-media.zinovia.ai)
enable_cloudfront = true

# Apex + www: zinovia.ai and www.zinovia.ai → CloudFront (ACM in us-east-1 with both names; Route53 A/AAAA ALIAS)
enable_apex_cloudfront = true

# Staging: small RDS
db_instance_class        = "db.t3.micro"
db_multi_az              = false
db_deletion_protection   = false
db_backup_retention_days = 7

# ECS staging sizing
api_cpu          = 256
api_memory_mb    = 512
web_cpu          = 256
web_memory_mb    = 512
worker_cpu       = 512
worker_memory_mb = 1024

# Autoscaling: staging min 1, max 2-3
api_scaling_min    = 1
api_scaling_max    = 2
web_scaling_min    = 1
web_scaling_max    = 2
worker_scaling_min = 1
worker_scaling_max = 2

media_lifecycle_days = 90
media_versioning     = false

# Phase flags (turn on in staging after deploy + QA)
enable_likes           = false
enable_comments        = false
enable_notifications   = false
enable_vault           = false
enable_scheduled_posts = false
enable_promotions      = false
enable_dm_broadcast    = false
enable_ppv_posts       = false
enable_ppvm            = false
enable_moderation      = false
enable_analytics       = false

# Set after creating hosted zone for zinovia.ai, or leave "" to use data source
# route53_zone_id = "Z0123456789ABCDEF"
