# Zinovia.ai — High-Performance CloudFront Architecture

> Implementation-grade plan. All values are concrete and ready to apply.

---

## A) TARGET ARCHITECTURE

```
                    ┌───────────────────────────────────────────────────────┐
                    │                     Route53                           │
                    │  zinovia.ai      → CloudFront (Web Distribution)     │
                    │  www.zinovia.ai  → CloudFront (Web Distribution)     │
                    │  api.zinovia.ai  → ALB direct (no CloudFront)        │
                    │  media.zinovia.ai→ CloudFront (Media Distribution)   │
                    └──────┬─────────────────┬──────────────────┬──────────┘
                           │                 │                  │
              ┌────────────▼────────┐        │     ┌────────────▼───────────┐
              │  CloudFront (Web)   │        │     │  CloudFront (Media)    │
              │  Distribution       │        │     │  Distribution          │
              │                     │        │     │                        │
              │  WAF Web ACL        │        │     │  WAF Web ACL           │
              │  ────────────────── │        │     │  ──────────────────    │
              │  Behaviors:         │        │     │  Behavior:             │
              │   /_next/static/*   │        │     │   /* → S3 (OAC)       │
              │     → ALB (Web)     │        │     │   Cache: 30d           │
              │     Cache: 1yr      │        │     │   Signed URLs: PPV     │
              │                     │        │     │                        │
              │   /api/*            │        │     └────────────┬───────────┘
              │     → ALB (API)     │        │                  │
              │     Cache: 0        │        │     ┌────────────▼───────────┐
              │                     │        │     │  S3 Media Bucket       │
              │   /assets/* etc     │        │     │  (OAC, no public)      │
              │     → ALB (Web)     │        │     └────────────────────────┘
              │     Cache: 30d      │        │
              │                     │        │
              │   /* (default)      │        │
              │     → ALB (Web)     │        │
              │     Cache: 0        │        │
              └────────────┬────────┘        │
                           │                 │
              ┌────────────▼─────────────────▼─────────────────┐
              │          ALB (existing, origin-protected)       │
              │                                                 │
              │  X-Origin-Verify header required (CloudFront)   │
              │  ─────────────────────────────────────────────  │
              │  Host: api.zinovia.ai   → API TG (port 8000)   │
              │  Host: zinovia.ai       → Web TG (port 3000)   │
              │  Path: /api/*           → API TG (port 8000)   │
              │         (new rule, priority 90)                 │
              └──────┬───────────────────────────┬─────────────┘
                     │                           │
              ┌──────▼───────┐            ┌──────▼───────┐
              │  ECS Web     │            │  ECS API     │
              │  Next.js SSR │            │  FastAPI     │
              │  512/1GB     │            │  512/1GB     │
              │  3–10 tasks  │            │  3–10 tasks  │
              └──────────────┘            └──────────────┘
```

### Why api.zinovia.ai stays on ALB (no CloudFront)

| Factor | CloudFront for API | Direct ALB |
|--------|-------------------|------------|
| Latency for uncached requests | +1-5ms (CF edge hop with no cache benefit) | Lowest possible |
| WebSocket support | Limited | Full |
| POST/PUT/PATCH body size | 50KB Lambda@Edge limit if needed | Unlimited |
| SSL termination | Double (CF + ALB) | Single (ALB) |
| WAF | Can attach to CF | Can attach to ALB directly |
| Cost | $0.0085/10K requests + data transfer | $0 (already paid) |
| Complexity | Higher (cache policies for every endpoint) | None |

**Decision**: API stays direct on ALB. The `/api/*` path on the **web distribution** routes to the API origin, eliminating the double-hop. External `api.zinovia.ai` callers (webhooks, mobile apps) hit ALB directly.

---

## B) CLOUDFRONT CACHING PLAN

### Distribution: Web (zinovia.ai)

#### Behavior 1: `/_next/static/*` — Immutable Static Assets

Next.js fingerprints all files under `/_next/static/` with content hashes.
They are immutable and safe to cache forever.

```
Path pattern:       /_next/static/*
Origin:             ALB (Web TG)
Viewer protocol:    redirect-to-https
Allowed methods:    GET, HEAD
Cached methods:     GET, HEAD
Compress:           true (Brotli + Gzip)

Cache Policy (custom: "ZinoviaStaticImmutable"):
  Min TTL:          31536000  (1 year)
  Default TTL:      31536000  (1 year)
  Max TTL:          31536000  (1 year)
  Cache key:
    Headers:        none
    Cookies:        none
    Query strings:  none
  Enable accept-encoding-gzip:   true
  Enable accept-encoding-brotli: true

Origin Request Policy: "AllViewerExceptHostHeader"
  (ID: b689b0a8-53d0-40ab-baf8-586a32...) — AWS managed
  Forwards: All viewer headers EXCEPT Host (so ALB gets CF host)

Response Headers Policy (custom: "ZinoviaSecurityHeaders"):
  HSTS:                    max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options:  nosniff
  X-Frame-Options:         DENY
  Referrer-Policy:         strict-origin-when-cross-origin
  Content-Security-Policy: (report-only initially)
```

#### Behavior 2: `/api/*` — API Passthrough (NO CACHE)

This routes browser `/api/*` calls directly to the API origin on the ALB,
completely eliminating the Next.js proxy double-hop.

```
Path pattern:       /api/*
Origin:             ALB (API TG) — separate origin with Host override
Viewer protocol:    https-only
Allowed methods:    GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
Cached methods:     GET, HEAD
Compress:           true

Cache Policy: "CachingDisabled" (AWS managed)
  ID: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad
  Min/Default/Max TTL: 0/0/0

Origin Request Policy (custom: "ZinoviaApiForward"):
  Headers:       Host, Origin, Referer, X-Request-Id, X-CSRF-Token,
                 X-Idempotency-Key, Accept, Accept-Language,
                 CloudFront-Viewer-Country
  Cookies:       All (access_token, csrf_token needed for auth)
  Query strings: All

Response Headers Policy: "ZinoviaSecurityHeaders" (same as above)
  + Access-Control-Allow-Origin: (let API handle CORS, don't override)
```

**Critical**: The API origin must override the `Host` header to `api.zinovia.ai`
so the ALB host-based routing sends it to the API target group.

#### Behavior 3: Public Static Assets

```
Path pattern:       /assets/*    (also /fonts/*, separate behavior if needed)
Origin:             ALB (Web TG)
Viewer protocol:    redirect-to-https
Allowed methods:    GET, HEAD
Compress:           true

Cache Policy (custom: "ZinoviaPublicAssets"):
  Min TTL:          86400       (1 day)
  Default TTL:      2592000     (30 days)
  Max TTL:          31536000    (1 year)
  Cache key:
    Headers:        none
    Cookies:        none
    Query strings:  none (or whitelist specific if versioned)
  Accept-encoding:  gzip + brotli

Origin Request Policy: "AllViewerExceptHostHeader" (AWS managed)
Response Headers Policy: "ZinoviaSecurityHeaders"
```

Additional behaviors with the same policy:
- `/favicon.ico`
- `/robots.txt`  (TTL override: default 1 day, max 1 day)
- `/sitemap.xml` (TTL override: default 1 hour, max 1 day)

#### Behavior 4: `/*` Default — SSR HTML (NO CACHE)

```
Path pattern:       * (default)
Origin:             ALB (Web TG)
Viewer protocol:    redirect-to-https
Allowed methods:    GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
Cached methods:     GET, HEAD
Compress:           true

Cache Policy: "CachingDisabled" (AWS managed)
  ID: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad

Origin Request Policy (custom: "ZinoviaSsrForward"):
  Headers:       Host, Accept, Accept-Language, CloudFront-Viewer-Country,
                 X-Forwarded-For
  Cookies:       All (access_token for SSR auth, locale cookie, csrf_token)
  Query strings: All

Response Headers Policy: "ZinoviaSecurityHeaders"
```

**Why default TTL=0**: SSR pages are personalized (auth state, locale).
The `Cache-Control` response from Next.js controls behavior:
- Next.js static pages: `s-maxage=31536000, stale-while-revalidate` (CF respects this)
- Next.js SSR pages: `private, no-cache, no-store, max-age=0, must-revalidate`
- Next.js ISR pages: `s-maxage=N, stale-while-revalidate=M` (CF respects)

With TTL=0 at CloudFront, the origin's `Cache-Control` header takes full effect.
If Next.js sends `s-maxage=3600`, CloudFront caches for 1 hour. If it sends
`private, no-store`, CloudFront doesn't cache. This is the correct behavior.

### How to Avoid Caching Personalized Content

1. **CloudFront default behavior TTL=0** — forces CF to respect origin headers
2. **Next.js SSR sends `Cache-Control: private, no-store`** — already default for dynamic pages
3. **Cookies forwarded in cache key** — different cookies = different cache entries (but with TTL=0, moot)
4. **API behavior uses CachingDisabled** — zero caching on authenticated endpoints
5. **Static behaviors strip cookies from cache key** — `/\_next/static/*` never varies by user

---

## C) DOUBLE-HOP REMOVAL

### OPTION A (RECOMMENDED): CloudFront Routes /api/* to API Origin

**How it works:**
```
BEFORE (current, double-hop):
  Browser → zinovia.ai/api/health
    → CloudFront → ALB → Next.js (port 3000)
      → Next.js rewrite to https://api.zinovia.ai/health
        → ALB AGAIN → FastAPI (port 8000)
          → Response back through 2 ALBs

AFTER (Option A, single-hop):
  Browser → zinovia.ai/api/health
    → CloudFront /api/* behavior → ALB (Host: api.zinovia.ai)
      → FastAPI (port 8000)
        → Response directly
```

**Changes Required:**

1. **CloudFront**: Add `/api/*` behavior pointing to API origin (ALB with `api.zinovia.ai` Host header)

2. **ALB**: Add path-based rule on HTTPS listener:
   ```
   Priority: 90 (before web rule at 110)
   Condition: path-pattern = /api/*
   Action: forward to API TG
   ```
   Note: The ALB already has path-based rules on the HTTP listener for API paths.
   We need the same on HTTPS since CloudFront forwards to 443.

3. **Next.js**: Remove the `/api/*` rewrite from `next.config.mjs`:
   ```diff
   async rewrites() {
     return {
       beforeFiles: [],
   -   afterFiles: [
   -     {
   -       source: "/api/:path*",
   -       destination: `${upstream}/:path*`,
   -     },
   -   ],
   +   afterFiles: [],
       fallback: [
         { source: "/:handle", destination: "/creators/:handle" },
       ],
     };
   }
   ```

4. **Web ECS env var**: Remove or set `NEXT_PUBLIC_API_SAME_ORIGIN_PROXY=true`
   (keep it true — browser still calls `/api/*`, but now CloudFront handles routing)

5. **API ECS**: Add `API_BASE_URL` for server-side SSR calls:
   ```
   # New env var for Web container (server-side only, not NEXT_PUBLIC_):
   API_BASE_URL = "https://api.zinovia.ai"
   ```
   This is used by `getServerApiBaseUrl()` in `lib/env.ts` for SSR.
   SSR calls go: Web task → ALB → API task (single hop, internal VPC).

6. **FastAPI CORS**: Add `https://zinovia.ai` origin (already present).
   No CORS changes needed since `/api/*` on `zinovia.ai` is proxied by CloudFront
   and the `Origin` header is forwarded.

7. **Auth impact**: None. The `access_token` cookie has `domain=.zinovia.ai`
   and `SameSite=lax`. Browser sends it to `zinovia.ai/api/*` (same site).
   CloudFront forwards all cookies to the API origin.

8. **CSRF impact**: None. The `csrf_token` cookie is readable by JS on `zinovia.ai`.
   The `X-CSRF-Token` header is forwarded by CloudFront to the API origin.

### OPTION B (Alternative): Browser Calls api.zinovia.ai Directly

**Changes Required:**
1. Set `NEXT_PUBLIC_API_SAME_ORIGIN_PROXY=false`
2. Set `NEXT_PUBLIC_API_BASE_URL=https://api.zinovia.ai`
3. Remove Next.js `/api/*` rewrite
4. CORS already allows `https://api.zinovia.ai` origin
5. Cookie `domain=.zinovia.ai` already covers `api.zinovia.ai`
6. CSRF cookie on `.zinovia.ai` is readable from `zinovia.ai` JS

**Tradeoffs vs Option A:**

| Factor | Option A (CF routing) | Option B (direct API) |
|--------|----------------------|----------------------|
| CORS | Not needed (same origin) | Required (cross-origin) |
| Preflight requests | None | OPTIONS on every non-simple request |
| Cookie handling | Automatic (same origin) | Requires `credentials: include` (already set) |
| CloudFront benefits | WAF, logging, geo headers | None for API |
| Implementation effort | Moderate (CF behavior + ALB rule) | Low (env var change) |
| Rollback risk | Higher (CF config) | Very low |

**Recommendation**: Option A is superior because it eliminates CORS overhead,
keeps WAF protection on API calls, and provides unified logging. Option B is a
quick fallback if CF configuration proves problematic.

---

## D) MEDIA CDN (S3 + CloudFront)

### Distribution: Media (media.zinovia.ai)

The existing `module.cloudfront_media` already defines this. Enable it:

```hcl
# env/prod.tfvars
enable_cloudfront = true
```

### Caching Strategy

#### Public Media (thumbnails, previews, avatars, banners)

```
Path pattern:       /public/*  (or key prefix convention)
Cache Policy:
  Min TTL:          86400       (1 day)
  Default TTL:      2592000     (30 days)
  Max TTL:          31536000    (1 year)
  Cache key:        none (just path)
  Compression:      gzip + brotli (for SVG/JSON; images already compressed)
```

The API should set `Cache-Control: public, max-age=2592000, immutable` on
public media responses. CloudFront respects this.

#### Private/PPV Media (subscriber-only content, paid posts)

```
Path pattern:       /* (default, S3 origin)
Trusted key group:  CloudFront key pair for signed URLs
Viewer access:      Signed URLs required

Signed URL strategy:
  - API generates signed CloudFront URL with 15-minute expiry
  - URL includes: resource path, expiry timestamp, signature
  - Viewer must present the signed URL to CloudFront
  - CloudFront validates signature → serves from cache or fetches from S3

Cache behavior:
  TTL: respect origin Cache-Control
  Key: just the path (signature is in query string, excluded from cache key)
  This means: one cached copy, but only accessible with valid signature
```

**Implementation Pattern:**

```python
# API: Generate signed URL for private media
from botocore.signers import CloudFrontSigner
import datetime

def generate_signed_media_url(media_key: str, ttl_seconds: int = 900) -> str:
    cf_signer = CloudFrontSigner(
        key_id=settings.cloudfront_key_pair_id,
        rsa_signer=rsa_sign_function,
    )
    url = f"https://media.zinovia.ai/{media_key}"
    expiry = datetime.datetime.utcnow() + datetime.timedelta(seconds=ttl_seconds)
    return cf_signer.generate_presigned_url(url, date_less_than=expiry)
```

**Thumbnail/Preview Strategy:**

| Content Type | Access | Caching | URL Type |
|-------------|--------|---------|----------|
| Creator avatar | Public | 30 days | Direct CF URL |
| Creator banner | Public | 30 days | Direct CF URL |
| Post thumbnail (free) | Public | 30 days | Direct CF URL |
| Post thumbnail (blurred preview for PPV) | Public | 30 days | Direct CF URL |
| Full-size subscriber media | Signed URL | 30 days (cache), 15min (URL) | Signed CF URL |
| Full-size PPV media | Signed URL | 30 days (cache), 15min (URL) | Signed CF URL |
| Message attachments | Signed URL | 7 days (cache), 15min (URL) | Signed CF URL |

### Origin Access Control (OAC)

Already configured in the existing module:
```hcl
resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "${var.name_prefix}-s3-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}
```

S3 bucket policy must only allow CloudFront OAC:
```json
{
  "Statement": [{
    "Sid": "AllowCloudFrontOAC",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::${bucket}/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::${account_id}:distribution/${distribution_id}"
      }
    }
  }]
}
```

---

## E) ORIGIN PROTECTION

### Method: Custom Secret Header from CloudFront

CloudFront adds a custom header `X-Origin-Verify` with a secret value.
The ALB only accepts requests with this header.

```
CloudFront → adds header "X-Origin-Verify: <secret>" → ALB
ALB rule:   if X-Origin-Verify != <secret>, return 403
```

**Implementation:**

1. **Store secret in Secrets Manager:**
   ```hcl
   resource "random_password" "origin_verify" {
     length  = 64
     special = false
   }

   resource "aws_secretsmanager_secret" "origin_verify" {
     name = "${local.name_prefix}-origin-verify"
   }

   resource "aws_secretsmanager_secret_version" "origin_verify" {
     secret_id     = aws_secretsmanager_secret.origin_verify.id
     secret_string = random_password.origin_verify.result
   }
   ```

2. **CloudFront custom origin header:**
   ```hcl
   origin {
     domain_name = aws_lb.main[0].dns_name
     origin_id   = "ALB-Web"
     custom_origin_config {
       http_port              = 80
       https_port             = 443
       origin_protocol_policy = "https-only"
       origin_ssl_protocols   = ["TLSv1.2"]
     }
     custom_header {
       name  = "X-Origin-Verify"
       value = random_password.origin_verify.result
     }
   }
   ```

3. **ALB listener rule — reject without header:**
   ```hcl
   # Default rule on HTTPS listener: fixed 403 (already set)
   # All forwarding rules add condition:
   resource "aws_lb_listener_rule" "web" {
     # ...existing conditions...
     condition {
       http_header {
         http_header_name = "X-Origin-Verify"
         values           = [random_password.origin_verify.result]
       }
     }
   }
   ```

4. **Exception for api.zinovia.ai (direct ALB access):**
   The API listener rule for `Host: api.zinovia.ai` should NOT require
   the origin-verify header, since webhooks and external callers need direct access.

   ```hcl
   # API rule: Host-based only (no origin-verify required)
   resource "aws_lb_listener_rule" "api" {
     priority = 100
     condition {
       host_header { values = ["api.${var.domain_name}"] }
     }
     action { type = "forward"; target_group_arn = web_lb_target_group.api[0].arn }
   }

   # Web rule: Host-based + origin-verify required
   resource "aws_lb_listener_rule" "web" {
     priority = 110
     condition {
       host_header { values = local.web_domains }
     }
     condition {
       http_header {
         http_header_name = "X-Origin-Verify"
         values           = [random_password.origin_verify.result]
       }
     }
     action { type = "forward"; target_group_arn = aws_lb_target_group.web[0].arn }
   }

   # API-via-CF rule: path-based + origin-verify required
   resource "aws_lb_listener_rule" "api_via_cf" {
     priority = 90
     condition {
       path_pattern { values = ["/api/*"] }
     }
     condition {
       http_header {
         http_header_name = "X-Origin-Verify"
         values           = [random_password.origin_verify.result]
       }
     }
     action { type = "forward"; target_group_arn = aws_lb_target_group.api[0].arn }
   }
   ```

5. **Security group tightening (optional, belt-and-suspenders):**
   Restrict ALB ingress to CloudFront IP ranges + your IPs for direct API access:
   ```hcl
   # CloudFront uses prefix list: com.amazonaws.global.cloudfront.origin-facing
   data "aws_ec2_managed_prefix_list" "cloudfront" {
     name = "com.amazonaws.global.cloudfront.origin-facing"
   }
   ```
   Note: This prefix list may not be available in all regions. The header method
   is sufficient and simpler.

---

## F) PERFORMANCE & SCALING

### ECS Right-Sizing

| Service | Current | Recommended | Rationale |
|---------|---------|-------------|-----------|
| API CPU | 512 (0.5 vCPU) | 512 | Sufficient for I/O-bound FastAPI |
| API Memory | 1024 MB | 1024 MB | Adequate for Python + DB connections |
| Web CPU | 512 (0.5 vCPU) | 1024 (1 vCPU) | SSR is CPU-intensive (React rendering) |
| Web Memory | 1024 MB | 2048 MB | Node.js needs headroom for SSR + V8 heap |
| Worker CPU | 1024 | 1024 | OK for image processing |
| Worker Memory | 2048 | 2048 | OK for image processing |

**Key insight**: With CloudFront caching `/_next/static/*`, the Web service
handles fewer requests (only SSR and uncached pages). But SSR itself is
CPU-heavy. Bumping to 1 vCPU / 2 GB prevents GC pauses and OOM kills.

### Autoscaling Tuning

```hcl
# Increase minimums for faster cold-start response
api_scaling_min = 3    # was 2
web_scaling_min = 3    # was 2

# Lower CPU target for earlier scale-out
api_scaling_target_cpu = 50  # was 60
web_scaling_target_cpu = 50  # was 60

# Faster scale-out, slower scale-in
api_scale_out_cooldown = 30   # was 60
api_scale_in_cooldown  = 180  # was 120
web_scale_out_cooldown = 30   # was 60
web_scale_in_cooldown  = 180  # was 120
```

### RDS Right-Sizing

| Parameter | Current | Recommended | Rationale |
|-----------|---------|-------------|-----------|
| Instance | db.t3.small (2 vCPU, 2GB) | db.t3.medium (2 vCPU, 4GB) | Double memory for pg shared_buffers |
| Multi-AZ | true | true | Keep |
| Connection limit | ~100 | ~200 | Larger instance = more connections |

**Connection Pooling**: Add RDS Proxy or PgBouncer sidecar:
```
Current:  ECS task (asyncpg pool=5 default) → RDS directly
          3 API tasks × 5 connections = 15 connections
          At 10 tasks × 5 = 50 connections (fine for t3.small)

Future:   If scaling to 10+ tasks, add RDS Proxy:
          ECS tasks → RDS Proxy (connection pooling) → RDS
          RDS Proxy handles 100s of client connections with ~20 RDS connections
```

For now, db.t3.medium is sufficient. Add RDS Proxy when you hit 50+ concurrent
connections (visible in CloudWatch `DatabaseConnections` metric).

### Redis Right-Sizing

| Parameter | Current | Recommended | Rationale |
|-----------|---------|-------------|-----------|
| Instance | cache.t3.micro (555MB) | cache.t3.small (1.55GB) | 3x memory for Celery queues + session cache |

### API Response Caching in Redis

Safe-to-cache API responses (public, no auth):
```python
# Example: cache /creators/discover for 60 seconds
@router.get("/creators/discover")
async def discover_creators(...):
    cache_key = f"discover:{page}:{page_size}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)
    result = await fetch_from_db(...)
    await redis.setex(cache_key, 60, json.dumps(result))
    return result
```

Cache candidates:
- `GET /creators/discover` — 60s TTL
- `GET /creators/{handle}` (public profile) — 30s TTL
- `GET /posts/{id}` (public post) — 30s TTL
- `GET /feed` — NOT cacheable (personalized)
- `GET /auth/me` — NOT cacheable (per-user)

### Observability

**CloudWatch Metrics to Monitor:**

| Metric | Source | Alarm Threshold |
|--------|--------|-----------------|
| Cache Hit Ratio | CloudFront | < 50% after 24h (static should be >95%) |
| 5xx Error Rate | CloudFront | > 1% over 5 minutes |
| Origin Latency (p95) | CloudFront | > 2000ms |
| Target Response Time (p95) | ALB | > 1500ms |
| HTTP 5XX Count | ALB | > 10 in 5 minutes |
| CPUUtilization | ECS API | > 80% sustained 5 min |
| MemoryUtilization | ECS Web | > 85% sustained 5 min |
| DatabaseConnections | RDS | > 80% of max |
| FreeableMemory | RDS | < 200MB |
| EngineCPUUtilization | ElastiCache | > 80% |

**CloudFront Access Logs**: Already configured in the media module.
Enable for web distribution too (same logs bucket, prefix `cloudfront/web`).

---

## G) MIGRATION PLAN

### Phase 0: Prerequisites (Day 0)

1. **ACM Certificate in us-east-1** (required for CloudFront):
   ```bash
   # Existing module handles this if enable_cloudfront=true
   # Verify cert covers: zinovia.ai, www.zinovia.ai, media.zinovia.ai
   # The acm module creates *.zinovia.ai or specific SANs
   ```
   The existing `module.acm_apex` creates certs for CloudFront.
   Verify it includes all needed domains.

2. **Create WAF Web ACL in us-east-1** (must be us-east-1 for CloudFront):
   - AWS Managed Rules: AWSManagedRulesCommonRuleSet
   - AWS Managed Rules: AWSManagedRulesKnownBadInputsRuleSet
   - Rate limiting: 2000 requests per 5 min per IP

3. **Generate origin-verify secret**

### Phase 1: Deploy CloudFront (Day 1)

1. Apply Terraform with new CloudFront resources
2. CloudFront distributions create with `*.cloudfront.net` domain
3. Validate: `curl -H "Host: zinovia.ai" https://d1234.cloudfront.net/`
4. Test all 4 behaviors manually:
   - `/_next/static/chunks/main.js` → should return cached
   - `/api/health` → should return `{"ok":true}` from API
   - `/login` → should return SSR HTML
   - `/assets/og-default.jpg` → should return cached

### Phase 2: Update ALB Rules (Day 1)

1. Add `X-Origin-Verify` header check to web listener rules
2. Add `/api/*` path-based rule on HTTPS listener (priority 90)
3. Verify API still accessible via `api.zinovia.ai` (no origin-verify required)
4. Verify existing health checks still pass

### Phase 3: Switch DNS (Day 2)

1. Update Route53 records:
   - `zinovia.ai` A/AAAA → CloudFront Web distribution
   - `www.zinovia.ai` A/AAAA → CloudFront Web distribution
   - `media.zinovia.ai` A → CloudFront Media distribution
   - `api.zinovia.ai` A → ALB (unchanged)

2. **TTL strategy**: Set Route53 TTL to 60s before migration. After
   validation, increase to 300s.

3. **Validation checklist:**
   - [ ] `https://zinovia.ai` loads (SSR page)
   - [ ] `https://zinovia.ai/_next/static/...` returns `X-Cache: Hit from cloudfront`
   - [ ] `https://zinovia.ai/api/health` returns `{"ok":true}`
   - [ ] Login works (cookies flow correctly)
   - [ ] CSRF works (token cookie + header forwarded)
   - [ ] `https://api.zinovia.ai/health` returns `{"ok":true}`
   - [ ] `https://media.zinovia.ai/...` serves media
   - [ ] Creator profile pages load with SSR metadata

### Phase 4: Remove Next.js Proxy (Day 2)

1. Remove `/api/*` rewrite from `next.config.mjs`
2. Build and deploy new web image
3. Force ECS deployment
4. Verify `/api/*` requests still work (now routed by CloudFront)

### Rollback Plan

**If CloudFront has issues:**
1. Switch Route53 `zinovia.ai` back to ALB (60s TTL propagation)
2. Remove `X-Origin-Verify` requirement from ALB rules
3. Re-add `/api/*` rewrite to `next.config.mjs` and redeploy web
4. CloudFront distributions can remain (idle, no traffic)

**Rollback is safe because:**
- Route53 change takes effect in 60s (low TTL)
- ALB rules can be updated without downtime
- Next.js rewrite change only requires container redeploy (~3 min)
- Total rollback time: ~5 minutes

---

## H) TERRAFORM SNIPPETS

### H.1 — Variables (add to variables.tf)

```hcl
variable "enable_web_cloudfront" {
  type        = bool
  default     = false
  description = "Put CloudFront in front of the web (zinovia.ai)"
}

variable "cloudfront_web_price_class" {
  type    = string
  default = "PriceClass_100"  # US, Canada, Europe (cheapest)
  # PriceClass_200 adds Asia/Africa/Middle East
  # PriceClass_All for global
}

variable "origin_verify_secret" {
  type      = string
  sensitive = true
  default   = ""
  description = "Secret header value for CloudFront→ALB origin protection"
}
```

### H.2 — ACM Certificate for CloudFront (us-east-1)

```hcl
# Already handled by module.acm_apex when enable_apex_cloudfront=true
# Ensure the cert covers zinovia.ai + www.zinovia.ai
# If not, add a dedicated cert:

module "acm_web_cf" {
  source = "./modules/acm"
  count  = var.enable_web_cloudfront ? 1 : 0

  domain_name = var.domain_name
  subject_alternative_names = [
    "www.${var.domain_name}",
  ]
  zone_id                     = var.route53_zone_id
  wait_for_validation         = var.wait_for_certificate_validation
  create_validation_records   = var.dns_delegated

  providers = {
    aws = aws.us_east_1  # CloudFront requires us-east-1 certs
  }
}
```

### H.3 — WAF Web ACL (us-east-1)

```hcl
resource "aws_wafv2_web_acl" "cloudfront_web" {
  count    = var.enable_web_cloudfront ? 1 : 0
  provider = aws.us_east_1  # Must be us-east-1 for CloudFront

  name        = "${local.name_prefix}-web-waf"
  scope       = "CLOUDFRONT"
  description = "WAF for zinovia.ai CloudFront distribution"

  default_action { allow {} }

  # Rule 1: AWS Common Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
        # Exclude rules that break legitimate traffic
        rule_action_override {
          name = "SizeRestrictions_BODY"
          action_to_use { allow {} }
        }
      }
    }
    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSet"
    }
  }

  # Rule 2: Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 2
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "KnownBadInputs"
    }
  }

  # Rule 3: Rate limiting
  rule {
    name     = "RateLimit"
    priority = 3
    action { block {} }
    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimit"
    }
  }

  visibility_config {
    sampled_requests_enabled   = true
    cloudwatch_metrics_enabled = true
    metric_name                = "WebWAF"
  }
}
```

### H.4 — Origin Verify Secret

```hcl
resource "random_password" "origin_verify" {
  count   = var.enable_web_cloudfront ? 1 : 0
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "origin_verify" {
  count                   = var.enable_web_cloudfront ? 1 : 0
  name                    = "${local.name_prefix}-cf-origin-verify"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "origin_verify" {
  count         = var.enable_web_cloudfront ? 1 : 0
  secret_id     = aws_secretsmanager_secret.origin_verify[0].id
  secret_string = random_password.origin_verify[0].result
}

locals {
  origin_verify_header = var.enable_web_cloudfront ? random_password.origin_verify[0].result : ""
}
```

### H.5 — CloudFront Cache Policies

```hcl
# Cache policy: Immutable static assets (1 year)
resource "aws_cloudfront_cache_policy" "static_immutable" {
  count   = var.enable_web_cloudfront ? 1 : 0
  name    = "${local.name_prefix}-static-immutable"
  comment = "1-year cache for fingerprinted static assets"

  min_ttl     = 31536000
  default_ttl = 31536000
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# Cache policy: Public assets (30 days default, up to 1 year)
resource "aws_cloudfront_cache_policy" "public_assets" {
  count   = var.enable_web_cloudfront ? 1 : 0
  name    = "${local.name_prefix}-public-assets"
  comment = "30-day default cache for public assets"

  min_ttl     = 86400
  default_ttl = 2592000
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}
```

### H.6 — CloudFront Origin Request Policies

```hcl
# Origin request policy: Forward auth headers + cookies to API
resource "aws_cloudfront_origin_request_policy" "api_forward" {
  count   = var.enable_web_cloudfront ? 1 : 0
  name    = "${local.name_prefix}-api-forward"
  comment = "Forward all cookies + auth headers to API origin"

  cookies_config {
    cookie_behavior = "all"
  }
  headers_config {
    header_behavior = "whitelist"
    headers {
      items = [
        "Origin",
        "Referer",
        "Accept",
        "Accept-Language",
        "X-Request-Id",
        "X-CSRF-Token",
        "X-Idempotency-Key",
        "CloudFront-Viewer-Country",
      ]
    }
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}

# Origin request policy: Forward cookies + basic headers for SSR
resource "aws_cloudfront_origin_request_policy" "ssr_forward" {
  count   = var.enable_web_cloudfront ? 1 : 0
  name    = "${local.name_prefix}-ssr-forward"
  comment = "Forward cookies + locale headers for SSR"

  cookies_config {
    cookie_behavior = "all"
  }
  headers_config {
    header_behavior = "whitelist"
    headers {
      items = [
        "Accept",
        "Accept-Language",
        "CloudFront-Viewer-Country",
        "X-Forwarded-For",
      ]
    }
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}
```

### H.7 — CloudFront Response Headers Policy

```hcl
resource "aws_cloudfront_response_headers_policy" "security" {
  count   = var.enable_web_cloudfront ? 1 : 0
  name    = "${local.name_prefix}-security-headers"
  comment = "Security headers for all responses"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = false  # Don't override if origin sets it
    }
  }
}
```

### H.8 — CloudFront Web Distribution

```hcl
resource "aws_cloudfront_distribution" "web" {
  count = var.enable_web_cloudfront ? 1 : 0

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.name_prefix} web distribution"
  default_root_object = ""
  price_class         = var.cloudfront_web_price_class
  web_acl_id          = aws_wafv2_web_acl.cloudfront_web[0].arn
  aliases             = [var.domain_name, local.www_domain]

  # ----- ORIGIN 1: Web (Next.js SSR) -----
  origin {
    domain_name = aws_lb.main[0].dns_name
    origin_id   = "ALB-Web"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 60
    }

    custom_header {
      name  = "X-Origin-Verify"
      value = local.origin_verify_header
    }
  }

  # ----- ORIGIN 2: API (FastAPI, Host override) -----
  origin {
    domain_name = aws_lb.main[0].dns_name
    origin_id   = "ALB-API"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 60
    }

    custom_header {
      name  = "X-Origin-Verify"
      value = local.origin_verify_header
    }

    # Override Host header so ALB routes to API target group
    custom_header {
      name  = "Host"
      value = "api.${var.domain_name}"
    }
  }

  # ----- BEHAVIOR 1: /_next/static/* (immutable, 1 year cache) -----
  ordered_cache_behavior {
    path_pattern     = "/_next/static/*"
    target_origin_id = "ALB-Web"
    compress         = true

    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]

    cache_policy_id            = aws_cloudfront_cache_policy.static_immutable[0].id
    origin_request_policy_id   = "b689b0a8-53d0-40ab-baf8-586a32e60023" # AllViewerExceptHostHeader
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security[0].id
  }

  # ----- BEHAVIOR 2: /api/* (no cache, route to API origin) -----
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    target_origin_id = "ALB-API"
    compress         = true

    viewer_protocol_policy = "https-only"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]

    cache_policy_id            = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.api_forward[0].id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security[0].id
  }

  # ----- BEHAVIOR 3: /assets/* (public, 30-day cache) -----
  ordered_cache_behavior {
    path_pattern     = "/assets/*"
    target_origin_id = "ALB-Web"
    compress         = true

    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]

    cache_policy_id            = aws_cloudfront_cache_policy.public_assets[0].id
    origin_request_policy_id   = "b689b0a8-53d0-40ab-baf8-586a32e60023" # AllViewerExceptHostHeader
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security[0].id
  }

  # ----- BEHAVIOR 4: /favicon.ico (public, 30-day cache) -----
  ordered_cache_behavior {
    path_pattern     = "/favicon.ico"
    target_origin_id = "ALB-Web"
    compress         = true

    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]

    cache_policy_id            = aws_cloudfront_cache_policy.public_assets[0].id
    origin_request_policy_id   = "b689b0a8-53d0-40ab-baf8-586a32e60023"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security[0].id
  }

  # ----- DEFAULT BEHAVIOR: /* (SSR, no cache) -----
  default_cache_behavior {
    target_origin_id = "ALB-Web"
    compress         = true

    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]

    cache_policy_id            = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.ssr_forward[0].id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security[0].id
  }

  # ----- TLS -----
  viewer_certificate {
    acm_certificate_arn      = module.acm_web_cf[0].certificate_arn_validated
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # ----- GEO (no restrictions) -----
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # ----- LOGGING -----
  logging_config {
    bucket          = aws_s3_bucket.logs.bucket_domain_name
    prefix          = "cloudfront/web"
    include_cookies = false
  }

  tags = {
    Name        = "${local.name_prefix}-web-cf"
    Environment = var.environment
  }
}
```

### H.9 — ALB Listener Rules (Updated)

```hcl
# NEW: /api/* path-based rule on HTTPS listener (for CloudFront routing)
resource "aws_lb_listener_rule" "api_via_cloudfront" {
  count        = var.enable_alb && var.enable_web_cloudfront ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 90

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }

  condition {
    http_header {
      http_header_name = "X-Origin-Verify"
      values           = [local.origin_verify_header]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api[0].arn
  }
}

# UPDATED: Web rule with origin-verify header
resource "aws_lb_listener_rule" "web" {
  count        = local.has_https_listener ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 110

  condition {
    host_header {
      values = local.web_domains
    }
  }

  # Add origin-verify when CloudFront is enabled
  dynamic "condition" {
    for_each = var.enable_web_cloudfront ? [1] : []
    content {
      http_header {
        http_header_name = "X-Origin-Verify"
        values           = [local.origin_verify_header]
      }
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web[0].arn
  }
}

# UNCHANGED: API rule (no origin-verify, direct access allowed)
resource "aws_lb_listener_rule" "api" {
  count        = local.has_https_listener ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 100

  condition {
    host_header {
      values = ["api.${var.domain_name}"]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api[0].arn
  }
}
```

### H.10 — Route53 Records (Updated)

```hcl
# Web: zinovia.ai → CloudFront (when CF enabled) or ALB (fallback)
resource "aws_route53_record" "apex_cf_a" {
  count   = var.enable_web_cloudfront && var.dns_delegated ? 1 : 0
  zone_id = var.route53_zone_id
  name    = ""
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.web[0].domain_name
    zone_id                = aws_cloudfront_distribution.web[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "apex_cf_aaaa" {
  count   = var.enable_web_cloudfront && var.dns_delegated ? 1 : 0
  zone_id = var.route53_zone_id
  name    = ""
  type    = "AAAA"
  alias {
    name                   = aws_cloudfront_distribution.web[0].domain_name
    zone_id                = aws_cloudfront_distribution.web[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www_cf_a" {
  count   = var.enable_web_cloudfront && var.dns_delegated ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "www"
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.web[0].domain_name
    zone_id                = aws_cloudfront_distribution.web[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www_cf_aaaa" {
  count   = var.enable_web_cloudfront && var.dns_delegated ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "www"
  type    = "AAAA"
  alias {
    name                   = aws_cloudfront_distribution.web[0].domain_name
    zone_id                = aws_cloudfront_distribution.web[0].hosted_zone_id
    evaluate_target_health = false
  }
}

# API: api.zinovia.ai → ALB (unchanged, no CloudFront)
# (existing aws_route53_record.api remains)

# Media: media.zinovia.ai → CloudFront Media (enable existing module)
# (existing aws_route53_record.media remains)
```

### H.11 — ECS Environment Variable Changes

```hcl
# Web container: Add API_BASE_URL for server-side calls
# This goes in the web task definition container environment block:

{ name = "API_BASE_URL", value = "https://api.${var.domain_name}" },
# Server-side SSR calls use this to reach API via ALB (single hop)
# Browser-side continues using /api/* (routed by CloudFront)

# NEXT_PUBLIC_API_SAME_ORIGIN_PROXY stays "true"
# Browser JS calls /api/* → CloudFront routes to API origin directly
```

### H.12 — Next.js Config Change

After CloudFront is live and `/api/*` routing is confirmed working:

```javascript
// next.config.mjs — remove the /api/* rewrite
async rewrites() {
  return {
    beforeFiles: [],
    afterFiles: [],  // REMOVED: /api/:path* proxy
    fallback: [
      { source: "/:handle", destination: "/creators/:handle" },
    ],
  };
},
```

### H.13 — prod.tfvars Updates

```hcl
# Add to env/prod.tfvars:
enable_cloudfront       = true    # was false — enables media CDN
enable_web_cloudfront   = true    # new — enables web CDN
enable_apex_cloudfront  = false   # keep false (we use enable_web_cloudfront instead)

# Scaling improvements:
api_scaling_min = 3    # was 2
web_scaling_min = 3    # was 2
web_cpu         = 1024 # was 512 (SSR is CPU-intensive)
web_memory_mb   = 2048 # was 1024

# RDS upgrade (apply during maintenance window):
db_instance_class = "db.t3.medium"  # was db.t3.small
```

---

## APPENDIX: Complete Request Flow After Migration

### Browser → SSR Page (e.g., /creators/jane)
```
Browser GET https://zinovia.ai/creators/jane
  → CloudFront edge (default behavior: /* → ALB-Web)
  → Cache MISS (TTL=0, not cached)
  → ALB (X-Origin-Verify validated) → Web TG → Next.js SSR
  → Next.js reads access_token cookie, calls API for data:
      getServerApiBaseUrl() → "https://api.zinovia.ai"
      fetch("https://api.zinovia.ai/creators/jane/public")
        → ALB (Host: api.zinovia.ai) → API TG → FastAPI
  → Next.js renders HTML, returns with Cache-Control: private, no-store
  → CloudFront forwards to browser (not cached)
Total hops: Browser → CF → ALB → Next.js → ALB → FastAPI (2 ALB hops, but separate)
```

### Browser → API Call (e.g., /api/feed)
```
Browser GET https://zinovia.ai/api/feed
  → CloudFront edge (/api/* behavior → ALB-API)
  → Cache MISS (CachingDisabled)
  → ALB (Host: api.zinovia.ai, X-Origin-Verify validated, path: /api/feed)
    → /api/* rule (priority 90) → API TG → FastAPI handles /feed
  → FastAPI returns JSON
  → CloudFront forwards to browser (not cached)
Total hops: Browser → CF → ALB → FastAPI (1 ALB hop — DOUBLE-HOP ELIMINATED)
```

### Browser → Static Asset (e.g., /_next/static/chunks/main-abc123.js)
```
Browser GET https://zinovia.ai/_next/static/chunks/main-abc123.js
  → CloudFront edge (/_next/static/* behavior)
  → Cache HIT (1-year TTL, content-hash in filename)
  → Returns immediately from edge
Total hops: 0 origin requests (served from edge cache)
```

### Note on /api/* Path Stripping

CloudFront forwards the full path including `/api/` prefix. The ALB rule
matches `/api/*` and forwards to the API target group. FastAPI receives
the request with path `/api/feed`.

**FastAPI needs to handle the `/api` prefix.** Two options:

**Option 1 (recommended)**: Mount the FastAPI app under `/api`:
```python
# main.py
app = FastAPI(root_path="/api")
```
Or use an `APIRouter` prefix.

**Option 2**: Use ALB path-based routing with path rewrite (ALB doesn't
support path rewriting natively). Instead, add a CloudFront Function:

```javascript
// CloudFront Function: strip /api prefix
function handler(event) {
  var request = event.request;
  request.uri = request.uri.replace(/^\/api/, '');
  if (request.uri === '') request.uri = '/';
  return request;
}
```

Option 2 is cleaner since it doesn't require FastAPI changes. Attach the
function to the `/api/*` behavior as a viewer request function.
