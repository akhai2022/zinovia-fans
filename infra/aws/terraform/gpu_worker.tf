# -----------------------------------------------------------------------------
# GPU Worker Infrastructure — EC2 Capacity Provider with g4dn Spot instances
#
# Provides GPU-accelerated ECS workers for Wan2.2-Animate-14B inference.
# Uses Spot instances by default to minimize cost (~70% cheaper than On-Demand).
# Falls back to On-Demand if Spot capacity is unavailable.
#
# Architecture:
#   - EC2 Auto Scaling Group with ECS-optimized GPU AMI
#   - ECS Capacity Provider linked to the ASG
#   - GPU Worker ECS Service using EC2 launch type
#   - Separate task definition with GPU resource requirements
#   - Scales to 0 when no GPU tasks are pending (cost optimization)
#
# Enable: set enable_gpu_worker = true in prod.tfvars
# -----------------------------------------------------------------------------

# --- Variables ---

variable "enable_gpu_worker" {
  type        = bool
  default     = false
  description = "Enable GPU worker infrastructure (EC2 + g4dn Spot for Wan2.2-Animate)"
}

variable "gpu_instance_type" {
  type        = string
  default     = "g4dn.xlarge"
  description = "EC2 instance type for GPU workers. g4dn.xlarge = 1x T4 16GB, 4 vCPU, 16GB RAM"
}

variable "gpu_worker_scaling_min" {
  type        = number
  default     = 0
  description = "Minimum GPU worker instances (0 = scale to zero when idle)"
}

variable "gpu_worker_scaling_max" {
  type        = number
  default     = 2
  description = "Maximum GPU worker instances"
}

variable "gpu_worker_volume_size" {
  type        = number
  default     = 100
  description = "Root EBS volume size in GB for GPU workers (needs space for model weights ~30GB)"
}

variable "gpu_worker_spot_enabled" {
  type        = bool
  default     = true
  description = "Use Spot instances for GPU workers (70% cheaper, may be interrupted)"
}

# --- Data: ECS-optimized GPU AMI ---

data "aws_ssm_parameter" "ecs_gpu_ami" {
  count = var.enable_gpu_worker ? 1 : 0
  name  = "/aws/service/ecs/optimized-ami/amazon-linux-2/gpu/recommended/image_id"
}

# --- IAM: EC2 instance profile for ECS ---

resource "aws_iam_role" "gpu_ecs_instance" {
  count = var.enable_gpu_worker ? 1 : 0
  name  = "${local.name_prefix}-gpu-ecs-instance"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })

  tags = { Name = "${local.name_prefix}-gpu-ecs-instance" }
}

resource "aws_iam_role_policy_attachment" "gpu_ecs_instance" {
  count      = var.enable_gpu_worker ? 1 : 0
  role       = aws_iam_role.gpu_ecs_instance[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_role_policy_attachment" "gpu_ecs_ssm" {
  count      = var.enable_gpu_worker ? 1 : 0
  role       = aws_iam_role.gpu_ecs_instance[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "gpu_ecs" {
  count = var.enable_gpu_worker ? 1 : 0
  name  = "${local.name_prefix}-gpu-ecs"
  role  = aws_iam_role.gpu_ecs_instance[0].name
}

# --- Launch Template ---

resource "aws_launch_template" "gpu_worker" {
  count         = var.enable_gpu_worker ? 1 : 0
  name_prefix   = "${local.name_prefix}-gpu-worker-"
  image_id      = data.aws_ssm_parameter.ecs_gpu_ami[0].value
  instance_type = var.gpu_instance_type

  iam_instance_profile {
    arn = aws_iam_instance_profile.gpu_ecs[0].arn
  }

  vpc_security_group_ids = [local.ecs_security_group_id]

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = var.gpu_worker_volume_size
      volume_type           = "gp3"
      delete_on_termination = true
      encrypted             = true
    }
  }

  # Register instance with ECS cluster
  user_data = base64encode(<<-EOF
    #!/bin/bash
    echo "ECS_CLUSTER=${aws_ecs_cluster.main.name}" >> /etc/ecs/ecs.config
    echo "ECS_ENABLE_GPU_SUPPORT=true" >> /etc/ecs/ecs.config
    echo "ECS_ENABLE_SPOT_INSTANCE_DRAINING=true" >> /etc/ecs/ecs.config
    echo "ECS_CONTAINER_STOP_TIMEOUT=120s" >> /etc/ecs/ecs.config
  EOF
  )

  # NOTE: Spot is configured in the ASG mixed_instances_policy, not here.
  # Launch template must NOT have instance_market_options when used with
  # mixed_instances_policy.

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${local.name_prefix}-gpu-worker"
    }
  }

  tags = { Name = "${local.name_prefix}-gpu-worker-lt" }
}

# --- Auto Scaling Group ---

resource "aws_autoscaling_group" "gpu_worker" {
  count               = var.enable_gpu_worker ? 1 : 0
  name_prefix         = "${local.name_prefix}-gpu-worker-"
  vpc_zone_identifier = local.private_subnet_ids
  min_size            = var.gpu_worker_scaling_min
  max_size            = var.gpu_worker_scaling_max
  desired_capacity    = var.gpu_worker_scaling_min

  # Spot: allow mixed instance types for better availability
  mixed_instances_policy {
    launch_template {
      launch_template_specification {
        launch_template_id = aws_launch_template.gpu_worker[0].id
        version            = "$Latest"
      }

      # g4dn.2xlarge: 8 vCPU, 32 GB, 1x T4 GPU — minimum for task (7 vCPU, 30 GB)
      override {
        instance_type = "g4dn.2xlarge"
      }
    }

    instances_distribution {
      on_demand_base_capacity                  = var.gpu_worker_spot_enabled ? 0 : 1
      on_demand_percentage_above_base_capacity = var.gpu_worker_spot_enabled ? 0 : 100
      spot_allocation_strategy                 = "capacity-optimized"
    }
  }

  # Protect from scale-in while tasks are running
  protect_from_scale_in = true

  tag {
    key                 = "Name"
    value               = "${local.name_prefix}-gpu-worker"
    propagate_at_launch = true
  }

  tag {
    key                 = "AmazonECSManaged"
    value               = "true"
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

# --- ECS Capacity Provider ---

resource "aws_ecs_capacity_provider" "gpu" {
  count = var.enable_gpu_worker ? 1 : 0
  name  = "${local.name_prefix}-gpu"

  auto_scaling_group_provider {
    auto_scaling_group_arn         = aws_autoscaling_group.gpu_worker[0].arn
    managed_termination_protection = "ENABLED"

    managed_scaling {
      status                    = "ENABLED"
      target_capacity           = 100
      minimum_scaling_step_size = 1
      maximum_scaling_step_size = 1
      # Scale in when no GPU tasks pending
      instance_warmup_period = 300
    }
  }
}

resource "aws_ecs_cluster_capacity_providers" "gpu" {
  count        = var.enable_gpu_worker ? 1 : 0
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = [aws_ecs_capacity_provider.gpu[0].name]

  # Don't set default — Fargate services still use launch_type = "FARGATE"
}

# --- CloudWatch Log Group ---

resource "aws_cloudwatch_log_group" "gpu_worker" {
  count             = var.enable_gpu_worker ? 1 : 0
  name              = "/ecs/${local.name_prefix}-gpu-worker"
  retention_in_days = var.environment == "prod" ? 30 : 7
  tags              = { Name = "${local.name_prefix}-gpu-worker" }
}

# --- GPU Worker ECR Repository ---

resource "aws_ecr_repository" "gpu_worker" {
  count                = var.enable_gpu_worker ? 1 : 0
  name                 = "${local.name_prefix}-gpu-worker"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = "${local.name_prefix}-gpu-worker" }
}

# --- GPU Worker Task Definition ---

resource "aws_ecs_task_definition" "gpu_worker" {
  count                    = var.enable_gpu_worker ? 1 : 0
  family                   = "${local.name_prefix}-gpu-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["EC2"]
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  # EC2: CPU/memory managed by instance, but we set limits
  cpu    = 7168   # 7 vCPU (g4dn.2xlarge has 8, leave 1 for system)
  memory = 30720  # 30 GB (g4dn.2xlarge has 32GB, leave 2GB for system)

  container_definitions = jsonencode([{
    name      = "gpu-worker"
    image     = var.enable_gpu_worker ? "${aws_ecr_repository.gpu_worker[0].repository_url}:latest" : "placeholder"
    essential = true

    # GPU resource requirement — ECS places this on GPU instances
    resourceRequirements = [{
      type  = "GPU"
      value = "1"
    }]

    stopTimeout = 120  # 2 min grace for Wan inference cleanup

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = var.enable_gpu_worker ? aws_cloudwatch_log_group.gpu_worker[0].name : ""
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "gpu-worker"
      }
    }

    environment = [
      { name = "ENVIRONMENT", value = var.environment },
      { name = "STORAGE", value = "s3" },
      { name = "S3_BUCKET", value = module.s3_media.bucket_id },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "REDIS_URL", value = local.redis_url },
      { name = "CELERY_CONCURRENCY", value = "1" },
      { name = "ENABLE_AI_TOOLS", value = "true" },
      { name = "ENABLE_VIRTUAL_TRYON", value = "true" },
      { name = "MOTION_TRANSFER_BACKEND", value = "mimic_motion" },
      { name = "ENABLE_MOTION_TRANSFER", value = "true" },
      # MimicMotion config
      { name = "MIMIC_MOTION_CKPT", value = "/app/models/MimicMotion_1-1.pth" },
      { name = "MIMIC_MOTION_DWPOSE_DIR", value = "/app/models/DWPose" },
      { name = "MIMIC_MOTION_RESOLUTION", value = "576" },
      { name = "MIMIC_MOTION_NUM_STEPS", value = "25" },
      { name = "MIMIC_MOTION_MAX_DURATION", value = "15" },
      # Worker shared settings
      { name = "MAIL_PROVIDER", value = "resend" },
      { name = "COOKIE_SECURE", value = "true" },
    ]

    secrets = [
      { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
      { name = "JWT_SECRET", valueFrom = module.secrets.jwt_secret_arn },
      { name = "CSRF_SECRET", valueFrom = module.secrets.csrf_secret_arn },
      { name = "REPLICATE_API_TOKEN", valueFrom = module.secrets.replicate_api_token_arn },
      { name = "HF_TOKEN", valueFrom = "arn:aws:secretsmanager:us-east-1:208030346312:secret:zinovia-fans-prod-hf-token-Hospv2" },
    ]
  }])
}

# --- GPU Worker ECS Service ---

resource "aws_ecs_service" "gpu_worker" {
  count           = var.enable_gpu_worker ? 1 : 0
  name            = "${local.name_prefix}-gpu-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.gpu_worker[0].arn
  desired_count   = var.gpu_worker_scaling_min

  # Use EC2 capacity provider (not Fargate)
  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.gpu[0].name
    weight            = 1
    base              = 0
  }

  network_configuration {
    subnets          = local.private_subnet_ids
    security_groups  = [local.ecs_security_group_id]
    assign_public_ip = false
  }

  # Wait for capacity provider to be ready
  depends_on = [
    aws_ecs_cluster_capacity_providers.gpu,
  ]
}

# --- Outputs ---

output "gpu_worker_ecr_url" {
  value       = var.enable_gpu_worker ? aws_ecr_repository.gpu_worker[0].repository_url : null
  description = "ECR repository URL for GPU worker image"
}

output "gpu_worker_asg_name" {
  value       = var.enable_gpu_worker ? aws_autoscaling_group.gpu_worker[0].name : null
  description = "Auto Scaling Group name for GPU worker instances"
}

output "ecs_gpu_worker_service_name" {
  value       = var.enable_gpu_worker ? aws_ecs_service.gpu_worker[0].name : null
  description = "ECS GPU worker service name"
}
