environment  = "staging"
aws_region   = "us-east-1"
project_name = "zinovia-fans"

vpc_cidr          = "10.0.0.0/16"
use_existing_vpc  = false
nat_gateway_count = 1

# ALB + target groups for ECS Fargate (API port 8000, Web port 3000); HTTP listener when no ACM
enable_alb                      = true
wait_for_certificate_validation = false

# No custom domain / ACM for now (ALB uses HTTP listener on port 80)
enable_custom_domain = false
enable_acm           = false
enable_route53       = false
enable_https         = false
dns_delegated        = false

# CloudFront disabled (account not verified)
enable_cloudfront = false

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

media_lifecycle_days = 90
media_versioning     = false

# Set after creating hosted zone for zinovia.ai, or leave "" to use data source
# route53_zone_id = "Z0123456789ABCDEF"
