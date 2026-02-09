# AWS Staging Deployment Runbook (zinovia-fans)

End-to-end staging deploy in **us-east-1** using a **dedicated new VPC** (not default). With custom domain: **stg-app**, **stg-api**, **stg-media**.zinovia.ai. Without custom domain: CloudFront and API Gateway **default URLs** (no DNS/ACM).

---

## Region: us-east-1 only

All staging resources (VPC, ECS, RDS, S3, ECR, **Secrets Manager**, SQS, etc.) are created in **us-east-1**. The default Terraform provider uses `aws_region` and `env/staging.tfvars` sets `aws_region = "us-east-1"`; a variable validation enforces this for staging. Deploy scripts (`get_api_url.sh`, `restore_secrets_if_scheduled.sh`, `build_and_push.sh`) use `us-east-1` explicitly. If Secrets Manager shows no secrets, run `terraform apply` and Terraform will create them in us-east-1.

---

## Terraform layout (infra/aws/terraform)

| Item | Description |
|------|-------------|
| **Root** | `main.tf` (data, locals, resources), `outputs.tf`, `variables.tf`, `providers.tf`, `versions.tf` |
| **Providers** | `aws` (default, var.aws_region), `aws.us_east_1` (us-east-1 for CloudFront/ACM) |
| **Modules** | `network` (VPC, subnets, NAT, ALB/ECS/RDS SGs), `rds`, `secrets`, `ecr`, `s3_media`, `sqs_media`, `acm` (cert + optional Route53 validation), `cloudfront_media` |
| **When enable_alb=true** | `aws_lb.main`, `aws_lb_target_group.api`/`.web`, `aws_lb_listener.https`/`.http`, listener rules (api/web by host), ECS services `api`/`web` with ALB attachment, private subnets, ALB in public subnets |
| **When enable_alb=false** | `api_no_alb` ECS (public IP), optional CloudFront web + S3, no ALB |
| **ACM** | `acm_alb` (regional), `acm_cloudfront` / `acm_cloudfront_web` (us-east-1); validation records only when `dns_delegated=true` |
| **Route53** | A/alias for api, app, media only when `dns_delegated=true` (and enable_route53, etc.) |

---

## Destroy full stack

To tear down all staging resources and prepare for a clean deploy:

```bash
cd infra/aws/terraform
terraform destroy -var-file=env/staging.tfvars -auto-approve
```

- **Allow 20–40 minutes.** RDS, NAT gateway, and ECS services go first. The `lambda_proxy` security group can be blocked by **Lambda-owned ENIs** (left behind after Lambda was destroyed); AWS may take 20–40 minutes to release them. Subnets and VPC are destroyed after the SG.
- If the command is interrupted or times out, run it again (`make aws-stg-destroy` or the command above); Terraform will continue with remaining resources.
- To run destroy in the background and check later: `make aws-stg-destroy > /tmp/aws-stg-destroy.log 2>&1 &` then `tail -f /tmp/aws-stg-destroy.log`.
- When destroy completes, state will be empty (or only a `data` source). You can then deploy from scratch below.

---

## Deploy whole project from scratch (checklist)

Use this order when the stack is destroyed or you are deploying for the first time.

| Step | Action |
|------|--------|
| 1 | **Terraform init** — `cd infra/aws/terraform && terraform init -backend=false` |
| 2 | **Plan** — `terraform plan -var-file=env/staging.tfvars -out=staging.plan` |
| 3 | **Apply** — `terraform apply staging.plan` (allow ~10–15 min for RDS, ECS, etc.) |
| 4 | **Set secrets** — JWT, CSRF (and optionally Stripe) in Secrets Manager (see §2 below) |
| 5 | **Build and push images** — From repo root: `./scripts/deploy/aws/build_and_push.sh` |
| 6 | **Run DB migrations** — One-off ECS task (see §4 below) |
| 7 | **Force ECS deploy** — `aws ecs update-service --cluster zinovia-fans-staging-cluster --service zinovia-fans-staging-api --force-new-deployment` (and web/worker if deployed) |
| 8 | **Get API URL** — `./scripts/deploy/aws/get_api_url.sh` (no-ALB staging) |
| 9 | **Verify** — `curl -s "$(./scripts/deploy/aws/get_api_url.sh)/health"` → `{"status":"ok"}`; build web with `API_BASE_URL=$(./scripts/deploy/aws/get_api_url.sh) ./scripts/deploy/aws/build_and_push.sh` if the app should call the API |

---

## ALB + custom domain (dns_delegated)

When **enable_alb = true** and **enable_acm = true**, the stack creates ALB, HTTPS listener, target groups, and ECS services (api, web) behind the ALB. Use **dns_delegated** to control DNS:

- **dns_delegated = false** (default): Terraform does **not** create Route53 A/alias or ACM validation records. Apply completes without waiting for DNS. Outputs:
  - `route53_nameservers` — delegate **zinovia.ai** to these at your registrar.
  - `acm_validation_records_alb` / `acm_validation_records_cloudfront` — create these CNAME records (at registrar or current DNS) so ACM certs can validate.
- **dns_delegated = true**: Terraform creates ACM validation records and A/alias records (stg-api, stg-app, stg-media). Set this **after** you have delegated zinovia.ai to the Route53 name servers and (optionally) created the ACM CNAMEs so certs validate.

**Steps when DNS is not yet delegated:**

1. Ensure a **Route53 hosted zone for zinovia.ai** exists (create in console or `aws route53 create-hosted-zone --name zinovia.ai --caller-reference $(date +%s)`).
2. Apply with **dns_delegated = false**:
   ```bash
   cd infra/aws/terraform
   terraform apply -var-file=env/staging.tfvars -auto-approve
   ```
3. Get outputs and complete DNS:
   ```bash
   terraform output route53_nameservers    # Delegate zinovia.ai to these at registrar
   terraform output acm_validation_records_alb
   terraform output acm_validation_records_cloudfront
   ```
   Create the CNAME records from the validation outputs at your current DNS (or at the registrar). Wait for ACM certs to show **Issued** in the console.
4. Delegate **zinovia.ai** to the Route53 name servers at your registrar.
5. Set **dns_delegated = true** in `env/staging.tfvars` and re-apply to create A records (stg-api, stg-app, stg-media):
   ```bash
   terraform apply -var-file=env/staging.tfvars -auto-approve
   ```

**If ALB creation fails with OperationNotPermitted:**

If you see:
```text
OperationNotPermitted: This AWS account currently does not support creating load balancers.
```

1. **AWS Console** → Support → Create case, or contact AWS Support; request enabling **Application Load Balancers** (and NLB if needed) for the account.
2. **Billing** — Ensure the account has a valid payment method and is in good standing.
3. **Service quotas** — In **Service Quotas** (us-east-1), check **Elastic Load Balancing** → "Application Load Balancers per Region" is not 0.
4. **New accounts** — Some new accounts have ELB disabled until reviewed; support can enable it.
5. After AWS enables ELB, re-run: `terraform apply -var-file=env/staging.tfvars -auto-approve`.

**If Secrets Manager reports "already scheduled for deletion":**  
Secrets from a previous destroy can be in a 7–30 day deletion window. Either wait for deletion to complete, or in AWS Console → Secrets Manager → recover the secret (cancel deletion), then re-apply.

**Verification checklist (after apply):**

```bash
# ALB exists and is active
aws elbv2 describe-load-balancers --region us-east-1 --query "LoadBalancers[?contains(LoadBalancerName,'zinovia-fans-staging')].[LoadBalancerArn,DNSName,State.Code]" --output table

# Target group ARN (replace with your ALB region/account)
TG_ARN=$(aws elbv2 describe-target-groups --region us-east-1 --names zinovia-fans-staging-api --query 'TargetGroups[0].TargetGroupArn' --output text)
aws elbv2 describe-target-health --target-group-arn "$TG_ARN" --region us-east-1

# ECS services stable
aws ecs describe-services --cluster zinovia-fans-staging-cluster --services zinovia-fans-staging-api zinovia-fans-staging-web --region us-east-1 --query 'services[*].[serviceName,runningCount,desiredCount]' --output table

# API via ALB DNS (use ALB DNS name from first command; HTTPS once cert is issued)
ALB_DNS=$(aws elbv2 describe-load-balancers --region us-east-1 --names zinovia-fans-staging-alb --query 'LoadBalancers[0].DNSName' --output text)
curl -i -k "https://$ALB_DNS/health" -H "Host: stg-api.zinovia.ai"

# CloudFront distributions
aws cloudfront list-distributions --query "DistributionList.Items[*].[Id,DomainName,Status]" --output table
```

---

## No DNS yet (recommended first deploy)

When **zinovia.ai is not yet delegated to AWS**, use staging with **default URLs** so Terraform does not create ACM or Route53 and apply completes without hanging:

1. In `env/staging.tfvars` set:
   ```hcl
   enable_custom_domain = false
   enable_acm          = false
   enable_route53      = false
   enable_alb          = false
   enable_cloudfront   = false   # set true once AWS account is verified for CloudFront
   ```
2. From repo root:
   ```bash
   cd infra/aws/terraform
   terraform init -backend=false
   terraform plan -var-file=env/staging.tfvars -out=staging.plan
   terraform apply staging.plan
   ```
3. After apply, get temporary endpoints:
   ```bash
   terraform output web_url   # CloudFront web default URL (e.g. https://xxx.cloudfront.net)
   terraform output api_url   # Placeholder when no ALB; use get_api_url.sh (step 4) for actual URL
   ```
4. **Get temporary API URL** (public ECS task IP; changes when task is replaced):
   ```bash
   ./scripts/deploy/aws/get_api_url.sh
   # Prints e.g. http://3.80.123.45:8000
   ```
5. **Hit API health** (use the URL from step 4):
   ```bash
   curl -s "http://$(./scripts/deploy/aws/get_api_url.sh | sed 's|http://||;s|:8000||'):8000/health"
   # Or: API_URL=$(./scripts/deploy/aws/get_api_url.sh) && curl -s "$API_URL/health"
   # Expect: {"status":"ok"} or 200 OK once ECS API is running
   ```
6. **Open web app**: open `terraform output web_url` in a browser. To have the web app call the API, build with the temporary API URL: `API_BASE_URL=$(./scripts/deploy/aws/get_api_url.sh) ./scripts/deploy/aws/build_and_push.sh` (see `terraform output api_url_cli`).

**Warning:** Public ECS API (port 8000 from 0.0.0.0/0) is temporary and not for production. Use until DNS + TLS + proper ingress (e.g. ALB or API Gateway) is available.

Later, when zinovia.ai is delegated to Route53, set `enable_custom_domain = true`, `enable_acm = true`, `enable_route53 = true` and apply again to add custom domains and DNS.

---

## Prerequisites

- **AWS CLI** configured (e.g. `aws sts get-caller-identity` succeeds).
- **Terraform** >= 1.6 (or use repo `.tools/terraform`).
- **Docker** (build and push images).
- **Route53 hosted zone** for `zinovia.ai` (create in console or `aws route53 create-hosted-zone`).
- **Account**: Account must be allowed to create **Application Load Balancers**. If you see:
  ```text
  This AWS account currently does not support creating load balancers. For more information, please contact AWS Support.
  ```
  contact AWS Support to enable ELB for the account, then run `terraform apply -var-file=env/staging.tfvars` again from `infra/aws/terraform`.
- **CloudFront**: If you see `AccessDenied: Your account must be verified before you can add new CloudFront resources`, set `enable_cloudfront = false` in `env/staging.tfvars` so apply can complete without CloudFront. Re-enable after account verification.

**If a previous apply left `aws_security_group.lambda_proxy[0]` in state:** Destroying it can take 10+ minutes (ENI dependency). Re-run `terraform apply -var-file=env/staging.tfvars -auto-approve` and wait, or in EC2 → Security Groups find any ENIs attached to the lambda-proxy SG and delete them, then re-run apply.

---

## 1. Terraform init and apply (staging)

From **repo root**:

```bash
# Optional: use Terraform from repo
export PATH="$(pwd)/.tools:$PATH"

cd infra/aws/terraform
terraform init -backend=false
terraform plan -var-file=env/staging.tfvars -out=staging.plan
terraform apply staging.plan
```

Or with Make:

```bash
make aws-stg-plan
# Review staging.plan, then:
cd infra/aws/terraform && terraform apply staging.plan
# Or: make aws-stg-apply  (uses -auto-approve, no plan file)
```

**Note:** ACM certificate validation can take 5–30 minutes. Terraform will wait. Ensure DNS for zinovia.ai points to Route53 so validation records resolve.

---

## 2. Set secrets (Secrets Manager)

Terraform creates secrets with placeholders. Set real values (do not commit):

```bash
# Required
aws secretsmanager put-secret-value --secret-id zinovia-fans-staging-jwt-secret --secret-string "your-32-char-jwt-secret"
aws secretsmanager put-secret-value --secret-id zinovia-fans-staging-csrf-secret --secret-string "your-csrf-secret"

# Optional (Stripe)
aws secretsmanager put-secret-value --secret-id zinovia-fans-staging-stripe-secret-key --secret-string "sk_..."
aws secretsmanager put-secret-value --secret-id zinovia-fans-staging-stripe-webhook-secret --secret-string "whsec_..."
```

DB password is generated by Terraform and stored in the `database-url` secret; no need to set manually unless you rotate.

---

## 3. Build and push images (ECR)

From **repo root**:

```bash
./scripts/deploy/aws/build_and_push.sh
```

Uses Terraform outputs for ECR URLs, builds API/Web/Worker from `infra/docker/*/Dockerfile`, tags with git SHA and `staging-latest`, pushes. For prod:

```bash
ENV=prod ./scripts/deploy/aws/build_and_push.sh
```

---

## 4. Run DB migrations (one-off ECS task)

Terraform defines task definition `zinovia-fans-staging-migrate` (alembic upgrade head). From repo root:

```bash
cd infra/aws/terraform
CLUSTER=$(terraform output -raw ecs_cluster_name)
TASK_DEF=$(terraform output -raw migrate_task_definition)
SUBNET_IDS=$(terraform output -json private_subnet_ids | jq -r 'join(",")')
SG_ID=$(terraform output -raw ecs_security_group_id)

aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$TASK_DEF" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SG_ID],assignPublicIp=DISABLED}" \
  --region us-east-1
```

Check completion:

```bash
aws ecs list-tasks --cluster "$CLUSTER" --family "$TASK_DEF" --region us-east-1 --desired-status STOPPED
# Inspect task: exitCode 0 = success
```

---

## 5. Force ECS deployment (pull new images)

After pushing images:

```bash
aws ecs update-service --cluster zinovia-fans-staging-cluster --service zinovia-fans-staging-api --force-new-deployment
aws ecs update-service --cluster zinovia-fans-staging-cluster --service zinovia-fans-staging-web --force-new-deployment
aws ecs update-service --cluster zinovia-fans-staging-cluster --service zinovia-fans-staging-worker --force-new-deployment
```

---

## 6. Verification checklist

When **no ALB** (staging default): get API base URL with `./scripts/deploy/aws/get_api_url.sh` and use it below.

- **API health**
  ```bash
  # With ALB/custom domain:
  curl -s https://stg-api.zinovia.ai/health
  # No ALB: API_URL=$(./scripts/deploy/aws/get_api_url.sh) && curl -s "$API_URL/health"
  # Expect: {"status":"ok"}
  ```
- **API ready**
  ```bash
  curl -s "$API_URL/ready"   # or https://stg-api.zinovia.ai/ready with custom domain
  ```
- **API creators (smoke)**
  ```bash
  curl -s "$API_URL/creators?page=1&page_size=1"
  # Expect 200 (empty list or data, or login required)
  ```
- **Web app**
  ```bash
  curl -I https://stg-app.zinovia.ai
  # Or: curl -I $(terraform output -raw web_url)
  # Expect 200 or 302
  ```
- **Media CDN**
  - https://stg-media.zinovia.ai should resolve (CloudFront). Empty bucket is OK.

---

## 7. Rollback

- **ECS:** Update service to previous task definition revision, or redeploy previous image tag and force new deployment.
- **Terraform:** Revert changes and `terraform apply` (avoid destructive RDS changes).
- **Migrations:** Alembic does not auto-downgrade; run manual downgrade if required and document the revision.

---

## 8. Logs (CloudWatch)

- API: `/ecs/zinovia-fans-staging-api`
- Web: `/ecs/zinovia-fans-staging-web`
- Worker: `/ecs/zinovia-fans-staging-worker`

```bash
aws logs tail /ecs/zinovia-fans-staging-api --follow
```

---

## 9. Key outputs (staging)

From repo root: `make aws-stg-outputs` or `cd infra/aws/terraform && terraform output`.

| Output | Example |
|--------|--------|
| `api_url` | With ALB: https://stg-api.zinovia.ai. No ALB: placeholder; use `api_url_cli` / get_api_url.sh |
| `api_url_cli` | Command to get temporary API URL and build web (no-ALB only) |
| `app_url` | https://stg-app.zinovia.ai |
| `cdn_base_url` / `media_cdn_url` | https://stg-media.zinovia.ai |
| `vpc_id` | Dedicated VPC (not default) |
| `rds_endpoint` | RDS host:port |
| `ecr_api_url` / `ecr_web_url` / `ecr_worker_url` | ECR repository URLs |
| `migrate_task_definition` | zinovia-fans-staging-migrate |

---

## Next steps: Playwright E2E gate for staging

To add an E2E gate after staging deploy:

1. Add a GitHub Actions (or CI) job that runs after `build_and_push` + ECS deploy.
2. Job runs Playwright against `https://stg-app.zinovia.ai` (and optionally stg-api).
3. Use existing `apps/web` Playwright config; set `BASE_URL=https://stg-app.zinovia.ai`.
4. Fail the workflow if E2E tests fail; optionally block prod deploy until staging E2E passes.
