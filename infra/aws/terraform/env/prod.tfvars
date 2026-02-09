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

media_lifecycle_days = 0
media_versioning     = true

# route53_zone_id = "Z0123456789ABCDEF"
