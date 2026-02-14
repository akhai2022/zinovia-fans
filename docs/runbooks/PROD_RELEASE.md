# Production Release Runbook

**Stack:** Zinovia-Fans on AWS (ECS Fargate, ALB, RDS, S3, CloudFront, ElastiCache Redis)  
**Terraform:** `infra/aws/terraform`  
**Apps:** API (FastAPI), Web (Next.js), Worker (Celery)

---

## Prerequisites

- AWS CLI configured with sufficient permissions
- Terraform installed (or use `.tools/terraform`)
- Docker (for image builds)
- Domain `zinovia.ai` delegated to Route53 (for prod)

---

## 1. Staging Deployment

### 1.1 Terraform Apply (Staging)

```bash
cd /path/to/zinovia-fans
make aws-stg-plan   # Review plan
make aws-stg-apply  # Apply (auto-approve)
```

**Note:** Staging uses `dns_delegated=false` by default. After first apply, delegate domain to Route53 and set `dns_delegated=true` for custom domains.

### 1.2 Build and Push Images

```bash
# Get ECR URLs from Terraform output
ECR_API=$(cd infra/aws/terraform && terraform output -raw ecr_api_url 2>/dev/null)
ECR_WEB=$(cd infra/aws/terraform && terraform output -raw ecr_web_url 2>/dev/null)
ECR_WORKER=$(cd infra/aws/terraform && terraform output -raw ecr_worker_url 2>/dev/null)

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $(echo $ECR_API | cut -d'/' -f1)

# Build and push
docker build -t $ECR_API:latest -f infra/docker/api/Dockerfile .
docker push $ECR_API:latest

docker build -t $ECR_WEB:latest -f infra/docker/web/Dockerfile .
docker push $ECR_WEB:latest

docker build -t $ECR_WORKER:latest -f infra/docker/worker/Dockerfile .
docker push $ECR_WORKER:latest
```

### 1.3 Run Migrations

```bash
# Option A: ECS run-task for one-off migration
CLUSTER=$(cd infra/aws/terraform && terraform output -raw ecs_cluster_name)
SUBNETS=$(cd infra/aws/terraform && terraform output -json private_subnet_ids | jq -r 'join(",")')
SG=$(cd infra/aws/terraform && terraform output -raw ecs_task_security_group_id)
TASK_DEF=$(aws ecs describe-services --cluster $CLUSTER --services api --query 'services[0].taskDefinition' --output text)

aws ecs run-task --cluster $CLUSTER --task-definition $TASK_DEF \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"api","command":["alembic","upgrade","head"]}]}' \
  --query 'tasks[0].taskArn' --output text
```

**Option B:** Use `make migrate` against staging DB if reachable from local.

### 1.4 Force New Deployment (Rolling)

ECS services use `latest` tag; force new deployment to pick up new images:

```bash
aws ecs update-service --cluster $CLUSTER --service api --force-new-deployment
aws ecs update-service --cluster $CLUSTER --service web --force-new-deployment
aws ecs update-service --cluster $CLUSTER --service worker --force-new-deployment
```

### 1.5 Smoke Tests (Staging)

1. **Health:** `curl -s https://stg-api.zinovia.ai/health`
2. **Web:** `https://stg-app.zinovia.ai`
3. **Media presigned PUT:** Create post with image; verify presigned upload and derived variants
4. **Worker:** Check ECS task logs for worker; ensure no Redis/S3 errors
5. **CloudFront:** Media URLs resolve via `stg-media.zinovia.ai`
6. **Logs:** Check S3 logs bucket for `alb/`, `cloudfront/media/`, `s3-media/` prefixes
7. **Phase 1 engagement:** execute checks in `docs/runbooks/QA_SMOKE_TESTS.md`

---

## 2. Production Deployment

### 2.1 Pre-Flight

- [ ] `env/prod.tfvars`: `db_multi_az=true`, `nat_gateway_count=2`, `dns_delegated=true`
- [ ] Route53 zone for `zinovia.ai` delegated
- [ ] ACM certificates validated
- [ ] WAF in `block` mode (default for prod)
- [ ] Secrets (JWT, Stripe, etc.) in Secrets Manager

### 2.2 Terraform Apply (Prod)

```bash
make aws-prod-plan
make aws-prod-apply
```

### 2.3 Build and Push Images (Tag with Version)

```bash
VERSION=1.0.0
# Same as staging but use prod ECR outputs; tag with version
docker tag $ECR_API:latest $ECR_API:$VERSION
docker push $ECR_API:$VERSION
# Update task definition to use $VERSION if not using :latest
```

### 2.4 Migrations

Same as staging; use prod cluster and task definition.

### 2.5 Force New Deployment

Same as staging; use prod cluster name.

### 2.6 Smoke Tests (Prod)

Same checklist as staging; use `api.zinovia.ai`, `app.zinovia.ai`, `media.zinovia.ai`.

### 2.7 Phase 1 Feature Rollout

Deploy in this order:
1. `alembic upgrade head` (includes `0012_phase1_engagement`)
2. API and Worker deploy
3. Enable phase flags in staging:
   - `ENABLE_LIKES=true`
   - `ENABLE_COMMENTS=true`
   - `ENABLE_NOTIFICATIONS=true`
   - `ENABLE_VAULT=true`
   - `ENABLE_SCHEDULED_POSTS=true`
4. Validate `docs/runbooks/QA_SMOKE_TESTS.md`
5. Enable same flags in prod gradually

Scheduled-post requirement:
- Run one beat scheduler process: `celery -A worker.celery_app beat -l INFO`
- Keep worker process for task execution (`celery ... worker`)

---

## 3. Rollback

1. Revert Terraform state if needed: `terraform plan -var-file=env/staging.tfvars` and selectively revert.
2. ECS: Update service to previous task definition revision:
   ```bash
   aws ecs update-service --cluster $CLUSTER --service api --task-definition api:PREVIOUS_REVISION --force-new-deployment
   ```
3. Database: Run down migration if schema changed: `alembic downgrade -1`
4. Emergency disable:
   - Set phase flags to `false`
   - Force new deployment on API/Web/Worker

---

## 4. Architecture Decision: Celery + Redis vs SQS

**Decision (ADR):** Use Celery + Redis for background jobs (media variants, video poster). SQS was removed from Terraform to avoid confusion. Migration to SQS/Lambda is a future option.

**Implications:**
- ElastiCache Redis is required; ensure `REDIS_URL` is set in API and Worker task definitions.
- Celery broker and result backend both use Redis.

---

## 5. Log Locations

| Log Type       | S3 Prefix         | Retention |
|----------------|-------------------|-----------|
| ALB            | `alb/`            | 90 days   |
| CloudFront     | `cloudfront/media/` | 90 days |
| S3 media       | `s3-media/`      | 90 days   |
| ECS (API/Web/Worker) | CloudWatch `/ecs/<prefix>-api|web|worker` | 7d stg, 30d prod |

---

## 6. Common Apply Failures

| Error | Cause | Resolution |
|-------|-------|------------|
| "secret already scheduled for deletion" | Previous destroy; AWS keeps secrets 7-30 days | Run `./scripts/restore-secrets.sh staging` then re-apply |
| "Your account must be verified before you can add new CloudFront resources" | New/unverified AWS account | Run `make aws-stg-apply-no-cf` (disables CloudFront) |
| "certificate must have a fully-qualified domain name" | ACM cert pending when dns_delegated=false | **Fixed:** HTTPS listener only created when `dns_delegated=true`; HTTP forwarding used until cert validated |
| "target group does not have an associated load balancer" | ALB recreated; target groups orphaned | Re-run apply; Terraform will reconcile |
| WAF "description failed to satisfy constraint" | Invalid chars in description | **Fixed:** Descriptions use alphanumeric and spaces only |

## 7. Troubleshooting

| Symptom | Check |
|---------|-------|
| Worker won't start | `REDIS_URL` in task def; Redis SG allows ECS SG |
| Presigned PUT fails | S3 CORS includes PUT; `STORAGE=s3`, `S3_BUCKET` set |
| Image variants not created | Worker logs; `generate_derived_variants` enqueued on upload |
| 413 on image upload | `MEDIA_MAX_IMAGE_BYTES` (default 25MB) |
| WAF blocking legitimate traffic | Staging: `waf_rule_action=count`; Prod: tune rules or temporarily disable |

---

*Last updated: 2026-02-09*
