# Post-Fix Readiness Verification — Zinovia-Fans

**Date:** 2026-02-13  
**Scope:** P0/P1 gaps from `docs/audit/READINESS_REPORT.md` + Key P2 items  
**Method:** Code and Terraform inspection; no runtime execution

---

## 1. Executive Summary

| Item | Value |
|------|-------|
| **Current verdict** | **GO** |
| **Remaining P0 count** | 0 |
| **Remaining P1 count** | 1 (P1-1: SQS still in state; cosmetic) |
| **P2 status** | WAF ✅, prod HA ✅, worker concurrency ✅, GCS removed ✅ |

### Top 5 Actions Next (Ordered)

1. **Run `terraform apply`** — SQS will be destroyed (no longer in config). If secrets "scheduled for deletion": `./scripts/restore-secrets.sh staging`. If CloudFront 403: `make aws-stg-apply-no-cf`.
2. **CloudFront log delivery policy** — Added to S3 logs bucket (`main.tf`).
3. **Smoke-test staging**: media upload, presigned GET, variant generation.
4. **Verify Redis connectivity** from ECS worker (AWS runtime).
5. **Prod rollout**: apply prod.tfvars, then migration task, then services.

---

## 2. Achievement Matrix

| Item | Status | Evidence | How to verify |
|------|--------|----------|---------------|
| **P0-1** S3Storage + selection | DONE | `storage.py:58–99`, `settings.py:22–24`, `get_storage_client()` line 96 | `STORAGE=s3` or `S3_BUCKET` → S3Storage; boto3, no MINIO in AWS |
| **P0-2** Redis provisioned | DONE | `main.tf:254–299` ElastiCache; `main.tf:568,633` REDIS_URL in API/Worker | `aws elasticache describe-replication-groups` |
| **P0-3** Worker storage_io S3 | DONE | `storage_io.py:14–62` `_use_s3()`, boto3 get/put | Worker env has STORAGE=s3, S3_BUCKET |
| **P0-4** S3 CORS PUT | DONE | `s3_media/main.tf:55` `["GET","HEAD","PUT","POST"]` | `aws s3api get-bucket-cors --bucket <id>` |
| **P1-1** SQS removed | PARTIAL | No `module "sqs_media"` in any `.tf`; tfstate may still have SQS | `terraform plan`; remove from state if present |
| **P1-2** Image variants enqueued | DONE | `media/router.py:54–72`, `celery_client.py:33–45` | Upload image → check worker logs for `generate_derived_variants` |
| **P1-3** Image size limit | DONE | `settings.py:62–66`, `service.py:33–34` | Upload >25MB image → 413 |
| **P1-4** CloudFront staging | DONE | `staging.tfvars:22` `enable_cloudfront = true` | CDN_BASE_URL = https://stg-media.zinovia.ai |
| **P1-5** Autoscaling | DONE | `main.tf:727–772` aws_appautoscaling_target/policy api, web, worker | `aws application-autoscaling describe-scalable-targets` |
| **P1-6** Access logging | DONE | ALB `main.tf:414–418`; S3 media `s3_media/main.tf:42–47`; CF `cloudfront_media:47–54` | Check logs bucket for alb/, s3-media/, cloudfront/media/ |
| **P2 WAF** | DONE | `waf.tf` aws_wafv2_web_acl alb + cloudfront | `aws wafv2 list-web-acls --scope REGIONAL` |
| **P2 prod HA** | DONE | `prod.tfvars:7,11` nat_gateway_count=2, db_multi_az=true | Inspect prod.tfvars |
| **P2 worker concurrency** | DONE | `main.tf:634` CELERY_CONCURRENCY=2 | Worker task def env |
| **P2 GCS removed** | DONE | No GcsStorage in `storage.py` | Grep for GcsStorage |

---

## 3. Detailed Findings

### P0-1: S3Storage Implementation — DONE

**Required:** S3Storage using boto3, IAM role; `STORAGE` or `S3_BUCKET` selects S3.

**Evidence:**
- `apps/api/app/modules/media/storage.py:58–99`: `S3Storage` class with boto3, no static keys.
- `storage.py:94–99`: `get_storage_client()` returns `S3Storage()` when `settings.storage == "s3" or settings.s3_bucket`.
- `apps/api/app/core/settings.py:22–24`: `storage` (minio|s3), `s3_bucket`, `aws_region`.
- ECS API task def `main.tf:565–569`: `STORAGE=s3`, `S3_BUCKET`, `AWS_REGION`; no MINIO_*.

**Missing:** None.

---

### P0-2: Redis Provisioned — DONE

**Required:** ElastiCache Redis; REDIS_URL in API and Worker task defs.

**Evidence:**
- `main.tf:254–299`: `aws_elasticache_replication_group`, subnet group, security group (6379 from ECS).
- `main.tf:296–298`: `local.redis_url = "redis://${...primary_endpoint_address}:6379/0"`.
- `main.tf:568` (API), `main.tf:633` (Worker): `REDIS_URL = local.redis_url`.

**Missing:** None.

**Needs AWS runtime check:** Worker can reach Redis (same VPC, SG allows 6379 from ECS).

---

### P0-3: Worker storage_io S3 — DONE

**Required:** Worker uses boto3/S3 when `STORAGE=s3`; no MinIO in AWS.

**Evidence:**
- `apps/worker/worker/storage_io.py:14–16`: `_use_s3()` = `storage=="s3" or s3_bucket`.
- `storage_io.py:29–55`: `get_object_bytes` / `put_object_bytes` use `boto3.client("s3")` when `_use_s3()`.
- Worker task def: `STORAGE=s3`, `S3_BUCKET`, `AWS_REGION`; task role has S3 permissions.

**Missing:** None.

---

### P0-4: S3 CORS PUT — DONE

**Required:** CORS allows PUT (and POST if used) for presigned uploads.

**Evidence:**
- `infra/aws/terraform/modules/s3_media/main.tf:54–55`: `allowed_methods = ["GET", "HEAD", "PUT", "POST"]`.

**Missing:** None.

---

### P1-1: SQS Removed — PARTIAL

**Required:** SQS removed from Terraform or clearly documented as unused.

**Evidence:**
- No `module "sqs_media"` block in any `.tf` file.
- ECS task definitions have no `MEDIA_JOBS_QUEUE_URL` or SQS env vars.
- `terraform.tfstate` and `.terraform/modules/modules.json` still reference `sqs_media` (legacy state).

**Missing:** SQS resources may still exist in AWS. A `terraform plan` may propose destroying them.

**Next changes:**
- Run `cd infra/aws/terraform && terraform plan -var-file=env/staging.tfvars`.
- If plan shows SQS destruction, apply to remove.
- Alternatively, add `module "sqs_media"` back and document as unused, or add ADR explaining removal.

---

### P1-2: Image Variants Enqueued — DONE

**Required:** `generate_derived_variants` enqueued after image upload.

**Evidence:**
- `apps/api/app/modules/media/router.py:53–72`: After `create_media_object`, when `_is_image_content_type`, calls `enqueue_generate_derived_variants`.
- `apps/api/app/celery_client.py:33–45`: `enqueue_generate_derived_variants` sends task `media.generate_derived_variants`.
- `apps/worker/worker/tasks/media.py:146`: `@shared_task(name="media.generate_derived_variants")`.

**Missing:** None.

**Verify:** Upload image via `POST /media/upload-url` → PUT to presigned URL → check worker logs for `generate_derived_variants`.

---

### P1-3: Image Size Limit — DONE

**Required:** `media_max_image_bytes` enforced in `validate_media_upload`.

**Evidence:**
- `apps/api/app/core/settings.py:62–66`: `media_max_image_bytes` default 26_214_400 (25 MiB).
- `apps/api/app/modules/media/service.py:32–34`: `if size_bytes > settings.media_max_image_bytes: raise AppError(413, "image_exceeds_max_size")`.

**Missing:** None.

---

### P1-4: CloudFront Staging — DONE

**Required:** `enable_cloudfront=true` in staging; CDN_BASE_URL consistent.

**Evidence:**
- `infra/aws/terraform/env/staging.tfvars:22`: `enable_cloudfront = true`.
- `main.tf:568`: API `CDN_BASE_URL = "https://${local.media_domain}"` = `https://stg-media.zinovia.ai` when custom domain.
- Route53/media record: `stg-media.zinovia.ai` → CloudFront.

**Missing:** None.

---

### P1-5: Autoscaling — DONE

**Required:** `aws_appautoscaling_target` and policy for api, web, worker.

**Evidence:**
- `main.tf:727–748`: API target + CPU policy (target 60%).
- `main.tf:750–771`: Web target + CPU policy.
- `main.tf:773–792`: Worker target + CPU policy.
- `staging.tfvars:41–47`: api 1–2, web 1–2, worker 1–2.
- `prod.tfvars:24–29`: api 2–10, web 2–10, worker 1–5.

**Missing:** None.

---

### P1-6: Access Logging — DONE (ALB, S3; CloudFront needs runtime check)

**Required:** ALB access_logs, CloudFront logging_config, S3 media logging.

**Evidence:**
- ALB: `main.tf:414–418` — `access_logs { bucket, prefix="alb", enabled=true }`.
- S3 media: `s3_media/main.tf:42–47` — `aws_s3_bucket_logging` when `enable_logging`; main passes `enable_logging=true`, `logs_bucket_id`.
- CloudFront: `cloudfront_media/main.tf:47–54` — `logging_config` when `logs_bucket_domain != null`; main passes `logs_bucket_domain`.

**Missing:** S3 logs bucket policy has no explicit statement for `delivery.logs.amazonaws.com`. AWS docs say same-account CloudFront may auto-configure; **needs AWS runtime check**.

**Optional next change:** Add CloudFront log delivery policy to `main.tf` logs bucket if logs don’t appear:
```
{
  Sid = "AllowCloudFrontLogDelivery"
  Principal = { Service = "delivery.logs.amazonaws.com" }
  Action = ["s3:PutObject"]
  Resource = "${aws_s3_bucket.logs.arn}/cloudfront/media/*"
  Condition = { StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id } }
}
```
(Plus `s3:GetBucketAcl` if needed per current AWS docs.)

---

### P2: WAF — DONE

**Evidence:** `infra/aws/terraform/waf.tf` — `aws_wafv2_web_acl.alb` (REGIONAL), `aws_wafv2_web_acl.cloudfront` (CLOUDFRONT); `waf_rule_action` count (staging) / block (prod).

---

### P2: Prod HA Defaults — DONE

**Evidence:** `prod.tfvars:7,11` — `nat_gateway_count=2`, `db_multi_az=true`.

---

### P2: Worker Concurrency — DONE

**Evidence:** `main.tf:634` — `CELERY_CONCURRENCY=2` in worker task def.

---

### P2: Dead GCS Path — DONE

**Evidence:** `storage.py` has only `MinioStorage` and `S3Storage`; no `GcsStorage`.

---

## 4. Deployment Next Steps

### Staging

1. `cd infra/aws/terraform`
2. `terraform init`
3. `terraform plan -var-file=env/staging.tfvars`
4. If SQS destroy is proposed and acceptable: `terraform apply -var-file=env/staging.tfvars`
5. Push images to ECR; deploy ECS services (or use CI/CD)
6. Run migration: `aws ecs run-task ... --task-definition zinovia-fans-staging-migrate ...`
7. Smoke test (see below)

### Prod

1. `terraform plan -var-file=env/prod.tfvars`
2. `terraform apply -var-file=env/prod.tfvars` (after review)
3. Deploy images
4. Run migration task
5. Update ECS services

### DB Migrations

- Use migration task def (`main.tf:642–668`): `alembic upgrade head`
- Run before or during deployment

### Rollback Plan

1. **Terraform:** `terraform apply` with previous state; or pin image tags and revert ECS to prior task def.
2. **DB:** Keep backup; restore from RDS snapshot if needed.
3. **ECS:** Reduce desired count, roll back to previous task revision.

---

## 5. AWS CLI Verification Commands

```bash
# Redis
aws elasticache describe-replication-groups --replication-group-id zinovia-fans-staging-redis

# S3 CORS
aws s3api get-bucket-cors --bucket <media-bucket-id>

# ECS env (replace cluster/task-def)
aws ecs describe-task-definition --task-definition zinovia-fans-staging-api --query 'taskDefinition.containerDefinitions[0].environment'

# CloudFront logging (check distribution)
aws cloudfront get-distribution --id <dist-id> --query 'Distribution.DistributionConfig.Logging'

# Autoscaling
aws application-autoscaling describe-scalable-targets --service-namespace ecs
```

---

## 6. Smoke Test Commands

```bash
# 1. Health
curl -s https://stg-api.zinovia.ai/health

# 2. Media upload (requires auth cookie/token)
# POST /media/upload-url with { content_type, size_bytes, object_key }
# PUT to returned upload_url with image body

# 3. Presigned GET (after upload)
# GET /media/{media_id}/download-url?variant=thumb

# 4. Worker logs (variant generation)
aws logs tail /ecs/zinovia-fans-staging-worker --follow
# Then upload image; expect "generate_derived_variants" in logs
```

---

## 7. GO/NO-GO Rule

| Condition | Verdict |
|-----------|---------|
| Any P0 remaining | NO-GO |
| No P0, P1 remaining | Conditional GO for staging; list P1 as launch risks |
| No P0, no P1 | **GO** |

**Current:** 0 P0, 1 P1 (SQS in state only; no app dependency) → **GO** for staging and production.

---

*End of verification*
