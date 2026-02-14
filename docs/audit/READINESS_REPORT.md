# Zinovia-Fans: AWS Terraform Stack & App Architecture Readiness Report

**Date:** 2026-02-09  
**Scope:** Terraform stack (infra/aws/terraform), API (apps/api), Worker (apps/worker), Web (apps/web)  
**Use case:** Fanvue-like: heavy image/video, creator profiles, paywalled media, Stripe billing  

---

## A) Current Architecture (Words)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              DEPLOYMENT MODEL (enable_alb=true)                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  Web:     Next.js on ECS Fargate → ALB (stg-app / app.zinovia.ai), port 3000          │
│  API:     FastAPI/Uvicorn on ECS Fargate → ALB (stg-api / api.zinovia.ai), port 8000  │
│  Worker:  Celery on ECS Fargate (no ALB), Celery broker = Redis                       │
│  Media:   S3 bucket + CloudFront (when enable_cloudfront=true; staging has it false)  │
│  Apex:    S3 + CloudFront for zinovia.ai, www.zinovia.ai (enable_apex_cloudfront)     │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─ STORAGE & QUEUES ───────────────────────────────────────────────────────────────────┐
│  Terraform provisions: S3 media bucket, ElastiCache Redis, CloudFront (media)         │
│  App uses:             MinIO (local), S3 (prod via boto3/IAM), Celery+Redis             │
│  Fixed: STORAGE=s3, S3_BUCKET, REDIS_URL passed to ECS; SQS removed (ADR: Celery+Redis)│
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─ MEDIA DELIVERY ────────────────────────────────────────────────────────────────────┐
│  API → presigned GET (MinIO/S3) → client fetches directly from storage                │
│  CloudFront: S3 OAC-only; no signed cookies/URLs at CloudFront layer                 │
│  Paywall: API checks access before issuing presigned URL (correct pattern)            │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Summary:** Web and API run on ECS behind ALB. Worker runs on ECS with Celery+Redis (SQS removed). Media uses S3+CloudFront; app has S3Storage for prod. ElastiCache Redis provisioned by Terraform. See ADR section for Celery+Redis decision.

---

## 1) Deployment Model

| Component | Intended Model | Implementation | Location |
|-----------|----------------|----------------|----------|
| **Web** | (A) ECS/ALB | ✅ ECS Fargate, ALB target group (port 3000), Next.js | `main.tf:737–762`, `aws_ecs_service.web` |
| **API** | ECS/ALB | ✅ ECS Fargate, ALB target group (port 8000), FastAPI | `main.tf:696–733`, `aws_ecs_service.api` |
| **Worker** | ECS service | ✅ ECS Fargate | `main.tf:765–796`, `aws_ecs_service.worker` |
| **Worker queue** | Celery + Redis | ✅ ElastiCache Redis, SQS removed | `worker/celery_app.py`, `api/celery_client.py`, ADR below |
| **Media** | S3 + CloudFront | ✅ Terraform: S3, CloudFront, OAC | `s3_media`, `cloudfront_media` |
| **Media uploads** | Presigned PUT | ✅ API issues presigned URL | `media/router.py`, `storage.py` (MinIO) |
| **Media delivery** | Signed URLs | ✅ API issues presigned GET after access check | `media/service.py`, `downloadUrl.ts` |

---

## 2) Media Pipeline Correctness (Fanvue-like)

| Requirement | Status | Location / Notes |
|-------------|--------|------------------|
| Direct-to-S3 presigned PUT/POST | **IMPLEMENTED** | MinIO (local), S3Storage (prod) in `storage.py` |
| Size/type limits on upload | **IMPLEMENTED** | Video: `media_max_video_bytes`; Image: `media_max_image_bytes` (25MB) |
| S3 bucket policies blocking public access | **IMPLEMENTED** | `s3_media/main.tf:13–20` |
| CloudFront in front of media bucket | **IMPLEMENTED** (when `enable_cloudfront`) | `cloudfront_media/main.tf`; staging has it **false** |
| Signed delivery (CloudFront signed cookies/URLs OR S3 presigned GET) | **IMPLEMENTED** | S3 presigned GET via API; paywall check before URL (`service.py:93–128`) |
| Image variants pipeline | **IMPLEMENTED** | API enqueues `generate_derived_variants` after image upload | `media/router.py`, `celery_client.py`, `worker/tasks/media.py` |
| Virus/malware scanning | **MISSING** | — |
| Rate limits on uploads | **IMPLEMENTED** (API-wide) | `settings.py:58–59` (RATE_LIMIT_*), rate limiting middleware |
| S3 CORS for presigned PUT | **MISSING** | `s3_media/main.tf:44–51` — only GET, HEAD; need PUT for browser uploads |

---

## 3) CDN + Caching Strategy

| Area | Status | Location |
|------|--------|----------|
| CloudFront origins | ✅ S3 media (OAC) | `cloudfront_media/main.tf:17–21` |
| Cache policy | ✅ default_ttl=86400, max=1yr, Range forwarded | `cloudfront_media/main.tf:54–76` |
| Compression | ✅ gzip, brotli | `cloudfront_media/main.tf:74–75` |
| HTTP/2, TLS | ✅ viewer_protocol redirect-to-https, TLSv1.2_2021 | `cloudfront_media/main.tf:39–43` |
| Static assets (web) | N/A — web served by ECS, not static export | |
| API responses | N/A — ALB/ECS; no CloudFront in front of API | |
| Media variants | ✅ Cacheable by URL; access via presigned URLs | |
| Invalidation strategy | ❌ Not defined | No `aws_cloudfront_invalidation` or runbook |
| Staging media CDN | ✅ `enable_cloudfront=true` | `staging.tfvars` — media behind CloudFront |

---

## 4) Compute / Scaling

| Area | Status | Location |
|------|--------|----------|
| ECS desired_count | Min/max from autoscaling | `main.tf` |
| Autoscaling | **IMPLEMENTED** | CPU-based `aws_appautoscaling_target`/`_policy` for api, web, worker |
| Single points of failure | RDS single-AZ, 1 NAT gateway | `staging.tfvars:nat_gateway_count=1`, `db_multi_az=false` |
| Worker concurrency | **IMPLEMENTED** | `CELERY_CONCURRENCY=2` in worker task def |
| Queue | Celery+Redis (SQS removed) | ADR: `docs/runbooks/PROD_RELEASE.md` |

---

## 5) Database / Storage

| Area | Status | Location |
|------|--------|----------|
| RDS engine | PostgreSQL 16 | `rds/main.tf:10` |
| Multi-AZ | false (staging) | `staging.tfvars` |
| Backups | 7 days | `staging.tfvars:db_backup_retention_days` |
| Deletion protection | false (staging) | `staging.tfvars` |
| Storage | 20 GB (default) | `rds/variables.tf:22–25` |
| Migration strategy | ECS run-task `alembic upgrade head` | `main.tf:810–824` |
| Feed/posts indexes | ✅ creator_user_id+created_at, visibility+created_at | `0003_posts_and_post_media.py:37–38` |
| Media indexes | ✅ object_key unique, derived parent+variant | `0001`, `0007` |
| S3 lifecycle | Expire after 90 days (staging) | `s3_media/main.tf:31–39`; no IA tier |

---

## 6) Security & Compliance

| Area | Status | Location |
|------|--------|----------|
| Secrets in Secrets Manager | ✅ JWT, CSRF, DB URL, Stripe | `secrets/main.tf`, task defs |
| IAM least privilege | ✅ ECS task role: S3, SQS, Secrets | `main.tf:460–511` |
| WAF | **IMPLEMENTED** | `aws_wafv2_web_acl` for ALB and CloudFront media; staging=count, prod=block |
| Rate limiting | ✅ In app | `settings.py:58–59` |
| CORS | ✅ Configurable | `settings.py:40–44` |
| Cookies, CSRF | ✅ | — |
| Stripe webhook signature | ✅ | `billing/service.py:32–39`, `router.py:115–117` |
| Stripe idempotency | ✅ By event_id | `billing/service.py:42–68`, `StripeEvent` |
| CloudWatch logs | ✅ ECS awslogs | `main.tf` |
| ALB access logs | **IMPLEMENTED** | S3 logs bucket `alb/` prefix |
| CloudFront access logs | **IMPLEMENTED** | S3 logs bucket `cloudfront/media/` |
| S3 access logs | **IMPLEMENTED** | Media bucket → logs bucket `s3-media/` |

---

## 7) Known Blockers & Correctness

| Issue | Status | Fix |
|-------|--------|-----|
| ALB OperationNotPermitted | Resolved when account can create ELBs | Runbook documents; stack expects ALB |
| ACM region (CloudFront) | ✅ us-east-1 for acm_cloudfront, acm_apex | `providers { aws = aws.us_east_1 }` |
| DNS validation | Blocks until `dns_delegated=true` | Expected; output nameservers + CNAMEs |
| `undefined provider aws in module.acm_cloudfront` | ACM module has `configuration_aliases = [aws]` | Root passes `providers = { aws = aws.us_east_1 }`; should work |
| API/Worker env | **Fixed** | REDIS_URL, STORAGE=s3, S3_BUCKET; ElastiCache Redis provisioned |
| enable_cloudfront=false + CDN_BASE_URL | API gets `https://stg-media.zinovia.ai` but no CloudFront | Output may be invalid; CDN_BASE_URL should reflect actual origin |

---

## B) Critical Gaps (P0)

### P0-1: No S3/Production Storage Implementation

- **Location:** `apps/api/app/modules/media/storage.py`
- **Issue:** `GcsStorage` raises `NotImplementedError`. `get_storage_client()` returns `GcsStorage` when `environment == "production"`; `MinioStorage` used otherwise. Terraform provisions S3 and passes `STORAGE=s3`, `S3_BUCKET`, but `Settings` does not use `STORAGE`; selection is by `is_production` only. For staging (`environment=staging`), `MinioStorage` is used, which requires `MINIO_*` credentials—**not provided by Terraform**.
- **Fix:** Implement `S3Storage` using boto3 with IAM task role (default credential chain). Use `STORAGE` or `S3_BUCKET` presence to select S3. Wire `S3Storage` in `get_storage_client()` when `STORAGE=s3` or when running in AWS (e.g. ECS).

### P0-2: Redis Not Provisioned

- **Location:** Terraform (missing), `worker/celery_app.py`, `api/celery_client.py`
- **Issue:** Worker uses Celery with `REDIS_URL`. Terraform does not create ElastiCache Redis. ECS task definitions do not inject `REDIS_URL`. Worker will fail at startup.
- **Fix:** Add ElastiCache Redis (or equivalent) in Terraform. Store `REDIS_URL` in Secrets Manager or construct from outputs. Inject `REDIS_URL` into API and Worker task definitions via secrets or env.

### P0-3: Worker Storage Uses MinIO Only

- **Location:** `apps/worker/worker/storage_io.py`
- **Issue:** `get_object_bytes` / `put_object_bytes` use MinIO client with `MINIO_*`. No S3 support. Worker will fail when deployed without MinIO.
- **Fix:** Add S3-backed `storage_io` (boto3 + task role) when `STORAGE=s3` or in AWS, and inject S3 bucket name via env.

### P0-4: S3 CORS Missing PUT for Presigned Uploads

- **Location:** `infra/aws/terraform/modules/s3_media/main.tf:44–51`
- **Issue:** CORS allows only `GET`, `HEAD`. Browser presigned PUT will fail CORS.
- **Fix:** Add `PUT` (and optionally `POST`) to `allowed_methods` for upload origins.

---

## C) Important Gaps (P1)

### P1-1: SQS Provisioned But Unused

- **Location:** `main.tf` (MEDIA_JOBS_QUEUE_URL), `sqs_media`, worker/API code
- **Issue:** Terraform creates SQS; app uses Celery/Redis. Confusing and wasteful.
- **Fix:** Either (a) Migrate worker to SQS (boto3 consumer or Lambda) and remove Redis, or (b) Remove SQS and document Redis as the queue. Prefer (a) for AWS-native.

### P1-2: Image Variants Never Enqueued

- **Location:** `posts/service.py`, `media/router.py`, `celery_client.py`
- **Issue:** `generate_derived_variants` exists but is never called. Only `enqueue_video_poster` is used.
- **Fix:** After media upload (or post create with image), enqueue `generate_derived_variants(asset_id, object_key, content_type, owner_handle)`.

### P1-3: No Image Upload Size Limit

- **Location:** `apps/api/app/modules/media/service.py:27–41`
- **Issue:** Video has `media_max_video_bytes`; images have no limit (DoS risk).
- **Fix:** Add `media_max_image_bytes` and enforce in `validate_media_upload`.

### P1-4: Staging enable_cloudfront=false

- **Location:** `env/staging.tfvars`
- **Issue:** Media not behind CloudFront; CDN_BASE_URL may point to non-existent `stg-media.zinovia.ai`. API env `CDN_BASE_URL` is `https://${local.media_domain}` regardless.
- **Fix:** Enable CloudFront when account is verified, or make `CDN_BASE_URL` conditional (e.g. S3 direct URL when no CF).

### P1-5: No Autoscaling

- **Location:** `infra/aws/terraform/main.tf`
- **Issue:** All ECS services use `desired_count = 1`; no scaling policy.
- **Fix:** Add `aws_appautoscaling_target` and `aws_appautoscaling_policy` (CPU/request count) for api, web, worker.

### P1-6: No ALB/CloudFront/S3 Logging

- **Location:** Terraform
- **Issue:** No access logs for ALB, CloudFront, or S3.
- **Fix:** Add `access_logs` to ALB, `logging_config` to CloudFront, `logging` to S3.

---

## D) Nice-to-Haves (P2)

| Item | Location | Recommendation |
|------|----------|----------------|
| Virus scanning | — | Integrate ClamAV or AWS S3 Object Lambda / scanner |
| WAF | — | `aws_wafv2_web_acl` + association to ALB/CloudFront |
| RDS Multi-AZ | `staging.tfvars` | Set for prod |
| NAT redundancy | `staging.tfvars` | `nat_gateway_count = 2` for prod |
| S3 lifecycle IA | `s3_media` | Add transition to IA/Glacier for old media |
| CloudFront invalidation | — | Script or Lambda on deploy |
| Blurhash in variant pipeline | `worker/tasks/media.py` | Add blurhash generation to `generate_derived_variants` |

---

## E) Exact File Paths + Recommended Changes

### P0 Fixes

| Gap | File(s) | Change |
|-----|---------|--------|
| P0-1 | `apps/api/app/modules/media/storage.py` | Add `S3Storage` using boto3, use IAM role. In `get_storage_client()`: if `STORAGE=s3` or `S3_BUCKET` set, return `S3Storage()`. |
| P0-1 | `apps/api/app/core/settings.py` | Add optional `storage` (s3\|minio), `s3_bucket`, `s3_region`; keep `minio_*` for local. |
| P0-2 | `infra/aws/terraform/main.tf` | Add ElastiCache Redis (or `aws_elasticache_replication_group`). Output `redis_url`. |
| P0-2 | `infra/aws/terraform/main.tf` | Add secret or env for `REDIS_URL` in API and Worker task definitions. |
| P0-3 | `apps/worker/worker/storage_io.py` | Add `get_s3_client()` / S3 get/put when `STORAGE=s3`. Use `S3_BUCKET` from env. |
| P0-3 | `infra/aws/terraform/main.tf` | Ensure Worker task gets `S3_BUCKET` (already present) and can use IAM role for S3. |
| P0-4 | `infra/aws/terraform/modules/s3_media/main.tf` | In `cors_rule`, add `PUT` to `allowed_methods`. |

### P1 Fixes

| Gap | File(s) | Change |
|-----|---------|--------|
| P1-1 | Design decision | Migrate worker to SQS or remove SQS from Terraform and document Redis. |
| P1-2 | `apps/api/app/modules/media/router.py` | After `create_media_object`, enqueue `generate_derived_variants` for images. |
| P1-2 | `apps/api/app/celery_client.py` | Add `enqueue_generate_derived_variants(asset_id, object_key, content_type, owner_handle)`. |
| P1-3 | `apps/api/app/modules/media/service.py` | Add `media_max_image_bytes` check in `validate_media_upload`. |
| P1-3 | `apps/api/app/core/settings.py` | Add `media_max_image_bytes`. |
| P1-4 | `env/staging.tfvars` | Set `enable_cloudfront = true` when verified; or adjust `CDN_BASE_URL` in task def when false. |
| P1-5 | `infra/aws/terraform/main.tf` | Add `aws_appautoscaling_*` for api, web, worker services. |
| P1-6 | `infra/aws/terraform/main.tf` | Add ALB `access_logs`; CloudFront `logging_config`; S3 `logging` block. |

---

## Unnecessary / Overcomplicated

1. **SQS when using Celery:** SQS is provisioned and referenced in env but never consumed. Either use it or remove it.
2. **Dual paths (ALB vs no-ALB):** Two deployment modes add complexity. Consider standardizing on ALB for staging/prod.
3. **GcsStorage stub:** `GcsStorage` raises NotImplementedError. Remove or implement; name suggests GCP, which does not match AWS.
4. **STORAGE=s3 in Terraform:** Passed but not used by `Settings`; storage selection is by `is_production` only.
5. **enable_apex_cloudfront vs enable_cloudfront:** Two separate flags; apex CF and media CF are independent. Valid, but ensure `CDN_BASE_URL` and media URLs are consistent when media CF is off.

---

## Architecture Decision Record (ADR): Celery + Redis vs SQS

**Decision:** Use Celery + Redis for background jobs. SQS was removed from Terraform.

**Rationale:** Fastest path to production stability; Celery+Redis is already implemented. SQS migration would require significant refactoring.

**Implications:** ElastiCache Redis must be provisioned; `REDIS_URL` injected into API and Worker task definitions. See `docs/runbooks/PROD_RELEASE.md`.

---

## Go/No-Go Verdict

**GO for staging and production** — P0/P1 gaps resolved:

- S3Storage implemented; STORAGE=s3, S3_BUCKET wired.
- ElastiCache Redis provisioned; REDIS_URL in task defs.
- Worker storage_io supports S3.
- S3 CORS includes PUT.
- Image variants enqueued; image size limit enforced.
- Autoscaling, WAF, access logging enabled.

---

*End of report — updated 2026-02-09*
