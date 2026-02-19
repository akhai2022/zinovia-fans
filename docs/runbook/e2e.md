# Zinovia Fans — E2E Test Runbook

## Quick Start

### Prerequisites
- Node.js 20+
- Playwright browsers installed: `npx playwright install chromium`
- Access to production or local stack

### Run Smoke Tests (bash, no browser needed)

```bash
# Against production
bash scripts/qa/smoke.sh https://api.zinovia.ai https://zinovia.ai

# Against local
bash scripts/qa/smoke.sh http://localhost:8000 http://localhost:3000
```

### Run Playwright E2E Tests

```bash
cd apps/web

# Against production
PLAYWRIGHT_BASE_URL=https://zinovia.ai API_BASE_URL=https://api.zinovia.ai npx playwright test

# Against local
PLAYWRIGHT_BASE_URL=http://localhost:3000 API_BASE_URL=http://localhost:8000 npx playwright test

# Run specific test file
npx playwright test e2e/01-health.spec.ts

# With headed browser (debug)
npx playwright test --headed

# View HTML report
npx playwright show-report
```

### Run Full Stability Suite

```bash
bash scripts/qa/stability-runner.sh [api-base] [web-base]
```

## Test Structure

| File | Coverage |
|------|----------|
| `e2e/01-health.spec.ts` | API health, web health, CORS, billing health |
| `e2e/02-auth.spec.ts` | Fan signup, creator signup, login, logout, negative auth |
| `e2e/03-discovery.spec.ts` | Creator listing, search, profile pages, post listing |
| `e2e/04-media-posts.spec.ts` | Upload URLs, post creation, PPV validation |
| `e2e/05-billing.spec.ts` | Billing status, checkout flow, PPV access control |
| `e2e/06-feed-ux.spec.ts` | Feed for auth/anon, public pages, settings |
| `scripts/qa/smoke.sh` | Curl-based smoke tests (no browser) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PLAYWRIGHT_BASE_URL` | `http://localhost:3000` | Web frontend URL |
| `API_BASE_URL` | `https://api.zinovia.ai` | API backend URL |
| `BASE_URL` | (fallback for PLAYWRIGHT_BASE_URL) | Alt web URL |

## Deployment Verification Checklist

After each deploy, run this checklist:

1. [ ] `curl https://api.zinovia.ai/health` returns `{"ok":true}`
2. [ ] `curl https://api.zinovia.ai/ready` returns 200
3. [ ] `curl https://zinovia.ai` returns 200
4. [ ] `bash scripts/qa/smoke.sh` — all pass
5. [ ] ECS services show running=desired:
   ```
   aws ecs describe-services --cluster zinovia-fans-prod-cluster \
     --services zinovia-fans-prod-api zinovia-fans-prod-web zinovia-fans-prod-worker \
     --query 'services[].{name:serviceName,running:runningCount,desired:desiredCount}' \
     --output table
   ```
6. [ ] Playwright E2E: `cd apps/web && PLAYWRIGHT_BASE_URL=https://zinovia.ai npx playwright test`

## Redeploying

```bash
# Build + push all 3 images
bash scripts/deploy/aws/build_and_push.sh

# Force new deployment
aws ecs update-service --cluster zinovia-fans-prod-cluster --service zinovia-fans-prod-api --force-new-deployment
aws ecs update-service --cluster zinovia-fans-prod-cluster --service zinovia-fans-prod-web --force-new-deployment
aws ecs update-service --cluster zinovia-fans-prod-cluster --service zinovia-fans-prod-worker --force-new-deployment

# Wait for stable (optional)
aws ecs wait services-stable --cluster zinovia-fans-prod-cluster --services zinovia-fans-prod-api zinovia-fans-prod-web zinovia-fans-prod-worker
```
