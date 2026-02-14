# Prod Bring-Up Runbook

Emergency and staged bring-up for zinovia-fans production when ACM cert is PENDING_VALIDATION or infrastructure is partially deployed.

## Prerequisites

- AWS CLI configured (profile or env)
- Terraform 1.6+
- Secrets restored (run `./scripts/restore-secrets.sh prod` if secrets were scheduled for deletion)

## Pre-Apply: Import Existing Resources (REQUIRED when state is out of sync)

Run these imports **before** the first apply when resources already exist in AWS but are not in Terraform state. Skip imports for resources already in state.

```bash
cd infra/aws/terraform
TF_VARS="-var-file=env/prod.tfvars -var=enable_cloudfront=false -lock=false"

# Secrets (run all if any fail with ResourceExistsException)
terraform import $TF_VARS 'aws_secretsmanager_secret.database_url' 'zinovia-fans-prod-database-url'
terraform import $TF_VARS 'module.secrets.aws_secretsmanager_secret.db_password' 'zinovia-fans-prod-db-password'
terraform import $TF_VARS 'module.secrets.aws_secretsmanager_secret.jwt_secret' 'zinovia-fans-prod-jwt-secret'
terraform import $TF_VARS 'module.secrets.aws_secretsmanager_secret.csrf_secret' 'zinovia-fans-prod-csrf-secret'
terraform import $TF_VARS 'module.secrets.aws_secretsmanager_secret.stripe_secret_key' 'zinovia-fans-prod-stripe-secret-key'
terraform import $TF_VARS 'module.secrets.aws_secretsmanager_secret.stripe_webhook_secret' 'zinovia-fans-prod-stripe-webhook-secret'

# ALB (if not in state)
terraform import $TF_VARS 'aws_lb.main[0]' 'arn:aws:elasticloadbalancing:us-east-1:ACCOUNT:loadbalancer/app/zinovia-fans-prod-alb/ID'

# Redis (if not in state)
terraform import $TF_VARS 'aws_elasticache_replication_group.redis' 'zinovia-fans-prod-redis'
```

Replace ACCOUNT and ID in the ALB ARN; get with: `aws elbv2 describe-load-balancers --names zinovia-fans-prod-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text`

## Step 1: HTTP-Forwarding Mode (Emergency)

Use when ACM cert is `PENDING_VALIDATION` or ECS services fail with "target group does not have an associated load balancer".

```bash
cd infra/aws/terraform

# Ensure prod.tfvars has:
#   force_http_forwarding = true
#   enable_cloudfront = false
#   wait_for_certificate_validation = false

terraform init -backend=false
terraform plan -var-file=env/prod.tfvars -var="enable_cloudfront=false" -lock=false -out=prod.plan
terraform apply -var-file=env/prod.tfvars -var="enable_cloudfront=false" -lock=false -auto-approve
```

**If apply fails with ResourceExistsException**, run the import commands above, then re-apply.

**Import existing secrets** (legacy - use Pre-Apply section):

```bash
terraform import -var-file=env/prod.tfvars -lock=false \
  'aws_secretsmanager_secret.database_url' 'zinovia-fans-prod-database-url'

terraform import -var-file=env/prod.tfvars -lock=false \
  'module.secrets.aws_secretsmanager_secret.db_password' 'zinovia-fans-prod-db-password'

terraform import -var-file=env/prod.tfvars -lock=false \
  'module.secrets.aws_secretsmanager_secret.jwt_secret' 'zinovia-fans-prod-jwt-secret'

terraform import -var-file=env/prod.tfvars -lock=false \
  'module.secrets.aws_secretsmanager_secret.csrf_secret' 'zinovia-fans-prod-csrf-secret'

terraform import -var-file=env/prod.tfvars -lock=false \
  'module.secrets.aws_secretsmanager_secret.stripe_secret_key' 'zinovia-fans-prod-stripe-secret-key'

terraform import -var-file=env/prod.tfvars -lock=false \
  'module.secrets.aws_secretsmanager_secret.stripe_webhook_secret' 'zinovia-fans-prod-stripe-webhook-secret'
```

**Safety checks after Step 1:**

```bash
# Target groups attached to ALB
aws elbv2 describe-target-groups --names zinovia-fans-prod-api zinovia-fans-prod-web --region us-east-1 \
  --query 'TargetGroups[*].{Name:TargetGroupName,LoadBalancerArns:LoadBalancerArns}' --output table

# ECS services running
aws ecs list-services --cluster zinovia-fans-prod-cluster --region us-east-1
aws ecs describe-services --cluster zinovia-fans-prod-cluster --services zinovia-fans-prod-api zinovia-fans-prod-web zinovia-fans-prod-worker --region us-east-1 \
  --query 'services[*].{Name:serviceName,Desired:desiredCount,Running:runningCount}' --output table

# Listener rules route correctly (port 80 when force_http_forwarding)
aws elbv2 describe-listeners --load-balancer-arn $(aws elbv2 describe-load-balancers --names zinovia-fans-prod-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text --region us-east-1) --region us-east-1 --query 'Listeners[*].{Port:Port,DefaultTargetGroup:DefaultActions[0].TargetGroupArn}' --output table
```

**Run migrations:**

```bash
TASK_DEF=$(terraform output -raw migrate_task_definition)
CLUSTER=$(terraform output -raw ecs_cluster_name)
SUBNETS=$(terraform output -json private_subnet_ids | jq -c '.')
SG=$(terraform output -raw ecs_security_group_id)

aws ecs run-task --cluster $CLUSTER --task-definition $TASK_DEF --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=$SUBNETS,securityGroups=[$SG],assignPublicIp=DISABLED}" \
  --region us-east-1
```

## Step 2: Validate ACM and Create HTTPS Listener

1. Ensure `zinovia.ai` is delegated to Route53 (or add ACM validation CNAMEs manually).
2. Set `wait_for_certificate_validation = true` in prod.tfvars.
3. Set `force_http_forwarding = false` in prod.tfvars.
4. Apply:

```bash
terraform apply -var-file=env/prod.tfvars -var="enable_cloudfront=false" -lock=false -auto-approve
```

This creates the HTTPS listener (only after ACM cert is ISSUED) and switches HTTP to redirect.

## Step 3: Revert HTTP to Redirect (Post-HTTPS)

After Step 2, HTTP already redirects to HTTPS. No further action if `force_http_forwarding = false`.

## Rollback

- **Revert to HTTP forwarding:** Set `force_http_forwarding = true`, apply.
- **Rollback task definitions:** Revert to previous ECS task definition revision via console or `aws ecs update-service ... --task-definition zinovia-fans-prod-api:PREV_REV`.

## Commands Reference

| Command | Purpose |
|---------|---------|
| `make aws-prod-apply` | Full prod apply (uses prod.tfvars) |
| `terraform output` | List outputs (api_url, web_url, etc.) |
| `ENV=prod ./scripts/deploy/aws/build_and_push.sh` | Build and push images to ECR |
| `aws ecs update-service --cluster zinovia-fans-prod-cluster --service zinovia-fans-prod-api --force-new-deployment` | Force ECS redeploy |
