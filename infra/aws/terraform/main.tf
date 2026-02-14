# -----------------------------------------------------------------------------
# Data
# -----------------------------------------------------------------------------
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Route53: only look up zone when we create Route53 or ACM (avoids dependency when no DNS)
data "aws_route53_zone" "main" {
  count        = (var.enable_route53 || var.enable_acm) && var.route53_zone_id == "" ? 1 : 0
  name         = var.domain_name
  private_zone = false
}

# Look up zone by ID when route53_zone_id is provided (for nameserver output)
data "aws_route53_zone" "by_id" {
  count   = (var.enable_route53 || var.enable_acm) && var.route53_zone_id != "" ? 1 : 0
  zone_id = var.route53_zone_id
}

locals {
  zone_id      = (var.enable_route53 || var.enable_acm) ? (var.route53_zone_id != "" ? var.route53_zone_id : data.aws_route53_zone.main[0].zone_id) : ""
  name_prefix  = "${var.project_name}-${var.environment}"
  api_domain   = "api.${var.domain_name}"
  app_domain   = "app.${var.domain_name}"
  media_domain = "media.${var.domain_name}"
  www_domain   = "www.${var.domain_name}"
  azs          = slice(data.aws_availability_zones.available.names, 0, 3)
  # ALB allows max 5 path patterns per rule; split into two rules
  api_path_patterns_a = ["/health", "/auth*", "/creators*", "/posts*", "/feed*"]
  api_path_patterns_b = ["/media*", "/billing*", "/ledger*"]
  api_path_patterns_c = ["/webhooks*"]

  # When web_use_apex, frontend at zinovia.ai and www.zinovia.ai; else app.zinovia.ai
  web_domains   = var.web_use_apex ? [var.domain_name, local.www_domain] : [local.app_domain]
  web_base_url  = (var.enable_alb && var.enable_custom_domain) ? (var.web_use_apex ? "https://${var.domain_name}" : "https://${local.app_domain}") : ""
  cors_origins  = join(",", concat([for d in local.web_domains : "https://${d}"], ["https://${local.api_domain}"]))
  mail_provider = var.environment == "prod" ? "ses" : "console"
  mail_from     = "noreply@${var.domain_name}"
  # API Settings expects "production" not "prod"
  api_environment = var.environment == "prod" ? "production" : var.environment
}

# -----------------------------------------------------------------------------
# SES identity (domain verification + DKIM + custom MAIL FROM)
# -----------------------------------------------------------------------------
resource "aws_ses_domain_identity" "main" {
  count  = var.enable_route53 ? 1 : 0
  domain = var.domain_name
}

resource "aws_route53_record" "ses_verification" {
  count   = var.enable_route53 ? 1 : 0
  zone_id = local.zone_id
  name    = "_amazonses.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.main[0].verification_token]
}

resource "aws_ses_domain_dkim" "main" {
  count  = var.enable_route53 ? 1 : 0
  domain = aws_ses_domain_identity.main[0].domain
}

resource "aws_route53_record" "ses_dkim" {
  count   = var.enable_route53 ? 3 : 0
  zone_id = local.zone_id
  name    = "${aws_ses_domain_dkim.main[0].dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.main[0].dkim_tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_ses_domain_mail_from" "main" {
  count                  = var.enable_route53 ? 1 : 0
  domain                 = aws_ses_domain_identity.main[0].domain
  mail_from_domain       = "mail.${var.domain_name}"
  behavior_on_mx_failure = "UseDefaultValue"
}

resource "aws_route53_record" "ses_mail_from_mx" {
  count   = var.enable_route53 ? 1 : 0
  zone_id = local.zone_id
  name    = aws_ses_domain_mail_from.main[0].mail_from_domain
  type    = "MX"
  ttl     = 600
  records = ["10 feedback-smtp.${var.aws_region}.amazonses.com"]
}

resource "aws_route53_record" "ses_mail_from_txt" {
  count   = var.enable_route53 ? 1 : 0
  zone_id = local.zone_id
  name    = aws_ses_domain_mail_from.main[0].mail_from_domain
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com -all"]
}

# -----------------------------------------------------------------------------
# DB password (stored in Secrets Manager via secrets module)
# -----------------------------------------------------------------------------
resource "random_password" "db" {
  length  = 32
  special = false
}

# -----------------------------------------------------------------------------
# Network (dedicated new VPC by default; escape hatch: use_existing_vpc = true)
# -----------------------------------------------------------------------------
module "network" {
  count              = var.use_existing_vpc ? 0 : 1
  source             = "./modules/network"
  name_prefix        = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  availability_zones = local.azs
  environment        = var.environment
  nat_gateway_count  = var.nat_gateway_count
}

# Security groups when using existing VPC (same rules as module)
resource "aws_security_group" "alb_existing" {
  count       = var.use_existing_vpc ? 1 : 0
  name_prefix = "${local.name_prefix}-alb-"
  description = "ALB: allow 80/443 from internet"
  vpc_id      = var.vpc_id
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${local.name_prefix}-alb-sg" }
  lifecycle { create_before_destroy = true }
}

resource "aws_security_group" "ecs_existing" {
  count       = var.use_existing_vpc ? 1 : 0
  name_prefix = "${local.name_prefix}-ecs-"
  description = "ECS tasks: allow from ALB only"
  vpc_id      = var.vpc_id
  ingress {
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_existing[0].id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${local.name_prefix}-ecs-sg" }
  lifecycle { create_before_destroy = true }
}

resource "aws_security_group" "rds_existing" {
  count       = var.use_existing_vpc ? 1 : 0
  name_prefix = "${local.name_prefix}-rds-"
  description = "RDS: allow from ECS tasks only"
  vpc_id      = var.vpc_id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_existing[0].id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${local.name_prefix}-rds-sg" }
  lifecycle { create_before_destroy = true }
}

locals {
  vpc_id                = var.use_existing_vpc ? var.vpc_id : module.network[0].vpc_id
  public_subnet_ids     = var.use_existing_vpc ? var.public_subnet_ids : module.network[0].public_subnet_ids
  private_subnet_ids    = var.use_existing_vpc ? var.private_subnet_ids : module.network[0].private_subnet_ids
  alb_security_group_id = var.use_existing_vpc ? aws_security_group.alb_existing[0].id : module.network[0].alb_security_group_id
  ecs_security_group_id = var.use_existing_vpc ? aws_security_group.ecs_existing[0].id : module.network[0].ecs_security_group_id
  rds_security_group_id = var.use_existing_vpc ? aws_security_group.rds_existing[0].id : module.network[0].rds_security_group_id
  nat_gateway_ids       = var.use_existing_vpc ? [] : module.network[0].nat_gateway_ids
}

# -----------------------------------------------------------------------------
# RDS
# -----------------------------------------------------------------------------
module "rds" {
  source                = "./modules/rds"
  name_prefix           = local.name_prefix
  subnet_ids            = local.private_subnet_ids
  security_group_ids    = [local.rds_security_group_id]
  instance_class        = var.db_instance_class
  multi_az              = var.db_multi_az
  deletion_protection   = var.db_deletion_protection
  backup_retention_days = var.db_backup_retention_days
  db_name               = "zinovia"
  db_username           = "zinovia"
  db_password           = random_password.db.result
}

# -----------------------------------------------------------------------------
# Secrets Manager
# -----------------------------------------------------------------------------
module "secrets" {
  source      = "./modules/secrets"
  name_prefix = local.name_prefix
  db_password = random_password.db.result
}

# Full DATABASE_URL for ECS (built from RDS endpoint + password)
resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${local.name_prefix}-database-url"
  recovery_window_in_days = 7
  tags                    = { Name = "${local.name_prefix}-database-url" }
  # lifecycle { prevent_destroy = true }  # Uncomment after initial deploy
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgresql+asyncpg://zinovia:${random_password.db.result}@${module.rds.address}:5432/zinovia"
}

# -----------------------------------------------------------------------------
# S3 logs bucket (ALB, CloudFront, S3 access logs)
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "logs" {
  bucket = "${local.name_prefix}-logs-${substr(md5(local.name_prefix), 0, 8)}"
  tags   = { Name = "${local.name_prefix}-logs" }
}

resource "aws_s3_bucket_ownership_controls" "logs" {
  bucket = aws_s3_bucket.logs.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "logs" {
  depends_on = [aws_s3_bucket_ownership_controls.logs]
  bucket     = aws_s3_bucket.logs.id
  acl        = "log-delivery-write"
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id
  rule {
    id     = "expire"
    status = "Enabled"
    filter {}
    expiration { days = 90 }
  }
}

data "aws_elb_service_account" "current" {}

resource "aws_s3_bucket_policy" "logs" {
  bucket = aws_s3_bucket.logs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowALBLogDelivery"
        Effect    = "Allow"
        Principal = { AWS = data.aws_elb_service_account.current.arn }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.logs.arn}/alb/*"
      },
      {
        Sid       = "AllowS3MediaAccessLogs"
        Effect    = "Allow"
        Principal = { Service = "logging.s3.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.logs.arn}/s3-media/*"
        Condition = {
          ArnLike = { "aws:SourceArn" = "${module.s3_media.bucket_arn}" }
        }
      },
      {
        Sid       = "AllowCloudFrontLogDelivery"
        Effect    = "Allow"
        Principal = { Service = "delivery.logs.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.logs.arn}/cloudfront/media/*"
        Condition = {
          StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }
        }
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# ECR
# -----------------------------------------------------------------------------
module "ecr" {
  source      = "./modules/ecr"
  name_prefix = local.name_prefix
}

# -----------------------------------------------------------------------------
# S3 media bucket
# -----------------------------------------------------------------------------
module "s3_media" {
  source         = "./modules/s3_media"
  name_prefix    = "${local.name_prefix}-media"
  versioning     = var.media_versioning
  lifecycle_days = var.media_lifecycle_days
  environment    = var.environment
  logs_bucket_id = aws_s3_bucket.logs.id
  enable_logging = true
}

# -----------------------------------------------------------------------------
# ElastiCache Redis (Celery broker; used by API and Worker)
# -----------------------------------------------------------------------------
resource "aws_security_group" "redis" {
  name_prefix = "${local.name_prefix}-redis-"
  description = "Redis: allow 6379 from ECS tasks"
  vpc_id      = local.vpc_id
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [local.ecs_security_group_id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${local.name_prefix}-redis" }
  lifecycle { create_before_destroy = true }
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.name_prefix}-redis"
  subnet_ids = local.private_subnet_ids
  tags       = { Name = "${local.name_prefix}-redis" }
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${local.name_prefix}-redis"
  description                = "Celery broker for ${local.name_prefix}"
  engine_version             = "7.0"
  node_type                  = "cache.t3.micro"
  num_cache_clusters         = 1
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = false # Celery redis driver typically uses non-TLS
  tags                       = { Name = "${local.name_prefix}-redis" }

  lifecycle {
    # Avoid replacement/modification conflicts when Redis is imported; AUTH requires transit_encryption
    ignore_changes = [auth_token, transit_encryption_enabled]
  }
}

locals {
  redis_url = "redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379/0"
}

# -----------------------------------------------------------------------------
# ACM: ALB cert (regional) — only when ALB + ACM enabled
# -----------------------------------------------------------------------------
module "acm_alb" {
  count                     = var.enable_alb && var.enable_acm ? 1 : 0
  source                    = "./modules/acm"
  providers                 = { aws = aws }
  domain_name               = var.domain_name
  subject_alternative_names = concat([local.api_domain], local.web_domains)
  zone_id                   = local.zone_id
  name_prefix               = "${local.name_prefix}-alb"
  create_validation_records = var.dns_delegated
  wait_for_validation       = var.wait_for_certificate_validation
}

# -----------------------------------------------------------------------------
# ACM: CloudFront media cert (us-east-1) — only when ACM enabled
# -----------------------------------------------------------------------------
module "acm_cloudfront" {
  count                     = var.enable_acm ? 1 : 0
  source                    = "./modules/acm"
  providers                 = { aws = aws.us_east_1 }
  domain_name               = var.domain_name
  subject_alternative_names = [local.media_domain]
  zone_id                   = local.zone_id
  name_prefix               = "${local.name_prefix}-cf"
  create_validation_records = var.dns_delegated
  wait_for_validation       = var.wait_for_certificate_validation
}

# -----------------------------------------------------------------------------
# ACM: apex + www (us-east-1) for CloudFront — only when enable_apex_cloudfront and not web_use_apex
# -----------------------------------------------------------------------------
module "acm_apex" {
  count                     = var.enable_apex_cloudfront && !var.web_use_apex ? 1 : 0
  source                    = "./modules/acm"
  providers                 = { aws = aws.us_east_1 }
  domain_name               = var.domain_name
  subject_alternative_names = [local.www_domain]
  zone_id                   = local.zone_id
  name_prefix               = "${local.name_prefix}-cf-apex"
  create_validation_records = var.dns_delegated
  wait_for_validation       = var.wait_for_certificate_validation
}

# -----------------------------------------------------------------------------
# CloudFront media CDN (when enable_cloudfront; default domain when no ACM, custom when enable_acm)
# -----------------------------------------------------------------------------
module "cloudfront_media" {
  count               = var.enable_cloudfront ? 1 : 0
  source              = "./modules/cloudfront_media"
  name_prefix         = local.name_prefix
  s3_bucket_id        = module.s3_media.bucket_id
  s3_bucket_arn       = module.s3_media.bucket_arn
  domain_aliases      = var.enable_custom_domain ? [local.media_domain] : []
  acm_certificate_arn = var.enable_acm ? module.acm_cloudfront[0].certificate_arn : null
  environment         = var.environment
  logs_bucket_domain  = aws_s3_bucket.logs.bucket_regional_domain_name
  logs_prefix         = "cloudfront/media"
  web_acl_id          = length(aws_wafv2_web_acl.cloudfront) > 0 ? aws_wafv2_web_acl.cloudfront[0].id : null
}

# -----------------------------------------------------------------------------
# Route53: ALB (when enable_alb + enable_route53) and CloudFront media records
# -----------------------------------------------------------------------------
resource "aws_route53_record" "api" {
  count   = var.enable_alb && var.enable_route53 && var.dns_delegated ? 1 : 0
  zone_id = local.zone_id
  name    = "api"
  type    = "A"
  alias {
    name                   = aws_lb.main[0].dns_name
    zone_id                = aws_lb.main[0].zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "app" {
  count   = var.enable_alb && var.enable_route53 && var.dns_delegated && !var.web_use_apex ? 1 : 0
  zone_id = local.zone_id
  name    = "app"
  type    = "A"
  alias {
    name                   = aws_lb.main[0].dns_name
    zone_id                = aws_lb.main[0].zone_id
    evaluate_target_health = true
  }
}

# Apex (zinovia.ai) and www.zinovia.ai → ALB when web_use_apex (Next.js at root domain)
resource "aws_route53_record" "apex_alb_a" {
  count   = var.enable_alb && var.enable_route53 && var.dns_delegated && var.web_use_apex ? 1 : 0
  zone_id = local.zone_id
  name    = ""
  type    = "A"
  alias {
    name                   = aws_lb.main[0].dns_name
    zone_id                = aws_lb.main[0].zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "www_alb" {
  count   = var.enable_alb && var.enable_route53 && var.dns_delegated && var.web_use_apex ? 1 : 0
  zone_id = local.zone_id
  name    = "www"
  type    = "A"
  alias {
    name                   = aws_lb.main[0].dns_name
    zone_id                = aws_lb.main[0].zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "media" {
  count   = var.enable_route53 && var.enable_custom_domain && var.enable_cloudfront && var.dns_delegated ? 1 : 0
  zone_id = local.zone_id
  name    = "media"
  type    = "A"
  alias {
    name                   = module.cloudfront_media[0].distribution_domain_name
    zone_id                = module.cloudfront_media[0].distribution_hosted_zone_id
    evaluate_target_health = false
  }
}

# -----------------------------------------------------------------------------
# Apex + www: CloudFront for zinovia.ai and www.zinovia.ai (when enable_apex_cloudfront)
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "apex" {
  count  = var.enable_apex_cloudfront && !var.web_use_apex ? 1 : 0
  bucket = "${local.name_prefix}-apex-${substr(md5(local.name_prefix), 0, 8)}"
  tags   = { Name = "${local.name_prefix}-apex" }
}

resource "aws_s3_bucket_public_access_block" "apex" {
  count                   = var.enable_apex_cloudfront && !var.web_use_apex ? 1 : 0
  bucket                  = aws_s3_bucket.apex[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "apex" {
  count                             = var.enable_apex_cloudfront && !var.web_use_apex ? 1 : 0
  name                              = "${local.name_prefix}-apex-oac"
  description                       = "OAC for apex S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "apex" {
  count               = var.enable_apex_cloudfront && !var.web_use_apex ? 1 : 0
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Apex + www (zinovia.ai)"
  default_root_object = "index.html"
  aliases             = [var.domain_name, local.www_domain]
  viewer_certificate {
    acm_certificate_arn      = module.acm_apex[0].certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
  origin {
    domain_name              = aws_s3_bucket.apex[0].bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.apex[0].id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.apex[0].id
  }
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.apex[0].id}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }
  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  tags = { Name = "${local.name_prefix}-apex-cdn" }
}

resource "aws_s3_bucket_policy" "apex" {
  count  = var.enable_apex_cloudfront && !var.web_use_apex ? 1 : 0
  bucket = aws_s3_bucket.apex[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFront"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.apex[0].arn}/*"
      Condition = {
        StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.apex[0].arn }
      }
    }]
  })
}

# Route53: apex (zinovia.ai) and www.zinovia.ai → CloudFront (A + AAAA ALIAS) — only when apex CF enabled (not web_use_apex)
resource "aws_route53_record" "apex_a" {
  count   = var.enable_apex_cloudfront && !var.web_use_apex && var.enable_route53 && var.dns_delegated ? 1 : 0
  zone_id = local.zone_id
  name    = ""
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.apex[0].domain_name
    zone_id                = aws_cloudfront_distribution.apex[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "apex_aaaa" {
  count   = var.enable_apex_cloudfront && !var.web_use_apex && var.enable_route53 && var.dns_delegated ? 1 : 0
  zone_id = local.zone_id
  name    = ""
  type    = "AAAA"
  alias {
    name                   = aws_cloudfront_distribution.apex[0].domain_name
    zone_id                = aws_cloudfront_distribution.apex[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www_a" {
  count   = var.enable_apex_cloudfront && !var.web_use_apex && var.enable_route53 && var.dns_delegated ? 1 : 0
  zone_id = local.zone_id
  name    = "www"
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.apex[0].domain_name
    zone_id                = aws_cloudfront_distribution.apex[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www_aaaa" {
  count   = var.enable_apex_cloudfront && !var.web_use_apex && var.enable_route53 && var.dns_delegated ? 1 : 0
  zone_id = local.zone_id
  name    = "www"
  type    = "AAAA"
  alias {
    name                   = aws_cloudfront_distribution.apex[0].domain_name
    zone_id                = aws_cloudfront_distribution.apex[0].hosted_zone_id
    evaluate_target_health = false
  }
}

# -----------------------------------------------------------------------------
# ECS cluster + ALB + services (minimal wiring; task defs reference ECR)
# -----------------------------------------------------------------------------
resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.name_prefix}-api"
  retention_in_days = var.environment == "prod" ? 30 : 7
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${local.name_prefix}-web"
  retention_in_days = var.environment == "prod" ? 30 : 7
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${local.name_prefix}-worker"
  retention_in_days = var.environment == "prod" ? 30 : 7
}

# ALB (in public subnets) — only when enable_alb = true
resource "aws_lb" "main" {
  count              = var.enable_alb ? 1 : 0
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [local.alb_security_group_id]
  subnets            = local.public_subnet_ids
  access_logs {
    bucket  = aws_s3_bucket.logs.id
    prefix  = "alb"
    enabled = true
  }
  tags = { Name = "${local.name_prefix}-alb" }
}

# Target groups (port 80 from containers; ALB terminates TLS)
resource "aws_lb_target_group" "api" {
  count       = var.enable_alb ? 1 : 0
  name        = "${local.name_prefix}-api"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = local.vpc_id
  target_type = "ip"
  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
  }
  tags = { Name = "${local.name_prefix}-api" }
}

resource "aws_lb_target_group" "web" {
  count       = var.enable_alb ? 1 : 0
  name        = "${local.name_prefix}-web"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = local.vpc_id
  target_type = "ip"
  health_check {
    path                = "/"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
  }
  tags = { Name = "${local.name_prefix}-web" }
}

# -----------------------------------------------------------------------------
# ALB Listeners
# force_http_forwarding=true: HTTP forwards (host-based) for emergency bring-up when ACM not validated.
# force_http_forwarding=false + cert validated: HTTPS listener + HTTP redirect.
# force_http_forwarding=false + no ACM/dns: HTTP forwards (path-based) for non-custom-domain.
# -----------------------------------------------------------------------------
locals {
  cert_validated        = var.enable_alb && var.enable_acm && var.dns_delegated && length(module.acm_alb) > 0 && try(module.acm_alb[0].certificate_arn_validated, null) != null
  use_https_listener    = var.enable_alb && !var.force_http_forwarding && local.cert_validated
  use_http_redirect     = local.use_https_listener
  use_http_forward_host = var.enable_alb && var.force_http_forwarding
  use_http_forward_path = var.enable_alb && !var.force_http_forwarding && (!var.enable_acm || !var.dns_delegated)
}

# HTTPS listener: only when cert validated (blocks PENDING_VALIDATION errors)
resource "aws_lb_listener" "https" {
  count             = local.use_https_listener ? 1 : 0
  load_balancer_arn = aws_lb.main[0].arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = module.acm_alb[0].certificate_arn_validated

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not found"
      status_code  = "404"
    }
  }
  depends_on = [module.acm_alb]
}

resource "aws_lb_listener_rule" "api" {
  count        = local.use_https_listener ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 100
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api[0].arn
  }
  condition {
    host_header {
      values = [local.api_domain]
    }
  }
}

resource "aws_lb_listener_rule" "web" {
  count        = local.use_https_listener ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 110
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web[0].arn
  }
  condition {
    host_header {
      values = local.web_domains
    }
  }
}

# HTTP redirect -> HTTPS (when HTTPS listener exists)
resource "aws_lb_listener" "http" {
  count             = local.use_http_redirect ? 1 : 0
  load_balancer_arn = aws_lb.main[0].arn
  port              = "80"
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTP forward with HOST-based routing (force_http_forwarding: api.zinovia.ai -> api, zinovia.ai/www -> web)
resource "aws_lb_listener" "http_forward_host" {
  count             = local.use_http_forward_host ? 1 : 0
  load_balancer_arn = aws_lb.main[0].arn
  port              = "80"
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web[0].arn
  }
}

resource "aws_lb_listener_rule" "http_host_api" {
  count        = local.use_http_forward_host ? 1 : 0
  listener_arn = aws_lb_listener.http_forward_host[0].arn
  priority     = 100
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api[0].arn
  }
  condition {
    host_header {
      values = [local.api_domain]
    }
  }
}

resource "aws_lb_listener_rule" "http_host_web" {
  count        = local.use_http_forward_host ? 1 : 0
  listener_arn = aws_lb_listener.http_forward_host[0].arn
  priority     = 110
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web[0].arn
  }
  condition {
    host_header {
      values = local.web_domains
    }
  }
}

# HTTP listener when ALB without ACM or cert not validated: path-based routing (same host)
resource "aws_lb_listener" "http_forward" {
  count             = local.use_http_forward_path ? 1 : 0
  load_balancer_arn = aws_lb.main[0].arn
  port              = "80"
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web[0].arn
  }
}

resource "aws_lb_listener_rule" "http_api_a" {
  count        = local.use_http_forward_path ? 1 : 0
  listener_arn = aws_lb_listener.http_forward[0].arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api[0].arn
  }
  condition {
    path_pattern { values = local.api_path_patterns_a }
  }
}
resource "aws_lb_listener_rule" "http_api_b" {
  count        = local.use_http_forward_path ? 1 : 0
  listener_arn = aws_lb_listener.http_forward[0].arn
  priority     = 11
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api[0].arn
  }
  condition {
    path_pattern { values = local.api_path_patterns_b }
  }
}

resource "aws_lb_listener_rule" "http_api_c" {
  count        = local.use_http_forward_path ? 1 : 0
  listener_arn = aws_lb_listener.http_forward[0].arn
  priority     = 12
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api[0].arn
  }
  condition {
    path_pattern { values = local.api_path_patterns_c }
  }
}

# -----------------------------------------------------------------------------
# Basic ALB/API 5xx alarms (no action wiring by default)
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "alb_5xx_spike" {
  count               = var.enable_alb ? 1 : 0
  alarm_name          = "${local.name_prefix}-alb-5xx-spike"
  alarm_description   = "ALB is returning elevated 5xx responses"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  metric_name         = "HTTPCode_ELB_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"
  dimensions = {
    LoadBalancer = aws_lb.main[0].arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "api_tg_5xx_spike" {
  count               = var.enable_alb ? 1 : 0
  alarm_name          = "${local.name_prefix}-api-tg-5xx-spike"
  alarm_description   = "API target group is returning elevated 5xx responses"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"
  dimensions = {
    LoadBalancer = aws_lb.main[0].arn_suffix
    TargetGroup  = aws_lb_target_group.api[0].arn_suffix
  }
}

# ECS task execution role (pull images, write logs, read secrets)
resource "aws_iam_role" "ecs_execution" {
  name = "${local.name_prefix}-ecs-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ECS task role (app: S3, Secrets Manager; Redis/Celery used for queue)
resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-ecs-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "s3-media"
  role = aws_iam_role.ecs_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
      Resource = [module.s3_media.bucket_arn, "${module.s3_media.bucket_arn}/*"]
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_secrets" {
  name = "secrets"
  role = aws_iam_role.ecs_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        module.secrets.db_password_secret_arn,
        module.secrets.jwt_secret_arn,
        module.secrets.csrf_secret_arn,
        module.secrets.stripe_secret_key_arn,
        module.secrets.stripe_webhook_secret_arn
      ]
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_ses" {
  name = "ses-mail"
  role = aws_iam_role.ecs_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:GetAccount",
        "ses:SendTemplatedEmail"
      ]
      Resource = "*"
    }]
  })
}

# Allow execution role to read secrets (for container env injection)
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "secrets"
  role = aws_iam_role.ecs_execution.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.database_url.arn,
        module.secrets.jwt_secret_arn,
        module.secrets.csrf_secret_arn,
        module.secrets.stripe_secret_key_arn,
        module.secrets.stripe_webhook_secret_arn
      ]
    }]
  })
}

# API task definition (simplified; image and env filled at deploy time or via CI)
resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_cpu
  memory                   = var.api_memory_mb
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name         = "api"
    image        = "${module.ecr.api_repository_url}:latest"
    essential    = true
    portMappings = [{ containerPort = 8000, protocol = "tcp" }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "api"
      }
    }
    environment = concat(
      [
        { name = "ENVIRONMENT", value = local.api_environment },
        { name = "STORAGE", value = "s3" },
        { name = "S3_BUCKET", value = module.s3_media.bucket_id },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "REDIS_URL", value = local.redis_url },
        { name = "JWT_ALGORITHM", value = "HS256" },
        { name = "JWT_EXPIRE_MINUTES", value = "60" },
        { name = "COOKIE_SECURE", value = local.api_environment == "production" ? "true" : "false" },
        { name = "COOKIE_SAMESITE", value = "none" },
        { name = "CORS_ORIGINS", value = local.cors_origins },
        { name = "MAIL_PROVIDER", value = local.mail_provider },
        { name = "MAIL_FROM", value = local.mail_from },
        { name = "MEDIA_URL_TTL_SECONDS", value = "3600" },
        { name = "RATE_LIMIT_MAX", value = "60" },
        { name = "RATE_LIMIT_WINDOW_SECONDS", value = "60" },
        { name = "CDN_BASE_URL", value = var.enable_cloudfront ? "https://${local.media_domain}" : "" },
        { name = "ENABLE_LIKES", value = tostring(var.enable_likes) },
        { name = "ENABLE_COMMENTS", value = tostring(var.enable_comments) },
        { name = "ENABLE_NOTIFICATIONS", value = tostring(var.enable_notifications) },
        { name = "ENABLE_VAULT", value = tostring(var.enable_vault) },
        { name = "ENABLE_SCHEDULED_POSTS", value = tostring(var.enable_scheduled_posts) },
        { name = "ENABLE_PROMOTIONS", value = tostring(var.enable_promotions) },
        { name = "ENABLE_DM_BROADCAST", value = tostring(var.enable_dm_broadcast) },
        { name = "ENABLE_PPV_POSTS", value = tostring(var.enable_ppv_posts) },
        { name = "ENABLE_PPVM", value = tostring(var.enable_ppvm) },
        { name = "ENABLE_MODERATION", value = tostring(var.enable_moderation) },
        { name = "ENABLE_ANALYTICS", value = tostring(var.enable_analytics) },
        { name = "ENABLE_MOBILE_NAV_POLISH", value = tostring(var.enable_mobile_nav_polish) },
        { name = "ENABLE_MOCK_KYC", value = tostring(var.enable_mock_kyc) },
        { name = "DEFAULT_CURRENCY", value = var.default_currency }
      ],
      local.web_base_url != "" ? [
        { name = "APP_BASE_URL", value = local.web_base_url },
        { name = "PUBLIC_WEB_BASE_URL", value = local.web_base_url }
      ] : []
    )
    secrets = [
      { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
      { name = "JWT_SECRET", valueFrom = module.secrets.jwt_secret_arn },
      { name = "CSRF_SECRET", valueFrom = module.secrets.csrf_secret_arn },
      { name = "STRIPE_SECRET_KEY", valueFrom = module.secrets.stripe_secret_key_arn },
      { name = "STRIPE_WEBHOOK_SECRET", valueFrom = module.secrets.stripe_webhook_secret_arn }
    ]
    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])
}

# Web task definition
resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name_prefix}-web"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.web_cpu
  memory                   = var.web_memory_mb
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name         = "web"
    image        = "${module.ecr.web_repository_url}:latest"
    essential    = true
    portMappings = [{ containerPort = 3000, protocol = "tcp" }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.web.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "web"
      }
    }
    environment = concat(
      [
        { name = "NEXT_PUBLIC_API_BASE_URL", value = (var.enable_alb && !var.enable_custom_domain) ? "http://${aws_lb.main[0].dns_name}" : "https://${local.api_domain}" },
        { name = "NEXT_PUBLIC_API_SAME_ORIGIN_PROXY", value = "true" },
        { name = "NEXT_PUBLIC_ENABLE_PROMOTIONS", value = tostring(var.enable_promotions) },
        { name = "NEXT_PUBLIC_ENABLE_DM_BROADCAST", value = tostring(var.enable_dm_broadcast) },
        { name = "NEXT_PUBLIC_ENABLE_PPV_POSTS", value = tostring(var.enable_ppv_posts) },
        { name = "NEXT_PUBLIC_ENABLE_PPVM", value = tostring(var.enable_ppvm) },
        { name = "NEXT_PUBLIC_ENABLE_MODERATION", value = tostring(var.enable_moderation) },
        { name = "NEXT_PUBLIC_ENABLE_ANALYTICS", value = tostring(var.enable_analytics) },
        { name = "NEXT_PUBLIC_ENABLE_MOBILE_NAV_POLISH", value = tostring(var.enable_mobile_nav_polish) }
      ],
      local.web_base_url != "" ? [{ name = "NEXT_PUBLIC_APP_URL", value = local.web_base_url }] : []
    )
  }])
}

# Worker task definition
resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name_prefix}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory_mb
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "worker"
    image     = "${module.ecr.worker_repository_url}:latest"
    essential = true
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.worker.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "worker"
      }
    }
    environment = [
      { name = "ENVIRONMENT", value = var.environment },
      { name = "STORAGE", value = "s3" },
      { name = "S3_BUCKET", value = module.s3_media.bucket_id },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "REDIS_URL", value = local.redis_url },
      { name = "CELERY_CONCURRENCY", value = "2" },
      { name = "ENABLE_NOTIFICATIONS", value = tostring(var.enable_notifications) },
      { name = "ENABLE_SCHEDULED_POSTS", value = tostring(var.enable_scheduled_posts) }
    ]
    secrets = [
      { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
      { name = "JWT_SECRET", valueFrom = module.secrets.jwt_secret_arn }
    ]
  }])
}

# Migration task definition (one-off: alembic upgrade head; same image as API)
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${local.name_prefix}-migrate"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "migrate"
    image     = "${module.ecr.api_repository_url}:latest"
    essential = true
    command   = ["sh", "-c", "cd /app/apps/api && alembic upgrade head"]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "migrate"
      }
    }
    secrets = [
      { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn }
    ]
  }])
}

# Security group for public ECS API (no ALB: allow 8000 from internet; temporary)
resource "aws_security_group" "api_public" {
  count       = var.enable_alb ? 0 : 1
  name_prefix = "${local.name_prefix}-api-public-"
  description = "ECS API public access (temporary; allow 8000 from 0.0.0.0/0)"
  vpc_id      = local.vpc_id
  ingress {
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${local.name_prefix}-api-public" }
  lifecycle { create_before_destroy = true }
}

# RDS: allow API tasks (public ECS) to connect
resource "aws_security_group_rule" "rds_from_api_public" {
  count                    = var.enable_alb ? 0 : 1
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.api_public[0].id
  security_group_id        = local.rds_security_group_id
  description              = "RDS from public ECS API"
}

# ECS API service (with ALB; Fargate in private subnets, target group = ALB)
resource "aws_ecs_service" "api" {
  count           = var.enable_alb ? 1 : 0
  name            = "${local.name_prefix}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_scaling_min
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = local.private_subnet_ids
    security_groups  = [local.ecs_security_group_id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.api[0].arn
    container_name   = "api"
    container_port   = 8000
  }
  depends_on = [
    aws_lb.main[0],
    aws_lb_listener.https,
    aws_lb_listener.http_forward_host,
    aws_lb_listener.http_forward,
  ]
}

# ECS API service (no ALB: public IP, port 8000; temporary until DNS+TLS+ingress)
resource "aws_ecs_service" "api_no_alb" {
  count           = var.enable_alb ? 0 : 1
  name            = "${local.name_prefix}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = local.public_subnet_ids
    security_groups  = [aws_security_group.api_public[0].id]
    assign_public_ip = true
  }
}

# ECS Web service (with ALB; Fargate in private subnets, target group = ALB)
resource "aws_ecs_service" "web" {
  count           = var.enable_alb ? 1 : 0
  name            = "${local.name_prefix}-web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_scaling_min
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = local.private_subnet_ids
    security_groups  = [local.ecs_security_group_id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.web[0].arn
    container_name   = "web"
    container_port   = 3000
  }
  depends_on = [
    aws_lb.main[0],
    aws_lb_listener.https,
    aws_lb_listener.http_forward_host,
    aws_lb_listener.http_forward,
  ]
}

resource "aws_ecs_service" "worker" {
  name            = "${local.name_prefix}-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_scaling_min
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = local.private_subnet_ids
    security_groups  = [local.ecs_security_group_id]
    assign_public_ip = false
  }
}

# ECS autoscaling (CPU-based)
resource "aws_appautoscaling_target" "api" {
  count              = var.enable_alb ? 1 : 0
  max_capacity       = var.api_scaling_max
  min_capacity       = var.api_scaling_min
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api[0].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}
resource "aws_appautoscaling_policy" "api_cpu" {
  count              = var.enable_alb ? 1 : 0
  name               = "${local.name_prefix}-api-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api[0].resource_id
  scalable_dimension = aws_appautoscaling_target.api[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.api[0].service_namespace
  target_tracking_scaling_policy_configuration {
    target_value = 60.0
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    scale_in_cooldown  = 120
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_target" "web" {
  count              = var.enable_alb ? 1 : 0
  max_capacity       = var.web_scaling_max
  min_capacity       = var.web_scaling_min
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.web[0].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}
resource "aws_appautoscaling_policy" "web_cpu" {
  count              = var.enable_alb ? 1 : 0
  name               = "${local.name_prefix}-web-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.web[0].resource_id
  scalable_dimension = aws_appautoscaling_target.web[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.web[0].service_namespace
  target_tracking_scaling_policy_configuration {
    target_value = 60.0
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    scale_in_cooldown  = 120
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_target" "worker" {
  max_capacity       = var.worker_scaling_max
  min_capacity       = var.worker_scaling_min
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}
resource "aws_appautoscaling_policy" "worker_cpu" {
  name               = "${local.name_prefix}-worker-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker.service_namespace
  target_tracking_scaling_policy_configuration {
    target_value = 60.0
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    scale_in_cooldown  = 120
    scale_out_cooldown = 60
  }
}

# -----------------------------------------------------------------------------
# No-ALB path: public ECS API (no API Gateway); CloudFront + S3 for web
# -----------------------------------------------------------------------------

# S3 bucket for static web (no-ALB: CloudFront serves from here)
resource "aws_s3_bucket" "web" {
  count  = var.enable_alb ? 0 : 1
  bucket = "${local.name_prefix}-web-${substr(md5(local.name_prefix), 0, 8)}"
  tags   = { Name = "${local.name_prefix}-web" }
}

resource "aws_s3_bucket_public_access_block" "web" {
  count                   = var.enable_alb ? 0 : 1
  bucket                  = aws_s3_bucket.web[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ACM for CloudFront web (app/apex) — only when no-ALB + ACM
module "acm_cloudfront_web" {
  count                     = (!var.enable_alb && var.enable_acm) ? 1 : 0
  source                    = "./modules/acm"
  providers                 = { aws = aws.us_east_1 }
  domain_name               = var.domain_name
  subject_alternative_names = [local.app_domain]
  zone_id                   = local.zone_id
  name_prefix               = "${local.name_prefix}-cf-web"
  create_validation_records = var.dns_delegated
  wait_for_validation       = var.wait_for_certificate_validation
}

resource "aws_cloudfront_origin_access_control" "web" {
  count                             = (!var.enable_alb && var.enable_cloudfront) ? 1 : 0
  name                              = "${local.name_prefix}-web-oac"
  description                       = "OAC for web S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront web: always when no ALB; default domain when !enable_acm, custom when enable_custom_domain
resource "aws_cloudfront_distribution" "web" {
  count               = (!var.enable_alb && var.enable_cloudfront) ? 1 : 0
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Web app (no-ALB)"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  aliases             = var.enable_custom_domain ? [local.app_domain, var.domain_name] : []
  viewer_certificate {
    cloudfront_default_certificate = !var.enable_acm
    acm_certificate_arn            = var.enable_acm ? module.acm_cloudfront_web[0].certificate_arn : null
    ssl_support_method             = var.enable_acm ? "sni-only" : null
    minimum_protocol_version       = var.enable_acm ? "TLSv1.2_2021" : null
  }
  origin {
    domain_name              = aws_s3_bucket.web[0].bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.web[0].id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.web[0].id
  }
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.web[0].id}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
  }
  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  tags = { Name = "${local.name_prefix}-web-cdn" }
}

resource "aws_s3_bucket_policy" "web" {
  count  = (!var.enable_alb && var.enable_cloudfront) ? 1 : 0
  bucket = aws_s3_bucket.web[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFront"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.web[0].arn}/*"
      Condition = {
        StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.web[0].arn }
      }
    }]
  })
}

# Route53: app and apex -> CloudFront web (only when custom domain + CloudFront + dns_delegated)
resource "aws_route53_record" "app_cloudfront" {
  count   = (!var.enable_alb && var.enable_route53 && var.enable_custom_domain && var.enable_cloudfront && var.dns_delegated) ? 1 : 0
  zone_id = local.zone_id
  name    = "app"
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.web[0].domain_name
    zone_id                = aws_cloudfront_distribution.web[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "apex_cloudfront" {
  count   = (!var.enable_alb && var.enable_route53 && var.enable_custom_domain && var.enable_cloudfront && var.dns_delegated) ? 1 : 0
  zone_id = local.zone_id
  name    = var.domain_name
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.web[0].domain_name
    zone_id                = aws_cloudfront_distribution.web[0].hosted_zone_id
    evaluate_target_health = false
  }
}
