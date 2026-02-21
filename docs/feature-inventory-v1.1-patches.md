# Feature Inventory v1.1 — Patch Set & Underwriting Addendum

**Base document:** `docs/feature-inventory-ai-review.md` (v1.0, 2026-02-21)
**Patch author:** Principal Engineering / Compliance
**Date:** 2026-02-21
**Purpose:** Reduce underwriting risk, correct technical inaccuracies, make security invariants explicit.

---

## A) Prioritized Action Checklist

### P0 — Must Fix (blocks underwriting)

| # | Section | Change | Why | Affected Text |
|---|---------|--------|-----|---------------|
| 1 | §5.5, §6.5 | **Correct webhook verification algorithm.** Doc claims "HMAC-SHA256" for CCBill; actual implementation is MD5 digest (`MD5(subscriptionId + flag + salt)`). KYC is HMAC-SHA256. Misrepresenting crypto controls to a processor is a red flag. | Factual accuracy; processor will test this | "HMAC-SHA256 verification (CCBill, KYC, Resend/Svix)" |
| 2 | §2.1.5, §2.1.6, new | **Add explicit paywall security invariant.** Doc never states the server-side mechanism that prevents unauthorized access to originals. Must document variant-level gating (`TEASER_VARIANTS`), server-side access checks, 404-on-denial, and signed URL TTLs. | Core payment processor concern: "can unpaid users get the content?" | Missing entirely |
| 3 | §3.1 | **Clarify BLOCK/REQUIRE_REVIEW = HOLD state, not enforcement.** Current wording ("Held for admin review") is close but not precise enough. Must state: media in HOLD state is NOT served to any non-owner user until admin resolves. | Processor needs assurance that flagged content is quarantined | "Held for admin review; `media_assets.safety_status = "blocked"`" |
| 4 | §5.2 | **Add explicit "no biometric identification" statement.** The age-range proxy uses a ViT classifier, NOT facial recognition, NOT biometric template extraction. Must be explicit for GDPR/BIPA compliance. | Biometric classification triggers regulatory obligations in EU, IL, TX | Missing entirely |
| 5 | §6.5 | **Correct webhook verification table row.** Same as #1 but in security table. | Factual accuracy | "Webhooks: HMAC-SHA256 verification (CCBill, KYC, Resend/Svix)" |

### P1 — Should Fix (strengthens submission)

| # | Section | Change | Why | Affected Text |
|---|---------|--------|-----|---------------|
| 6 | §3.1, §3.3 | **Clarify worker-only inference and the query-embedding path.** Doc says "Celery worker only" but doesn't explain the search endpoint's synchronous `send_task().get(timeout=10)` pattern. Processor may ask "does your API server run ML models?" | Demonstrates inference isolation from request path | "Where loaded: Celery worker only" |
| 7 | §6.1, §6.4 | **Update worker sizing to reflect model reality.** Doc says "2GB RAM" but models are ~1.76GB plus PyTorch runtime overhead. Recommend 4GB minimum. | Processor may question system stability | "2GB RAM", "ML models (~1.76GB cache)" |
| 8 | §3.1 | **Add AI input minimization statement.** Must state: models receive only image pixel data. No KYC data, DOB, payment info, or user profile is passed to any ML model. | Data minimization for compliance | "No PII, no payment data, no user profile data is read" — exists but buried |
| 9 | §1, §2.1.8 | **Clarify currency model.** Doc mentions EUR in some places, USD in others (tip limits "$1 – $10,000"), and the executive summary doesn't mention currency. Default is EUR; multi-currency supported. | Inconsistent currency references confuse processor | "min $1, max $10,000" vs "€1-€200" |
| 10 | New §5.7 or append to §5.4 | **Add retention policy defaults.** Doc says "configurable, default 90 days" for S3 lifecycle but doesn't state retention for scan records, audit events, or deleted user data. | Processor needs data retention clarity | "Original images follow S3 lifecycle policy (configurable, default 90 days)" |
| 11 | §6.3 | **Clarify CloudFront/WAF current status vs planned.** Doc says "[disabled]" in diagram but text says "currently disabled pending AWS account verification." Must be clear: what protections are active TODAY. | Processor needs to assess current posture, not future | "currently disabled pending AWS account verification" |

### P2 — Nice to Have (polish)

| # | Section | Change | Why | Affected Text |
|---|---------|--------|-----|---------------|
| 12 | §2.1.5 | **Add webhook replay/idempotency details to billing feature.** Feature description mentions webhook but not the dedup mechanism. | Demonstrates robustness to payment processor | "5. System polls `/billing/status` to confirm entitlement" |
| 13 | §7.1 | **Verify ENABLE_AI_SAFETY Terraform default matches prod.** Flag shows `true` in Terraform defaults; confirm this is set in `prod.tfvars` and propagated to all three task definitions. | Operational completeness | "AI Safety: ENABLE_AI_SAFETY — false (API default) / true (Terraform)" |
| 14 | New | **Recommend Cache-Control headers on media.** S3 objects currently have no Cache-Control metadata. Originals should have `Cache-Control: no-store` and teasers should have short `max-age`. | Security hardening for CDN layer | Not in doc |
| 15 | §5.6 | **Add dispute handling SLA.** FAQ says "24 hours" for safety reports. Should state similar for billing disputes. | Processor wants dispute response commitment | "We review all reports within 24 hours" |

---

## B) Patch Set

---

### PATCH-01: Paywall Security Invariant

**Location:** Section 5, insert new §5.0 before §5.1 (or as §5.1, shifting others down). Also add cross-reference in §2.1.5.

**Original text (§5 opening):**
```
## 5. Content Safety & Compliance Controls

### 5.1 Prohibited Content Policy Enforcement Points
```

**New text:**
```
## 5. Content Safety & Compliance Controls

### 5.1 Paywall Enforcement & Media Delivery

**Security invariant:** Unauthorized users CANNOT obtain original or full-resolution media. Access is enforced server-side at the API layer, not by client-side blur or obfuscation.

**Mechanism:**

| Layer | Control |
|-------|---------|
| **Variant-level gating** | Media exists in multiple derived variants: `thumb` (200px), `grid` (600px), `teaser` (blurred), `full` (1200px), and original. Unauthorized users may only request variants in the `TEASER_VARIANTS` set (`thumb`, `grid`, `teaser`). Requests for `full` or original from unauthorized users return HTTP 404. |
| **Server-side access check** | Every call to `GET /media/{id}/download-url` invokes `can_user_access_media()` (authenticated) or `can_anonymous_access_media()` (unauthenticated). These functions verify subscription status, purchase status (`PostPurchase.status == "SUCCEEDED"`), follow relationship, or ownership before issuing a signed URL. |
| **Denial response** | Unauthorized requests return HTTP 404 (not 403), making the resource appear non-existent rather than forbidden. This prevents enumeration. |
| **Signed URL TTL** | S3 presigned URLs expire after `MEDIA_URL_TTL_SECONDS` (default: 900 seconds / 15 min). CloudFront signed URLs expire after `CLOUDFRONT_URL_TTL_SECONDS` (default: 600 seconds / 10 min). Expired URLs return HTTP 403 from S3/CloudFront. |
| **Locked post teasers** | For posts the viewer cannot access, the API returns a teaser payload: `is_locked=true`, `locked_reason` (e.g., "SUBSCRIPTION_REQUIRED"), `price_cents`, `currency`, and `media_previews` (blurhash + dominant color for placeholder rendering). The caption is withheld (`caption: null`). Asset IDs are included so the frontend can request teaser-variant thumbnails only. |
| **Subscription validation** | `is_active_subscriber()` checks `Subscription.status` is `active` or `past_due` within the configurable grace period (`SUBSCRIPTION_GRACE_PERIOD_HOURS`, default 72h), AND `current_period_end > now`. |
| **PPV validation** | `PostPurchase.status == "SUCCEEDED"` is required. Pending or failed purchases do not grant access. |

**Recommendation (not yet implemented):** Set `Cache-Control: no-store, no-cache, must-revalidate` on S3 objects for original and `full` variants to prevent CDN or browser caching of paywalled originals. Teaser variants (`thumb`, `grid`) may use short cache TTLs (`max-age=300`).

### 5.2 Prohibited Content Policy Enforcement Points
```

**Rationale:** The most critical question a payment processor asks is "can users bypass the paywall?" This section makes the server-side enforcement mechanism explicit and auditable.

---

### PATCH-02: Correct Webhook Verification Algorithm

**Location:** Section 5.5, row mentioning "HMAC-SHA256"; Section 6.5, webhook row.

**Original text (§5.5):**
```
All inbound emails are:
1. Received via Resend inbound MX record
2. Verified (SPF, DKIM)
```

**Insert after the Support Escalation Paths table, before "All inbound emails are:":**
```
### 5.6 Webhook Security Controls

All external webhooks are authenticated and deduplicated:

| Webhook Source | Verification | Idempotency | Replay Handling |
|----------------|-------------|-------------|-----------------|
| **CCBill** (`POST /billing/webhooks/ccbill`) | MD5 digest: `MD5(subscriptionId + flag + salt)` verified against `responseDigest` parameter. Salt stored in AWS Secrets Manager. | Atomic UPSERT on `payment_events.event_id` (UNIQUE constraint). Event ID format: `"{event_type}:{transactionId}"`. PostgreSQL `ON CONFLICT DO NOTHING` prevents TOCTOU race conditions. | Duplicate events return HTTP 200 with `{"status": "duplicate_ignored"}`. No side effects on replay. |
| **KYC provider** (`POST /webhooks/kyc`) | HMAC-SHA256 via `X-Kyc-Signature` header. Uses `hmac.compare_digest()` for timing-attack resistance. Secret stored in settings. | Idempotency key table: `"webhook:kyc:{event_id}"` with SHA256 request hash. Cached response returned for exact replays. | Same payload → HTTP 200 (cached response). Different payload with same event ID → HTTP 409 Conflict. |
| **Resend inbound email** (`POST /webhooks/inbound`) | Svix signature verification. | `inbound_emails.resend_email_id` UNIQUE constraint. | Duplicate silently ignored. |

**Note on CCBill MD5:** CCBill's webhook protocol uses MD5 digest (not HMAC-SHA256). This is CCBill's standard integration method. The digest secret (salt) is stored in AWS Secrets Manager and never exposed in logs or responses. Some CCBill event types do not include a digest; for these, idempotency relies on the database UNIQUE constraint on `event_id`.
```

**Original text (§6.5, webhooks row):**
```
| **Webhooks** | HMAC-SHA256 verification (CCBill, KYC, Resend/Svix) |
```

**New text:**
```
| **Webhooks** | CCBill: MD5 digest verification; KYC: HMAC-SHA256 with timing-safe comparison; Resend: Svix signature. All webhooks deduplicated via database UNIQUE constraints. |
```

**Rationale:** The original doc incorrectly claims HMAC-SHA256 for CCBill. A processor who tests this will find MD5 and question the document's accuracy. Being precise about the actual algorithm — and explaining it is CCBill's standard — is more credible than an incorrect claim.

---

### PATCH-03: BLOCK/REQUIRE_REVIEW = HOLD State

**Location:** Section 3.1, Policy Decision Engine table.

**Original text:**
```
| **BLOCK** | `underage_proxy ≥ 0.6` AND `nsfw_score ≥ 0.85` | HIGH | Held for admin review; `media_assets.safety_status = "blocked"` |
| **REQUIRE_REVIEW** | `underage_proxy ≥ 0.6` (alone) | HIGH | Held for admin review; `media_assets.safety_status = "review"` |
| **REQUIRE_REVIEW** | `underage_proxy ≥ 0.3` AND `nsfw_score ≥ 0.5` | MEDIUM | Held for admin review; `media_assets.safety_status = "review"` |
| **ALLOW** | All other cases | LOW | Chains caption + tag tasks; `media_assets.safety_status = "allowed"` |
```

**New text:**
```
| **BLOCK** | `underage_proxy ≥ 0.6` AND `nsfw_score ≥ 0.85` | HIGH | **HOLD state**: `safety_status = "blocked"`. Media is quarantined — not served to any non-owner user. Awaits mandatory admin review. No autonomous enforcement. |
| **REQUIRE_REVIEW** | `underage_proxy ≥ 0.6` (alone) | HIGH | **HOLD state**: `safety_status = "review"`. Media is quarantined — not served to any non-owner user. Awaits mandatory admin review. No autonomous enforcement. |
| **REQUIRE_REVIEW** | `underage_proxy ≥ 0.3` AND `nsfw_score ≥ 0.5` | MEDIUM | **HOLD state**: `safety_status = "review"`. Same quarantine behavior as above. |
| **ALLOW** | All other cases | LOW | `safety_status = "allowed"`. Media may be served normally. Chains caption + tag generation tasks. |

**Definition — HOLD state:** When a safety scan produces a BLOCK or REQUIRE_REVIEW decision, the media asset enters a HOLD state. In this state: (a) the media owner (uploader) can still view their own asset; (b) no other user can obtain a download URL for this asset via the media access control layer; (c) the asset remains in HOLD until an admin explicitly sets `review_decision` to APPROVED or REJECTED. The AI system does NOT autonomously remove, delete, or permanently block content — all final decisions require a human admin action recorded with the admin's user ID and timestamp.
```

**Rationale:** "Held for admin review" is ambiguous about whether the content is still accessible during the hold period. The HOLD state definition makes it explicit that flagged content is quarantined from non-owner access, and that AI never autonomously enforces.

---

### PATCH-04: AI Input Minimization & No Biometric Identification

**Location:** Section 3.1, after "Inputs" block. Also Section 5.2 (minor-risk mitigation), add new point.

**Original text (§3.1 Inputs):**
```
**Inputs**:
- Raw image bytes from S3 (the uploaded file)
- `asset_id`, `object_key`, `content_type` (metadata only)
- No PII, no payment data, no user profile data is read
```

**New text:**
```
**Inputs**:
- Raw image bytes from S3 (the uploaded file), converted to RGB PIL Image
- `asset_id`, `object_key`, `content_type` (routing metadata only — not passed to models)
- **Input minimization:** The ML models receive ONLY decoded pixel data. No EXIF metadata, no user PII (email, name, DOB), no KYC data, no payment information, and no profile data is passed to any model. The `asset_id` is used solely to record results in the database — it is not a model input.
- **No biometric identification:** The age-range proxy classifier (`nateraw/vit-age-classifier`) is a standard image-classification model. It does NOT perform facial recognition, does NOT extract or store biometric templates, does NOT produce a faceprint, and does NOT identify individuals. It outputs a probability distribution over age-range buckets based on general visual features. No biometric data (as defined under GDPR Article 9, BIPA, or CCPA) is processed or stored.
```

**Original text (§5.2, after point 3):**
```
3. **AI proxy signal (not age determination)**: The `nateraw/vit-age-classifier` model produces an `underage_likelihood_proxy` score — this is a **proxy signal based on facial appearance only**. It is explicitly NOT a definitive age determination. The score represents the sum of predicted probabilities for age ranges under 20.
```

**New text:**
```
3. **AI proxy signal (not age determination, not biometric identification)**: The `nateraw/vit-age-classifier` model produces an `underage_likelihood_proxy` score — this is a **proxy signal based on general visual features only**. It is explicitly NOT a definitive age determination. The score represents the sum of predicted probabilities for age ranges under 20. The model does NOT perform facial recognition, does NOT extract biometric templates, and does NOT identify individuals. No biometric data is processed or retained.
```

**Rationale:** Payment processors in regulated markets need assurance that AI features do not trigger biometric data obligations. Explicit denial with regulatory references prevents follow-up questions.

---

### PATCH-05: Worker-Only Inference Clarification

**Location:** Section 3.1, models table footnote; Section 3.3, models table.

**Original text (§3.1):**
```
| NSFW Classifier | `Falconsai/nsfw_image_detection` | image-classification | `nsfw_score` (0-1), `nsfw_label` (nsfw/normal) | Yes (CPU, device=-1) | Celery worker only |
| Age-Range Proxy | `nateraw/vit-age-classifier` | image-classification (ViT) | `age_range_prediction` (e.g., "20-29"), `underage_likelihood_proxy` (0-1) | Yes (CPU, device=-1) | Celery worker only |
```

**Insert after the models table:**
```
**Inference isolation:** All ML model inference runs exclusively in the Celery worker container. The API container does not include `torch`, `transformers`, or `sentence-transformers` in its dependencies and cannot load models. For the semantic search endpoint (`GET /ai-safety/search`), the API dispatches a synchronous Celery task (`ai_safety.embed_query`) to the worker and waits up to 10 seconds for the result via `task.get(timeout=10)`. If the worker is unavailable or times out, the search falls back to keyword matching with zero model dependency in the API process. This architecture ensures that ML inference load does not affect API request latency or stability.
```

**Rationale:** "Celery worker only" in a table cell is easy to miss. The expanded statement addresses the natural follow-up: "but what about the search endpoint that needs embeddings in real time?"

---

### PATCH-06: ECS Worker Sizing

**Location:** Section 6.1 (architecture diagram), Section 6.4 preamble.

**Original text (§6.1 diagram):**
```
              │  ECS: Worker     │
              │  (Celery)        │
              │  1024 CPU        │
              │  2GB RAM         │
              │  ML models       │
              │  (~1.76GB cache) │
```

**New text:**
```
              │  ECS: Worker     │
              │  (Celery)        │
              │  1024 CPU        │
              │  2GB RAM *       │
              │  ML models       │
              │  (~1.76GB cache) │
```

**Insert after the architecture diagram:**
```
*\* Worker RAM note: The current Terraform allocation is 2048 MB (2 GB). Pre-downloaded model files total ~1.76 GB on disk. At runtime, PyTorch loads models into memory on first use (lazy singleton). Peak memory during inference (especially BLIP captioning) may approach or exceed the 2 GB limit. **Recommended production sizing: 4096 MB (4 GB) RAM with 2048 CPU units** to provide headroom for concurrent image processing. The `CELERY_CONCURRENCY` default is 1 to avoid loading duplicate model copies.*
```

**Rationale:** A processor reviewing infrastructure may question whether a service with 1.76GB of models in 2GB of RAM is stable. Flagging the recommendation proactively shows awareness.

---

### PATCH-07: Currency Consistency

**Location:** Section 1 (Executive Summary), Section 2.1.8 (Tipping).

**Original text (§2.1.8):**
```
| **User flow** | 1. Click tip → 2. Enter amount (min $1, max $10,000) → 3. `POST /payments/tips/create-intent` → 4. CCBill checkout → 5. Tip recorded |
```

**New text:**
```
| **User flow** | 1. Click tip → 2. Enter amount (min 100 cents / ~€1, max 1,000,000 cents / ~€10,000) → 3. `POST /payments/tips/create-intent` → 4. CCBill checkout → 5. Tip recorded |
```

**Insert in §1 (Executive Summary), after the monetization bullet:**
```
- **Currency:** Default transaction currency is EUR. The platform supports multi-currency via CCBill (USD, EUR, GBP, AUD, CAD, JPY). Creators set their subscription currency in their plan (defaults to EUR). PPV and tip amounts use the post/message currency or fall back to the platform default. All internal ledger amounts are stored in cents with an explicit `currency` column.
```

**Rationale:** Mixing "$" and "€" symbols without explanation creates confusion. The processor needs to know the default and supported currencies.

---

### PATCH-08: Retention Policy

**Location:** Section 5.4, append after the data minimization table.

**Original text (end of §5.4):**
```
| **Soft deletion** | User deletion is soft (role="deleted", is_active=False) — preserves audit trail while removing access |
```

**Insert after:**
```

**Data Retention Defaults:**

| Data Category | Active Retention | After Deletion | Notes |
|---------------|-----------------|----------------|-------|
| **Original media (S3)** | Indefinite (while account active) | S3 lifecycle: configurable, default 90 days (`media_lifecycle_days`) | Set to 0 to disable auto-expiration |
| **Derived variants (S3)** | Same as original | Same as original | Deleted with parent via cascade |
| **Safety scan records** | Indefinite | Indefinite | Immutable audit trail; required for compliance |
| **Audit events** | Indefinite | Indefinite | Immutable, append-only; never deleted |
| **Payment events** | Indefinite | Indefinite | Full webhook payloads; required for chargeback defense |
| **Ledger events** | Indefinite | Indefinite | Financial records |
| **User PII (DB)** | While account active | Soft-deleted: `role="deleted"`, `is_active=false`. Personal data retained for audit/legal obligations. Full erasure available on request (manual process via `privacy@zinovia.ai`). | 30-day erasure commitment per FAQ |
| **Captions & tags** | While media exists | Cascade-deleted with parent `media_assets` record | No standalone retention |
| **Inbound emails** | Indefinite | N/A | Support correspondence |
| **Idempotency keys** | 24 hours | Auto-expired via `expires_at` column | Cleanup via scheduled task |

These are platform defaults. Specific retention periods may be adjusted per jurisdiction upon legal review.
```

**Rationale:** Processors ask "how long do you keep data?" A concrete table with defaults is far more credible than "configurable."

---

### PATCH-09: CloudFront/WAF Current Status

**Location:** Section 6.3 (CDN) and §6.5 (WAF row).

**Original text (§6.3):**
```
### 6.3 CDN

- **CloudFront** configured for `media.zinovia.ai` (currently disabled pending AWS account verification)
- When enabled: Origin Access Control for S3, signed URLs (10 min TTL), WAF attached
- Cache policy: 1 year for static assets, 1 day with stale-while-revalidate for images
- Fallback: Direct S3 signed URLs (15 min TTL) when CloudFront is disabled
```

**New text:**
```
### 6.3 CDN & WAF — Current Status

| Component | Status (as of 2026-02-21) | Configuration | When Enabled |
|-----------|--------------------------|---------------|--------------|
| **CloudFront (media)** | **Disabled** — pending AWS account service limit increase | `media.zinovia.ai` → S3 origin with Origin Access Control, signed URLs (10 min TTL) | Origin Access Control for S3; cache policy: 1 year static, 1 day with stale-while-revalidate for images |
| **CloudFront (web)** | **Disabled** — ALB serves web traffic directly | `zinovia.ai` → S3 static site | Only activated if ALB is unavailable |
| **WAF (regional, ALB)** | **Disabled** — activates with `enable_ha=true` or `enable_waf=true` | AWSManagedRulesCommonRuleSet (SQLi, XSS) + rate limit (2000 req/IP) | Attached to ALB listener |
| **WAF (CloudFront)** | **Disabled** — requires CloudFront to be active | Same ruleset as regional | Attached to CloudFront distribution |

**Current media delivery path (CloudFront disabled):** API generates S3 presigned URLs directly. URLs expire after `MEDIA_URL_TTL_SECONDS` (default 900s / 15 min). S3 enforces expiration server-side. Application-level rate limiting (Redis-backed) provides request throttling in lieu of WAF.

**Planned:** Enable CloudFront and WAF once AWS account verification completes. No code changes required — infrastructure is fully configured in Terraform and activates via feature flags.
```

**Rationale:** Processor needs to assess the security posture that exists TODAY, not the future plan. A table with explicit "Disabled" status is unambiguous.

---

### PATCH-10: Explicit Idempotency in Billing Feature

**Location:** Section 2.1.5 (Subscription Checkout), Audit trail row.

**Original text:**
```
| **Audit trail** | `payment_events` (full webhook payload), `ledger_events` (gross/fee/net breakdown) |
```

**New text:**
```
| **Audit trail** | `payment_events` (full webhook payload stored on first receipt; UNIQUE constraint on `event_id` prevents duplicate processing via atomic UPSERT; replayed webhooks return HTTP 200 with `"duplicate_ignored"` and produce no side effects), `ledger_events` (gross/fee/net breakdown) |
```

**Rationale:** Payment processors specifically look for idempotency guarantees in webhook handling. Stating this in the feature description — not just in a separate security section — makes it immediately visible during feature-by-feature review.

---

## C) Underwriting Addendum — Paywall Security & Safety Controls

*This addendum summarizes the controls most relevant to payment processor underwriting. It references specific mechanisms documented in the full Feature Inventory (v1.1).*

---

### 1. Paywall Enforcement & Media Delivery

All premium content (subscription-gated posts, PPV posts, locked message media) is protected by **server-side access control** at the API layer. The platform does NOT rely on client-side blur, JavaScript obfuscation, or URL obscurity.

**How it works:**
- Media files are stored in private S3 buckets with no public access.
- Every media download request (`GET /media/{id}/download-url`) is validated by `can_user_access_media()`, which checks ownership, subscription status, or purchase status (`PostPurchase.status == "SUCCEEDED"`) before issuing a time-limited signed URL.
- Unauthorized requests receive HTTP 404 (resource appears non-existent).
- **Variant-level gating:** Media exists in multiple server-generated variants (thumb, grid, teaser, full, original). Unauthorized users can only request teaser variants (`thumb`, `grid`, `teaser`). Requests for `full` or original from unauthorized users are denied.
- **Signed URL expiry:** S3 presigned URLs expire in 15 minutes; CloudFront signed URLs in 10 minutes. After expiry, S3/CloudFront returns HTTP 403.
- **Subscription validation:** Checks status (`active` or `past_due` within grace period) AND `current_period_end > now`.

**Recommendation pending implementation:** Add `Cache-Control: no-store` to original/full S3 objects to prevent intermediary caching.

### 2. Minor-Risk Mitigation

The platform employs five layers of defense against content involving minors:

1. **Age gate:** All users must provide date of birth at signup. Anyone under 18 is rejected. DOB stored in `users` table.
2. **Creator KYC:** Government ID + selfie verification required before any content publication. KYC state machine tracks: CREATED → EMAIL_VERIFIED → KYC_PENDING → KYC_SUBMITTED → KYC_APPROVED.
3. **AI proxy signal:** Uploaded images are scanned by `nateraw/vit-age-classifier`, which produces an `underage_likelihood_proxy` score (0–1). This is a statistical proxy based on general visual features — **it is NOT facial recognition, NOT biometric identification, and NOT a definitive age determination.** No biometric templates are extracted, stored, or compared.
4. **Human review:** When the proxy score exceeds configurable thresholds (≥ 0.3 combined with NSFW, or ≥ 0.6 alone), content enters a **HOLD state** — quarantined from non-owner access until an admin explicitly approves or rejects. The AI system CANNOT autonomously enforce content removal.
5. **Immutable audit:** Every scan result (scores, model versions, decision) and every admin review action (reviewer ID, timestamp, decision) is permanently recorded in `image_safety_scans`.

### 3. Human-in-the-Loop Moderation — Chain of Custody

| Step | Actor | Action | Record |
|------|-------|--------|--------|
| Upload | Creator | Uploads image | `media_assets` row created; `audit_events` ACTION_MEDIA_UPLOADED |
| Scan | AI (worker) | Classifies image | `image_safety_scans` row: scores, decision, model_versions |
| HOLD | System | Sets `safety_status` to "review" or "blocked" | `media_assets.safety_status` updated |
| Quarantine | System | Denies non-owner download requests | Enforced by `can_user_access_media()` |
| Review | Admin | Approves or rejects | `image_safety_scans.reviewed_by`, `reviewed_at`, `review_decision` |
| Resolution | System | Updates `safety_status` to "allowed" or "blocked" | `media_assets.safety_status` updated |

All records are immutable after creation. Admin reviewer identity is captured via authenticated session (`require_admin` dependency).

### 4. Payment Isolation

- **No card data on our servers.** All payment collection uses CCBill FlexForms — a redirect-based hosted checkout. The user is sent to CCBill's domain to enter payment details. Our servers never see, process, or store card numbers, CVVs, or bank details.
- **Webhook verification:** CCBill webhooks verified via MD5 digest (`MD5(subscriptionId + flag + salt)`). KYC webhooks via HMAC-SHA256 with timing-safe comparison.
- **Idempotent processing:** Payment events deduplicated via UNIQUE constraint on `event_id` with atomic PostgreSQL UPSERT. Replayed webhooks produce no duplicate charges, subscriptions, or ledger entries.
- **Chargeback handling:** CCBill Chargeback events are received via webhook, recorded in `payment_events`, and create a REFUND entry in `ledger_events` adjusting creator balances.

### 5. Incident Handling & Escalation

| Channel | Address | Purpose | SLA |
|---------|---------|---------|-----|
| Safety reports | `safety@zinovia.ai` | Content policy violations, abuse | Review within 24 hours |
| Privacy requests | `privacy@zinovia.ai` | Data deletion, GDPR/CCPA | Acknowledgment within 48 hours; erasure within 30 days |
| Legal | `legal@zinovia.ai` | DMCA, court orders, disputes | Acknowledgment within 48 hours |
| Billing support | `support@zinovia.ai` | Refund requests, billing issues | Response within 24 hours |

All inbound emails are auto-ingested via Resend webhook, verified (SPF, DKIM), auto-categorized by recipient address, and visible in the admin dashboard. Admin actions (post removal, user suspension, user deletion) are logged in `audit_events` with actor identity, timestamp, and IP address.

For critical safety incidents (CSAM or imminent harm): immediate content removal, user suspension, and escalation to legal counsel. Law enforcement cooperation as required by applicable law.

---

*End of Underwriting Addendum*
