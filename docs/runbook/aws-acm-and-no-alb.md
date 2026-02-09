# ACM Validation and No-ALB Staging (zinovia.ai)

## Root cause of ACM validation hang

**Observed:** `terraform apply` hangs for a long time (e.g. ~1 hour) on:

- `module.acm_alb.aws_acm_certificate_validation.cert`
- `module.acm_cloudfront.aws_acm_certificate_validation.cert`

**Findings from AWS CLI:**

1. **Certificate ARNs (us-east-1):**
   - ALB cert: `arn:aws:acm:us-east-1:208030346312:certificate/719796a1-7352-4d2c-826e-485c6bdd5b97` (PENDING_VALIDATION)
   - CloudFront cert: `arn:aws:acm:us-east-1:208030346312:certificate/dafe8cc9-74d8-4d9b-b732-2f42e3cfab49` (PENDING_VALIDATION)

2. **DomainValidationOptions:** Both certs expose the expected CNAME names and values (e.g. `_xxx.zinovia.ai` → `_yyy.jkddzztszm.acm-validations.aws`).

3. **Route53:** The hosted zone for `zinovia.ai` (e.g. `Z0520841CMYSHSIWN9Z1`) **does** contain the corresponding CNAME records for all validation targets.

**Conclusion:** The most likely **root cause** is that **zinovia.ai is not delegated to this Route53 hosted zone**. If the domain’s NS records at the registrar do not point to the name servers of this zone, public DNS resolution for `_xxx.zinovia.ai` will not return the CNAME records. ACM’s validators perform DNS lookups from the public internet; they never see the records and validation never completes.

**What to do:**

1. In Route53, note the **name servers** of the hosted zone for `zinovia.ai`.
2. At your **domain registrar**, set the **NS** records for `zinovia.ai` to exactly those name servers.
3. After delegation propagates (minutes to hours), either:
   - Run `terraform apply` again with `wait_for_certificate_validation = true` so Terraform waits for validation, or
   - Run apply with `wait_for_certificate_validation = false` so Terraform does not block; then run apply again later once certs show **ISSUED** in the ACM console (optional second apply to create CloudFront/API Gateway that use the certs).

**Optional:** Set `wait_for_certificate_validation = false` in tfvars so the first apply does not block on validation. Certs and validation CNAME records are still created; CloudFront/API Gateway custom domains are only created when `wait_for_certificate_validation = true` (so apply can complete without valid certs).

---

## Provider warning (fixed)

**Warning:** `Reference to undefined provider for module.acm_cloudfront providers = { aws = aws.us_east_1 }`

**Fix:** In `modules/acm/` add a `terraform` block with `required_providers { aws = { source = "hashicorp/aws" } }` (see `modules/acm/versions.tf`). Passing `providers = { aws = aws.us_east_1 }` is then explicit and the warning goes away.

---

## No-ALB architecture (staging when ELB is blocked)

When the AWS account cannot create Application (or Network) Load Balancers, use this layout **without any ALB/NLB**:

- **Web (zinovia.ai / stg-app.zinovia.ai):**  
  **CloudFront** → **S3** (static site).  
  - One S3 bucket holds the static web app (e.g. Next.js export).  
  - One CloudFront distribution with OAC, aliases for apex and app subdomain, ACM cert (us-east-1).  
  - Route53: A/AAAA alias for apex and for `stg-app` (or `app`) → CloudFront.

- **API (stg-api.zinovia.ai / api.zinovia.ai):**  
  **API Gateway HTTP API** (public) → **Lambda** (proxy, in VPC) → **ECS API** (Fargate, private subnets).  
  - ECS API service is registered in **Cloud Map** (private DNS namespace).  
  - Lambda runs in the same VPC, resolves `api.<namespace>.local:8000`, and forwards HTTP requests.  
  - API Gateway custom domain uses an ACM cert (us-east-1) and Route53 A record.

- **Media (stg-media.zinovia.ai / media.zinovia.ai):**  
  **CloudFront** → **S3** (media bucket, private, OAC). Unchanged; Range supported for MP4.

- **Worker:** ECS Fargate in private subnets, consumes SQS; no public entry.

- **RDS:** Private subnets, not publicly accessible.

**In words:**  
Internet → Route53 (zinovia.ai, stg-app, stg-api, stg-media) → CloudFront (web + media) or API Gateway (api) → Lambda (api only) → ECS (API in VPC via Cloud Map). No load balancer resources.

---

## Terraform changes (summary)

| Path | Change |
|------|--------|
| `modules/acm/versions.tf` | New: `required_providers { aws }` to fix provider warning. |
| `modules/acm/variables.tf` | New: `wait_for_validation` (default true). |
| `modules/acm/main.tf` | `aws_acm_certificate_validation` created only when `wait_for_validation` is true. |
| `modules/acm/outputs.tf` | No conditional `depends_on` (static list required). |
| `variables.tf` | New: `enable_alb` (default false), `wait_for_certificate_validation` (default false). |
| `main.tf` | ALB, target groups, listeners, Route53 api/app (ALB), ECS api/web (ALB path) guarded with `enable_alb`. CloudFront media and Route53 media guarded with `wait_for_certificate_validation`. New: Cloud Map, Lambda proxy, API Gateway HTTP API, Route53 api (API Gw), S3 web, CloudFront web, Route53 app + apex (CloudFront web), ACM for API Gateway and CloudFront web when no ALB. |
| `outputs.tf` | `alb_dns_name`, `ecs_api_service_name`, `ecs_web_service_name`, `cloudfront_distribution_id` made conditional. |
| `versions.tf` | New: `archive` provider for Lambda zip. |
| `env/staging.tfvars` | `enable_alb = false`, `wait_for_certificate_validation = false`. |
| `lambda/api_proxy/main.py` | New: Lambda handler for API Gateway HTTP API → ECS proxy. |

---

## Commands to run

**From repo root (or `infra/aws/terraform`):**

```bash
# 1. Init (include archive provider)
cd infra/aws/terraform
terraform init -backend=false

# 2. Plan (staging, no ALB, cert validation non-blocking)
terraform plan -var-file=env/staging.tfvars -out=staging.plan

# 3. Apply
terraform apply staging.plan
# Or: terraform apply -var-file=env/staging.tfvars -auto-approve
```

**After delegation of zinovia.ai to Route53 (optional, to get HTTPS for web/api/media):**

1. Set in `env/staging.tfvars`: `wait_for_certificate_validation = true`.
2. Run again:
   ```bash
   terraform plan -var-file=env/staging.tfvars -out=staging.plan
   terraform apply staging.plan
   ```
   This will create CloudFront (media + web), API Gateway custom domain, and Route53 records that depend on valid certs. Apply may take a few minutes while ACM validates.

---

## Verification checklist (after apply)

Run from a shell (replace zone/IDs if different):

```bash
# 1. ACM certs (us-east-1) — expect ISSUED after delegation + optional second apply
aws acm list-certificates --region us-east-1 --query 'CertificateSummaryList[*].[DomainName,Status]' --output table

# 2. CloudFront distributions — expect Deployed when wait_for_certificate_validation was true
aws cloudfront list-distributions --query 'DistributionList.Items[*].[Id,DomainName,Status]' --output table

# 3. Web (if certs validated)
curl -I https://zinovia.ai
# Expect 200 or 301/302

# 4. API (if certs validated) — via API Gateway
curl -I https://stg-api.zinovia.ai/health
# Expect 200 (or 502 until ECS API is running and Lambda can reach it)
```

If `wait_for_certificate_validation` was left `false`, CloudFront and API Gateway custom domains (and their Route53 records) are not created; only certs and validation CNAMEs exist. Set `wait_for_certificate_validation = true` and apply again after the domain is delegated and certs show ISSUED.
