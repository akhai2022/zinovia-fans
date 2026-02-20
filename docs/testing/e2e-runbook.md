# E2E Test Runbook — Zinovia Fans

## Prerequisites

- Node.js >= 18
- Docker + Docker Compose (for local stack)
- Playwright browsers installed: `npx playwright install chromium`

## 1. Start the Local Stack

```bash
# From repo root — starts API, web, postgres, redis, minio
docker compose up -d

# Or start individually:
cd apps/api && uvicorn app.main:app --reload --port 8000
cd apps/web && npm run dev
```

## 2. Required Environment Variables

Create `.env.e2e` or export these before running tests:

```bash
# Web / Playwright
export WEB_BASE_URL=http://localhost:3000
export PLAYWRIGHT_BASE_URL=http://localhost:3000
export API_BASE_URL=http://127.0.0.1:8000

# E2E bypass (API side)
export E2E_ENABLE=1
export E2E_SECRET=e2e-dev-secret  # Must match what tests send

# Optional — enable feature-flagged features for full coverage
export ENABLE_LIKES=true
export ENABLE_COMMENTS=true
export ENABLE_NOTIFICATIONS=true
export ENABLE_VAULT=true
export ENABLE_SCHEDULED_POSTS=true
export ENABLE_PPV_POSTS=true
export ENABLE_PPVM=true

# Stripe (test mode) — optional, PPV/billing intent tests need it
export STRIPE_SECRET_KEY=sk_test_...
export STRIPE_WEBHOOK_SECRET=whsec_...
export STRIPE_WEBHOOK_TEST_BYPASS=true

# Email — console or mailpit for local
export MAIL_PROVIDER=console

# Storage — minio for local
export STORAGE=minio
export MINIO_ENDPOINT=localhost:9000
export MINIO_ACCESS_KEY=minioadmin
export MINIO_SECRET_KEY=minioadmin
export MINIO_BUCKET=zinovia-dev
```

## 3. Run E2E Tests

```bash
cd apps/web

# Run all tests
npm run e2e

# Run with UI mode (interactive)
npm run e2e:ui

# Run with debug mode (step-through)
npm run e2e:debug

# Run a specific test file
npx playwright test e2e/01-health.spec.ts

# Run tests matching a pattern
npx playwright test -g "fan signup"

# View HTML report after run
npm run e2e:report
```

## 4. Test Architecture

### Spec Files (execution order)

| File | Persona | What it tests |
|------|---------|---------------|
| `01-health.spec.ts` | System | API health, web homepage, CORS, billing health |
| `02-auth-fan.spec.ts` | Fan | Signup, verify email, login, logout, negative cases |
| `03-auth-creator.spec.ts` | Creator | Register, verify email, onboarding state machine |
| `04-auth-password.spec.ts` | Any | Forgot password, reset password, change password |
| `05-discovery.spec.ts` | Anonymous | Creator list, search, profile pages |
| `06-public-pages.spec.ts` | Anonymous | All public pages load HTTP 200 |
| `07-feed.spec.ts` | Fan | Feed access, pagination, auth gating |
| `08-posts-crud.spec.ts` | Creator | Create/update/delete posts, visibility levels, PPV validation |
| `09-billing.spec.ts` | Fan | Subscription checkout, status, cancel |
| `10-messaging.spec.ts` | Fan+Creator | DM conversations, messages |
| `11-collections.spec.ts` | Creator | Collection CRUD, add/remove posts |
| `12-media.spec.ts` | Creator | Upload URLs, batch upload, vault |
| `13-admin.spec.ts` | Admin | Creator moderation, post moderation, force-verify |
| `14-notifications.spec.ts` | Fan | List, mark read (feature-flagged) |
| `15-ai-images.spec.ts` | Creator | Generate, list, get AI images |
| `16-ppv.spec.ts` | Fan | PPV post status, purchase intent |
| `17-creator-plan.spec.ts` | Creator | Get/update subscription plan |
| `18-settings.spec.ts` | Any | Profile settings, creator profile update |
| `19-cross-persona.spec.ts` | Multi | End-to-end: creator post -> fan subscribe -> feed |

### E2E Bypass Endpoints

These endpoints exist at `/__e2e__/*` and require:
- `E2E_ENABLE=1` in API environment
- `X-E2E-Secret` header matching `E2E_SECRET`
- Never available when `ENVIRONMENT=production`

| Endpoint | Purpose |
|----------|---------|
| `POST /__e2e__/auth/force-role?email=&role=` | Set user role (fan/creator/admin) |
| `POST /__e2e__/onboarding/force-state?email=&state=` | Set onboarding state |
| `POST /__e2e__/billing/activate-subscription?fan_email=&creator_email=` | Simulate subscription |
| `POST /__e2e__/cleanup?email_prefix=e2e+` | Delete test users |

Additionally, `GET /auth/dev/tokens?email=` returns verification/reset tokens (non-production only, no secret needed).

## 5. Troubleshooting

### API unreachable (fetch failed)
- Check API is running: `curl http://127.0.0.1:8000/health`
- Check CORS: `API_BASE_URL` must be in `CORS_ORIGINS`
- Check `CORS_ORIGINS` includes `http://localhost:3000`

### Cookies not set / 401 errors
- Ensure `COOKIE_SAMESITE=lax` (not `strict`) for local dev
- Ensure `COOKIE_SECURE=false` for HTTP (localhost)
- Check `COOKIE_DOMAIN` is not set (or matches localhost)

### CSRF 403 errors
- Auth endpoints (`/auth/*`) are exempt from CSRF
- E2E endpoints (`/__e2e__/*`) are exempt from CSRF
- For other POST/PATCH/DELETE: tests must include `X-CSRF-Token` header

### E2E endpoints return 404
- Ensure `E2E_ENABLE=1` in API env
- Ensure `E2E_SECRET` is set and matches test config
- Restart API after changing env vars

### DB migrations not run
- Migrations run automatically on API container start via `entrypoint.sh`
- Manually: `cd apps/api && python -m alembic upgrade head`

### Tests skip with "E2E bypass required"
- These tests need `E2E_ENABLE=1` on the API
- Without it, they gracefully skip

### Feature-flagged tests skip (404)
- Enable the feature flags: `ENABLE_LIKES=true`, etc.
- See "Required Environment Variables" section above

### Stripe-related tests fail
- Set valid test mode Stripe keys
- Or set `STRIPE_WEBHOOK_TEST_BYPASS=true` for local testing
- Billing intent tests will skip with "Stripe not configured" if no keys

## 6. CI Integration

```yaml
# GitHub Actions example
e2e:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_DB: zinovia_test
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
    redis:
      image: redis:7
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 20 }
    - run: npx playwright install chromium
    - run: npm ci
      working-directory: apps/web
    - run: npm run e2e
      working-directory: apps/web
      env:
        WEB_BASE_URL: http://localhost:3000
        API_BASE_URL: http://localhost:8000
        E2E_ENABLE: "1"
        E2E_SECRET: ci-e2e-secret
        DATABASE_URL: postgres://postgres:postgres@localhost:5432/zinovia_test
        REDIS_URL: redis://localhost:6379
```

## 7. Cleanup

Tests create users with `e2e+*@test.zinovia.ai` emails. To clean up:

```bash
# Via E2E endpoint
curl -X POST "http://127.0.0.1:8000/__e2e__/cleanup?email_prefix=e2e%2B" \
  -H "X-E2E-Secret: e2e-dev-secret"

# Or directly in DB
DELETE FROM users WHERE email LIKE 'e2e+%@test.zinovia.ai';
```
