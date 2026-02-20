# E2E Reality Map — Zinovia Fans

> Generated 2026-02-19. Reflects actual code scan of the repository.

## Legend

| Status | Meaning |
|--------|---------|
| **Implemented** | API endpoint + frontend page both exist and are wired |
| **API Only** | Backend endpoint exists, no frontend page/component |
| **Partial** | Endpoint exists but feature-flagged off by default or incomplete |
| **Missing** | Documented in spec but not found in codebase |

---

## 1. Authentication & Accounts

| Feature | Status | API Route | Frontend Page | Notes |
|---------|--------|-----------|---------------|-------|
| Fan signup | **Implemented** | `POST /auth/signup` | `app/signup/page.tsx` | Creates fan (role=fan) + sends verification email |
| Creator signup | **Implemented** | `POST /auth/register` | `app/signup/page.tsx` | Same page, account-type toggle. Idempotency-key required |
| Login | **Implemented** | `POST /auth/login` | `app/login/page.tsx` (server) + `LoginForm.tsx` (client) | Sets access_token + csrf_token cookies |
| Logout | **Implemented** | `POST /auth/logout` | Navbar dropdown button | Clears cookies |
| Session check | **Implemented** | `GET /auth/me` | `lib/api/auth.ts:getSession()` | Used by layout for session hydration |
| Email verification | **Implemented** | `POST /auth/verify-email` | `app/verify-email/page.tsx` | Auto-login on verify (sets cookies) |
| Resend verification | **Implemented** | `POST /auth/resend-verification-email` | `app/verify-email/page.tsx` | Rate-limited |
| Forgot password | **Implemented** | `POST /auth/forgot-password` | `app/forgot-password/page.tsx` | Sends reset email via Resend |
| Reset password | **Implemented** | `POST /auth/reset-password` | `app/reset-password/page.tsx` | Consumes token |
| Change password | **Implemented** | `POST /auth/change-password` | `app/settings/security/page.tsx` | Requires current + new password |
| Dev token lookup | **Implemented** | `GET /auth/dev/tokens?email=` | N/A | **Non-production only**. Returns verification/reset tokens |

## 2. Creator Discovery & Profiles

| Feature | Status | API Route | Frontend Page | Notes |
|---------|--------|-----------|---------------|-------|
| List creators | **Implemented** | `GET /creators` | `app/creators/page.tsx` | Paginated, search via `?q=` |
| Creator profile | **Implemented** | `GET /creators/{handle}` | `app/creators/[handle]/page.tsx` | Public profile with posts |
| Creator posts | **Implemented** | `GET /creators/{handle}/posts` | Same page | Paginated, `include_locked` param |
| Update profile | **Implemented** | `PATCH /creators/me` | `app/settings/profile/page.tsx` | display_name, bio, avatar, banner, nsfw, discoverable |
| Follow/unfollow | **Implemented** | `POST/DELETE /creators/{id}/follow` | Creator profile page | Follow button |
| Followers list | **Implemented** | `GET /creators/me/followers` | N/A | API-only |

## 3. Posts & Feed

| Feature | Status | API Route | Frontend Page | Notes |
|---------|--------|-----------|---------------|-------|
| Create post | **Implemented** | `POST /posts` | `app/creator/post/new/page.tsx` | TEXT/IMAGE/VIDEO, 4 visibility levels |
| Update post | **Implemented** | `PATCH /posts/{id}` | N/A | API exists, no dedicated edit page |
| Delete post | **Implemented** | `DELETE /posts/{id}` | N/A | API-only |
| Publish now | **Implemented** | `POST /posts/{id}/publish-now` | N/A | For scheduled posts |
| Feed | **Implemented** | `GET /feed` | `app/feed/page.tsx` | Cursor-paginated, locked teasers |
| Search posts | **Implemented** | `GET /posts/search` | `app/search/page.tsx` | pg_trgm full-text search |
| Like post | **Partial** | `POST /posts/{id}/like` | Feed page | **Gated by `ENABLE_LIKES=false`** |
| Unlike post | **Partial** | `DELETE /posts/{id}/like` | Feed page | **Gated by `ENABLE_LIKES=false`** |
| Post comments | **Partial** | `POST /posts/{id}/comments` | Feed page | **Gated by `ENABLE_COMMENTS=false`** |
| List comments | **Partial** | `GET /posts/{id}/comments` | Feed page | **Gated by `ENABLE_COMMENTS=false`** |
| Scheduled posts | **Partial** | `POST /posts` (with `scheduled_at`) | Post form | **Gated by `ENABLE_SCHEDULED_POSTS=false`** |

## 4. Billing & Subscriptions (Stripe)

| Feature | Status | API Route | Frontend Page | Notes |
|---------|--------|-----------|---------------|-------|
| Checkout subscription | **Implemented** | `POST /billing/checkout/subscription` | `app/creators/[handle]/page.tsx` SubscribeCheckoutButton | Returns Stripe checkout URL |
| Stripe webhook | **Implemented** | `POST /billing/webhooks/stripe` | N/A | Signature verified; `STRIPE_WEBHOOK_TEST_BYPASS` for local |
| Billing status | **Implemented** | `GET /billing/status` | `app/billing/manage/page.tsx` | Lists fan's subscriptions |
| Cancel subscription | **Implemented** | `POST /billing/subscriptions/{id}/cancel` | `app/billing/manage/page.tsx` | Cancel at period end |
| Billing portal | **Implemented** | `POST /billing/portal` | `app/billing/manage/page.tsx` | Stripe Customer Portal URL |
| Billing health | **Implemented** | `GET /billing/health` | N/A | Checks Stripe config |
| Creator plan (get) | **Implemented** | `GET /billing/plan` | N/A | No dedicated frontend page |
| Creator plan (update) | **Implemented** | `PATCH /billing/plan` | N/A | No dedicated frontend page |
| Billing success | **Implemented** | N/A | `app/billing/success/page.tsx` | Callback page |
| Billing cancel | **Implemented** | N/A | `app/billing/cancel/page.tsx` | Callback page |

## 5. PPV (Pay-Per-View)

| Feature | Status | API Route | Frontend Page | Notes |
|---------|--------|-----------|---------------|-------|
| PPV post intent | **Partial** | `POST /ppv/posts/{id}/create-intent` | N/A | **Gated by `ENABLE_PPV_POSTS=false`** |
| PPV post status | **Partial** | `GET /ppv/posts/{id}/status` | N/A | **Gated** |
| PPV message media intent | **Partial** | `POST /ppv/message-media/{id}/create-intent` | N/A | **Gated by `ENABLE_PPVM=false`** |
| PPV message media status | **Partial** | `GET /ppv/message-media/{id}/status` | N/A | **Gated** |

## 6. Messaging (DMs)

| Feature | Status | API Route | Frontend Page | Notes |
|---------|--------|-----------|---------------|-------|
| Create conversation | **Implemented** | `POST /dm/conversations` | `app/messages/page.tsx` | Fan initiates with creator |
| List conversations | **Implemented** | `GET /dm/conversations` | `app/messages/page.tsx` | Cursor-paginated |
| Send message | **Implemented** | `POST /dm/conversations/{id}/messages` | `app/messages/[conversationId]/page.tsx` | TEXT or MEDIA |
| List messages | **Implemented** | `GET /dm/conversations/{id}/messages` | Same page | Cursor-paginated |
| DM media download | **Implemented** | `GET /dm/messages/{id}/media/{idx}/download-url` | Same page | Signed URL |

## 7. Collections

| Feature | Status | API Route | Frontend Page | Notes |
|---------|--------|-----------|---------------|-------|
| Create collection | **Implemented** | `POST /collections` | `app/creator/collections/new/page.tsx` | Creator-only |
| List collections | **Implemented** | `GET /collections` | `app/creator/collections/page.tsx` | |
| Get collection | **Implemented** | `GET /collections/{id}` | `app/creator/collections/[id]/page.tsx` | |
| Update collection | **Implemented** | `PATCH /collections/{id}` | Same page | |
| Delete collection | **Implemented** | `DELETE /collections/{id}` | Same page | |
| Add post to collection | **Implemented** | `POST /collections/{id}/posts` | Same page | |
| Remove post | **Implemented** | `DELETE /collections/{id}/posts/{post_id}` | Same page | |

## 8. Media & Vault

| Feature | Status | API Route | Frontend Page | Notes |
|---------|--------|-----------|---------------|-------|
| Upload URL | **Implemented** | `POST /media/upload-url` | Used by post form + vault | Signed S3/MinIO URL |
| Batch upload URLs | **Implemented** | `POST /media/batch-upload-urls` | Vault page | |
| Download URL | **Implemented** | `GET /media/{id}/download-url` | Various | Signed download |
| Vault (my media) | **Partial** | `GET /media/mine` | `app/creator/vault/page.tsx` | **Gated by `ENABLE_VAULT=false`** |
| Delete media | **Implemented** | `DELETE /media/{id}` | Vault page | |

## 9. AI Image Generation

| Feature | Status | API Route | Frontend Page | Notes |
|---------|--------|-----------|---------------|-------|
| Generate image | **Implemented** | `POST /ai/images/generate` | `app/ai/images/new/page.tsx` | Queues Celery task |
| List AI jobs | **Implemented** | `GET /ai/images` | `app/ai/images/page.tsx` | |
| Get AI job | **Implemented** | `GET /ai/images/{id}` | `app/ai/images/[id]/page.tsx` | |
| Apply image | **Implemented** | `POST /ai/images/{id}/apply` | Same page | avatar/banner/hero |
| Brand assets | **Implemented** | `GET /brand/assets` | Landing page | |

## 10. Notifications

| Feature | Status | API Route | Frontend Page | Notes |
|---------|--------|-----------|---------------|-------|
| List notifications | **Partial** | `GET /notifications` | `app/notifications/page.tsx` | **Gated by `ENABLE_NOTIFICATIONS=false`** |
| Mark read | **Partial** | `POST /notifications/{id}/read` | Same page | **Gated** |
| Mark all read | **Partial** | `POST /notifications/read-all` | Same page | **Gated** |

## 11. Payments (Tips)

| Feature | Status | API Route | Frontend Page | Notes |
|---------|--------|-----------|---------------|-------|
| Tip create-intent | **Implemented** | `POST /payments/tips/create-intent` | Creator profile | Stripe PaymentIntent |

## 12. Creator Earnings

| Feature | Status | API Route | Frontend Page | Notes |
|---------|--------|-----------|---------------|-------|
| Earnings summary | **Implemented** | `GET /creator/earnings` | N/A | No dedicated page |
| Payout setup link | **Implemented** | `POST /creator/payouts/setup-link` | N/A | Stripe Connect |

## 13. Admin Moderation

| Feature | Status | API Route | Frontend Page | Notes |
|---------|--------|-----------|---------------|-------|
| List creators (admin) | **Implemented** | `GET /admin/creators` | `app/admin/page.tsx` | Requires admin role |
| Creator action | **Implemented** | `POST /admin/creators/{id}/action` | Same page | approve/reject/feature/verify/suspend |
| List posts (admin) | **Implemented** | `GET /admin/posts` | Same page | |
| Post action | **Implemented** | `POST /admin/posts/{id}/action` | Same page | remove/restore |
| Token lookup | **Implemented** | `GET /admin/tokens` | Same page | For when SES is broken |
| Force verify email | **Implemented** | `POST /admin/force-verify-email` | Same page | Skip email delivery |

## 14. Onboarding & KYC

| Feature | Status | API Route | Frontend Page | Notes |
|---------|--------|-----------|---------------|-------|
| Onboarding state | **Implemented** | `GET /onboarding/state` | `app/onboarding/page.tsx` | KYC state machine |
| Start KYC session | **Implemented** | `POST /kyc/session` | Same page | Returns KYC provider URL |
| KYC webhook | **Implemented** | `POST /webhooks/kyc` | N/A | HMAC-verified |

## 15. Static/Landing Pages

| Feature | Status | Frontend Page | Notes |
|---------|--------|---------------|-------|
| Landing | **Implemented** | `app/page.tsx` | Hero, testimonials, CTA |
| About | **Implemented** | `app/about/page.tsx` | |
| Pricing | **Implemented** | `app/pricing/page.tsx` | |
| How It Works | **Implemented** | `app/how-it-works/page.tsx` | |
| Features | **Implemented** | `app/features/[feature]/page.tsx` | Dynamic route |
| Compare | **Implemented** | `app/compare/page.tsx` + `[competitor]` | |
| For niche | **Implemented** | `app/for/[niche]/page.tsx` | SEO landing pages |
| Terms | **Implemented** | `app/terms/page.tsx` | |
| Privacy | **Implemented** | `app/privacy/page.tsx` | |
| Help | **Implemented** | `app/help/page.tsx` | |
| Contact | **Implemented** | `app/contact/page.tsx` | |

---

## E2E Testability Assessment

### Can test NOW (no bypasses needed)
- Health checks (API + web)
- Fan signup + login + logout (API + UI)
- Creator signup + login (API + UI)
- Creator/post discovery (GET endpoints)
- Search (posts + creators)
- All static pages load (no 500s)
- Feed (auth-gated)
- Billing health/status endpoints
- Admin endpoints (with admin user)

### Requires E2E bypass
- **Email verification**: Real email not receivable in CI. **Existing `/auth/dev/tokens` endpoint** returns verification tokens in non-production. No E2E_SECRET guard needed since it's already env-gated.
- **Stripe checkout**: Hosted checkout can't be automated. Need `STRIPE_WEBHOOK_TEST_BYPASS=true` + simulated webhook to activate subscription.
- **Admin user creation**: No self-service admin signup. Need DB seed or `/__e2e__/auth/force-role` endpoint.

### Requires feature flags enabled
- Likes/comments: `ENABLE_LIKES=true`, `ENABLE_COMMENTS=true`
- Notifications: `ENABLE_NOTIFICATIONS=true`
- PPV: `ENABLE_PPV_POSTS=true`, `ENABLE_PPVM=true`
- Vault: `ENABLE_VAULT=true`
- Scheduled posts: `ENABLE_SCHEDULED_POSTS=true`

### Missing (documented but not implemented)
- Earnings dashboard frontend page
- Creator plan management frontend page
- Post edit page (update endpoint exists, no UI)
- Video streaming / HLS
- Live streaming
- Referral program
- Affiliate links
- Subscription tiers (multi-tier)
- Analytics dashboard
