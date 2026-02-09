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
  api_domain   = var.environment == "staging" ? "stg-api.${var.domain_name}" : "api.${var.domain_name}"
  app_domain   = var.environment == "staging" ? "stg-app.${var.domain_name}" : "app.${var.domain_name}"
  media_domain = var.environment == "staging" ? "stg-media.${var.domain_name}" : "media.${var.domain_name}"
  azs          = slice(data.aws_availability_zones.available.names, 0, 3)
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
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgresql+asyncpg://zinovia:${random_password.db.result}@${module.rds.address}:5432/zinovia"
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
}

# -----------------------------------------------------------------------------
# SQS media jobs
# -----------------------------------------------------------------------------
module "sqs_media" {
  source      = "./modules/sqs_media"
  name_prefix = local.name_prefix
}

# -----------------------------------------------------------------------------
# ACM: ALB cert (regional) — only when ALB + ACM enabled
# -----------------------------------------------------------------------------
module "acm_alb" {
  count                     = var.enable_alb && var.enable_acm ? 1 : 0
  source                    = "./modules/acm"
  providers                 = { aws = aws }
  domain_name               = var.domain_name
  subject_alternative_names = [local.api_domain, local.app_domain]
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
}

# -----------------------------------------------------------------------------
# Route53: ALB (when enable_alb + enable_route53) and CloudFront media records
# -----------------------------------------------------------------------------
resource "aws_route53_record" "api" {
  count   = var.enable_alb && var.enable_route53 && var.dns_delegated ? 1 : 0
  zone_id = local.zone_id
  name    = var.environment == "staging" ? "stg-api" : "api"
  type    = "A"
  alias {
    name                   = aws_lb.main[0].dns_name
    zone_id                = aws_lb.main[0].zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "app" {
  count   = var.enable_alb && var.enable_route53 && var.dns_delegated ? 1 : 0
  zone_id = local.zone_id
  name    = var.environment == "staging" ? "stg-app" : "app"
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
  name    = var.environment == "staging" ? "stg-media" : "media"
  type    = "A"
  alias {
    name                   = module.cloudfront_media[0].distribution_domain_name
    zone_id                = module.cloudfront_media[0].distribution_hosted_zone_id
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
  tags               = { Name = "${local.name_prefix}-alb" }
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

# Listener 443 -> host-based routing (only when ALB + ACM)
resource "aws_lb_listener" "https" {
  count             = var.enable_alb && var.enable_acm ? 1 : 0
  load_balancer_arn = aws_lb.main[0].arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = module.acm_alb[0].certificate_arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not found"
      status_code  = "404"
    }
  }
}

resource "aws_lb_listener_rule" "api" {
  count        = var.enable_alb && var.enable_acm ? 1 : 0
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
  count        = var.enable_alb && var.enable_acm ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 110
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web[0].arn
  }
  condition {
    host_header {
      values = [local.app_domain]
    }
  }
}

# Redirect HTTP -> HTTPS (when ALB + ACM)
resource "aws_lb_listener" "http" {
  count             = var.enable_alb && var.enable_acm ? 1 : 0
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

# HTTP listener when ALB without ACM (forward to API target group; staging without certs)
resource "aws_lb_listener" "http_forward" {
  count             = var.enable_alb && !var.enable_acm ? 1 : 0
  load_balancer_arn = aws_lb.main[0].arn
  port              = "80"
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api[0].arn
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

# ECS task role (app: S3, SQS, Secrets Manager)
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

resource "aws_iam_role_policy" "ecs_task_sqs" {
  name = "sqs-media"
  role = aws_iam_role.ecs_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = module.sqs_media.queue_arn
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = module.sqs_media.queue_arn
      }
    ]
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
    environment = [
      { name = "ENVIRONMENT", value = var.environment },
      { name = "STORAGE", value = "s3" },
      { name = "S3_BUCKET", value = module.s3_media.bucket_id },
      { name = "CDN_BASE_URL", value = "https://${local.media_domain}" },
      { name = "MEDIA_JOBS_QUEUE_URL", value = module.sqs_media.queue_url }
    ]
    secrets = [
      { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
      { name = "JWT_SECRET", valueFrom = module.secrets.jwt_secret_arn },
      { name = "CSRF_SECRET", valueFrom = module.secrets.csrf_secret_arn }
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
    environment = [
      { name = "NEXT_PUBLIC_API_BASE_URL", value = "https://${local.api_domain}" }
    ]
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
      { name = "S3_BUCKET", value = module.s3_media.bucket_id },
      { name = "MEDIA_JOBS_QUEUE_URL", value = module.sqs_media.queue_url }
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

# Security group for public ECS API (no ALB: allow 8000 from internet; staging temporary)
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
  desired_count   = 1
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
  depends_on = [aws_lb.main[0]]
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
  desired_count   = 1
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
  depends_on = [aws_lb.main[0]]
}

resource "aws_ecs_service" "worker" {
  name            = "${local.name_prefix}-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = local.private_subnet_ids
    security_groups  = [local.ecs_security_group_id]
    assign_public_ip = false
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
  name    = var.environment == "staging" ? "stg-app" : "app"
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
