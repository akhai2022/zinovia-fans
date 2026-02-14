# AWS Terraform Stack Review

Full review of the staging/production AWS infrastructure (Terraform in `infra/aws/terraform/`).

---

## 1. Root layout

| File / Dir | Purpose |
|------------|--------|
| `main.tf` | Root module: locals, data sources, module calls (network, rds, secrets, ecr, s3_media, sqs_media, acm, cloudfront_media, ECS api/web/worker, ALB, no-ALB api). |
| `variables.tf` | Inputs: region, env, VPC/ALB/ACM/Route53/CloudFront toggles, domain names, RDS/ECS sizing, feature flags. |
| `outputs.tf` | Exposed values: api_url, alb_dns_name, ECR URIs, RDS endpoint, secrets ARNs, ACM validation, runbook refs. |
| `providers.tf` | Default `aws` (var.aws_region), alias `aws.us_east_1` (us-east-1) for CloudFront/ACM. |
| `versions.tf` | Terraform and provider version constraints (no `archive`). |
| `env/staging.tfvars` | Staging overrides: us-east-1, enable_alb=true, enable_acm/route53/cloudfront=false. |
| `modules/` | Reusable network, rds, secrets, ecr, s3_media, sqs_media, acm, cloudfront_media. |

---

## 2. Providers and region

- **Default provider** `aws`: region = `var.aws_region` (staging: `us-east-1`).
- **Alias** `aws.us_east_1`: fixed `us-east-1` for CloudFront and ACM (required by AWS).
- Staging validation in `variables.tf` forces `aws_region = "us-east-1"` for env = staging.

---

## 3. Network (modules/network)

- **VPC**: one per env; public/private subnets; NAT gateway in public subnet for private ECS/RDS outbound.
- **Security groups**:
  - `alb`: 80/443 from 0.0.0.0/0 (when ALB created).
  - `api`, `web`: from ALB SG when ALB; `api_public` for no-ALB API (8000 from 0.0.0.0/0, staging-only).
  - `rds`: from api SG (and worker when present).
- **Outputs**: vpc_id, subnets, ALB/api/web/rds SG IDs for use by ECS and RDS.

---

## 4. Data sources

- **Caller identity / region**: used for ARNs and ECR URLs.
- **Availability zones**: used for subnet placement.

---

## 5. RDS (modules/rds)

- **PostgreSQL**: single instance (no Multi-AZ in config); in private subnet; security group from network module.
- **Credentials**: from `modules/secrets` (random password stored in Secrets Manager); DB name and user from vars.
- **Subnet group**: private subnets.

---

## 6. Secrets (modules/secrets)

- **Secrets Manager** in **us-east-1** (provider passed from root).
- Creates secrets if not present; no Lambda; scripts (`restore_secrets_if_scheduled.sh`) and runbook document recovery if secrets were previously scheduled for deletion.
- Used by: RDS (password), ECS (DB URL, JWT, CSRF, optional Stripe).

---

## 7. ECR (modules/ecr)

- **Always created** for env: `api`, `web`, `worker` repos.
- Lifecycle policy: keep last N images.
- Outputs: repository URLs for build-and-push and ECS task definitions.

---

## 8. S3 and SQS (modules/s3_media, modules/sqs_media)

- **S3**: media bucket; versioning/cors as needed by app.
- **SQS**: media queue for async processing (worker consumes).

---

## 9. ACM (modules/acm)

- **Only when** `enable_acm = true` (staging: false).
- Certificate in **us-east-1** (required for CloudFront if used).
- `create_validation_records`: Terraform creates Route53 validation records when `dns_delegated = true`; otherwise manual validation.
- Uses `configuration_aliases = [aws]`; root passes `aws.us_east_1` so ACM is in us-east-1.

---

## 10. CloudFront (modules/cloudfront_media, root cloudfront_media)

- **cloudfront_media**: optional; origin = S3 media bucket; used for media CDN (custom domain when `enable_custom_domain`).
- **Web CloudFront**: only in no-ALB path when `enable_cloudfront = true` (S3 web hosting). Staging has this disabled (account verification / 403 issues).

---

## 11. ALB path (enable_alb = true)

- **ALB**: in public subnets; SG allows 80/443 from internet.
- **Target groups**:
  - API: port 8000, health check `/health`.
  - Web: port 3000, health check `/`.
- **Listeners**:
  - When `enable_acm`: HTTPS (443) with host-based routing (api_domain → API, app_domain → web); HTTP (80) redirects to HTTPS.
  - When `!enable_acm`: HTTP (80) with **path-based routing** — API paths (`/health`, `/auth*`, `/creators*`, `/posts*`, `/feed*`, `/media*`, `/billing*`, `/ledger*`) → API target group; default action → web target group. So both API and web are reachable at `http://<alb-dns-name>` (API on those paths, web at `/`).
- **ECS services**: `api` and `web` (Fargate, private subnets); depend on ALB; registered to corresponding target groups; IAM role for Secrets, ECR, SQS, S3.
- **Outputs**: `api_url` = `http(s)://<alb-dns or api-domain>`; `web_url` = `http(s)://<alb-dns or app-domain>` when ALB enabled (no longer null when no custom domain).
- **Web task env**: `NEXT_PUBLIC_API_BASE_URL` is set to ALB DNS when no custom domain so the web app can call the API on the same origin.

---

## 12. No-ALB path (enable_alb = false)

- **ECS service** `api_no_alb`: `assign_public_ip = true`; SG `api_public` (8000 from 0.0.0.0/0).
- **api_url**: placeholder `http://<task-public-ip>:8000`; `api_url_cli` points to `get_api_url.sh` + `build_and_push.sh` to resolve task IP and set `NEXT_PUBLIC_API_BASE_URL`.
- Optional S3 + CloudFront for web when `enable_cloudfront = true`.

---

## 13. Worker

- **Always present**: Fargate task; no ALB; IAM for SQS, S3, Secrets, RDS; runs in private subnet.

---

## 14. Route53 and custom domain

- **Only when** `dns_delegated = true`: ACM validation records and (if `enable_route53`) A records for api/app/media.
- Staging: `dns_delegated = false`; no Route53 records created.

---

## 15. Staging summary (env/staging.tfvars)

- **Region**: us-east-1 (enforced by validation).
- **ALB**: enabled (HTTP on 80; no ACM). Path-based routing: API on `/health`, `/auth*`, `/creators*`, etc.; web app at `/`.
- **ACM / Route53 / CloudFront**: disabled.
- **api_url** / **web_url**: both `http://<alb-dns-name>` after apply (same ALB; API and web on different paths).
- **Secrets**: created in us-east-1 by Terraform if missing.
- **ECR**: api, web, worker repos always created.

---

## 16. Post-apply checklist (high level)

1. **Secrets**: Set real values in Secrets Manager (JWT, CSRF, optional Stripe); ensure DB secret matches RDS.
2. **Images**: Build and push api/web/worker to ECR; use `api_url` (ALB DNS or script for no-ALB) for web `NEXT_PUBLIC_API_BASE_URL`.
3. **DB**: Run migrations against RDS endpoint (from output).
4. **ECS**: Force new deployment so tasks pull new images and env (e.g. from Secrets).

---

## 17. Known limitations and operational notes

- **ALB creation**: If the account cannot create load balancers (e.g. OperationNotPermitted), apply fails until AWS enables it (billing/quotas/support). Runbook has “If ALB creation fails” steps.
- **Secrets “scheduled for deletion”**: Restore via console or `restore_secrets_if_scheduled.sh` before re-apply; runbook documented.
- **CloudFront 403**: With unverified account, keep `enable_cloudfront = false` in staging.
- **Legacy**: Lambda/API Gateway and `lambda_proxy` SG were removed; any leftover state may still show in `terraform state list` and can be cleaned manually if needed.

---

## 18. File / resource summary

| Resource type | Controlled by | Notes |
|---------------|---------------|--------|
| VPC, subnets, NAT, SGs | network module | Always. |
| RDS | rds module | Always. |
| Secrets Manager | secrets module | us-east-1. |
| ECR api/web/worker | ecr module | Always. |
| S3 media, SQS | s3_media, sqs_media | Always. |
| ACM | enable_acm | us-east-1. |
| CloudFront (media) | enable_custom_domain / cloudfront | Optional. |
| CloudFront (web) | enable_cloudfront, no-ALB path | Optional. |
| ALB, target groups, listener | enable_alb | HTTP when !enable_acm. |
| ECS api, web | enable_alb | Fargate, private subnets. |
| ECS api_no_alb | !enable_alb | Public IP, api_public SG. |
| ECS worker | — | Always. |
| Route53 | dns_delegated, enable_route53 | Optional. |

This document reflects the stack as of the last review; for step-by-step procedures use `docs/runbook/aws-staging.md`.
