# E2E Test Matrix — Zinovia Fans

> Personas x Workflows. Each cell = test spec(s) to implement.

## Test ID Convention
`{nn}-{persona}-{workflow}.spec.ts` where nn = execution order.

---

## Matrix

| # | Spec File | Persona | Workflow | Happy Path | Negative Paths | Bypass Needed |
|---|-----------|---------|----------|------------|----------------|---------------|
| 01 | `01-health.spec.ts` | System | Baseline health | API /health, /ready, web homepage, CORS, billing health | API unreachable, web 500 | None |
| 02 | `02-auth-fan.spec.ts` | Fan | Signup + verify + login | POST /auth/signup → dev/tokens → POST /auth/verify-email → POST /auth/login → cookie set | 422 short password, 401 wrong creds, 409 duplicate email, unauthenticated /auth/me | dev/tokens |
| 03 | `03-auth-creator.spec.ts` | Creator | Signup + verify + onboarding | POST /auth/register → dev/tokens → verify → onboarding state | Missing idempotency key, invalid token | dev/tokens |
| 04 | `04-auth-password.spec.ts` | Fan | Password reset + change | forgot-password → dev/tokens → reset-password → login with new password, change-password | Invalid reset token, short password, wrong current password | dev/tokens |
| 05 | `05-discovery.spec.ts` | Anonymous | Creator discovery + search | GET /creators, search, creator profile page, posts list | Empty results, 404 handle | None |
| 06 | `06-public-pages.spec.ts` | Anonymous | Static pages | All public pages load HTTP 200, no crashes | N/A | None |
| 07 | `07-feed.spec.ts` | Fan | Feed access | Authenticated GET /feed, cursor pagination, locked teasers | 401 unauthenticated, empty feed | None |
| 08 | `08-posts-crud.spec.ts` | Creator | Post CRUD | Create TEXT post, update, delete; visibility levels | 403 non-creator, 422 invalid payload, PPV without price | force-role or dev/tokens |
| 09 | `09-billing.spec.ts` | Fan | Subscription checkout | POST /billing/checkout/subscription → (bypass) webhook → billing/status shows active | 422 missing creator_id, 501 stripe unconfigured, cancel subscription | Stripe webhook bypass |
| 10 | `10-messaging.spec.ts` | Fan+Creator | DMs | Create conversation, send text message, list messages | Rate limit, unauthorized access | Verified users |
| 11 | `11-collections.spec.ts` | Creator | Collection CRUD | Create, add post, list, update, delete | 403 non-creator, 404 not found | Verified creator |
| 12 | `12-media.spec.ts` | Creator | Media upload + vault | Request upload URL, batch URLs | Invalid content type, oversized file | Verified creator |
| 13 | `13-admin.spec.ts` | Admin | Moderation | List creators, action (verify/suspend), list posts, action (remove/restore), force-verify-email | 403 non-admin, 404 user not found | force-role |
| 14 | `14-notifications.spec.ts` | Fan | Notifications | List, mark read, mark all read | Feature disabled (404), 401 unauthenticated | ENABLE_NOTIFICATIONS |
| 15 | `15-ai-images.spec.ts` | Creator | AI generation | Generate request, list jobs, get job status | Rate limit, invalid params | Verified creator |
| 16 | `16-ppv.spec.ts` | Fan | PPV purchase | Create intent, check status | Feature disabled, already purchased | ENABLE_PPV_POSTS |
| 17 | `17-creator-plan.spec.ts` | Creator | Plan management | Get plan, update price | Non-creator 403, price out of bounds | Verified creator |
| 18 | `18-settings.spec.ts` | Any | Profile settings | Load profile page, update display_name | 401 unauthenticated | None |
| 19 | `19-cross-persona.spec.ts` | Multi | End-to-end flow | Creator creates post → Fan subscribes → Fan sees in feed | N/A | All bypasses |

---

## Negative Path Details

### Auth (401/403)
- Unauthenticated access to `/feed`, `/messages`, `/notifications`, `/settings/*`
- Fan accessing creator-only endpoints (`/posts`, `/collections`, `/billing/plan`)
- Non-admin accessing `/admin/*`
- Expired/invalid JWT token

### Validation (422)
- Short password (< 10 chars)
- Invalid email format
- Missing required fields (creator_id in checkout, idempotency-key in register)
- PPV post without price_cents
- Price out of bounds (plan update)

### Resource (404)
- Non-existent creator handle
- Non-existent post/collection/notification ID
- Feature-disabled endpoints return 404

### Rate Limiting (429)
- Login brute-force
- Password reset spam
- Message rate limit

### Service (501/503)
- Stripe not configured (billing endpoints)
- Feature flags disabled

---

## Bypass Mechanisms Required

| Mechanism | Purpose | Implementation |
|-----------|---------|----------------|
| `GET /auth/dev/tokens?email=` | Retrieve verification/reset tokens without email | **Already exists**, env-gated (non-production only) |
| `POST /__e2e__/auth/force-role` | Set user role to admin/creator for testing | **New endpoint needed**, behind E2E_ENABLE + E2E_SECRET |
| `POST /__e2e__/billing/activate-subscription` | Simulate Stripe webhook to activate subscription | **New endpoint needed**, behind E2E_ENABLE + E2E_SECRET |
| `POST /__e2e__/onboarding/force-state` | Set onboarding_state to KYC_APPROVED | **New endpoint needed**, behind E2E_ENABLE + E2E_SECRET |
| Feature flags in `.env.test` | Enable all feature-flagged features | Set `ENABLE_LIKES=true`, etc. in E2E env |

---

## Skip Policy

Tests that depend on missing features or disabled flags will be **skipped** (not failed) with a descriptive message. This ensures CI stays green while clearly documenting gaps.

```typescript
test("PPV post purchase", async () => {
  test.skip(!ENABLE_PPV_POSTS, "PPV posts feature flag is disabled");
  // ...
});
```
