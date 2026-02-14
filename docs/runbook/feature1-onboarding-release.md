# Feature 1: Creator Onboarding — Release Checklist

## Pre-requisites

- AWS infra already deployed (networking, RDS, ECS, etc.)
- Backend: Python 3.12 + FastAPI + SQLAlchemy 2 + Alembic
- Frontend: Next.js App Router + TypeScript
- Required env vars set in Secrets Manager / ECS task definitions:
  - `DATABASE_URL`
  - `JWT_SECRET` (or JWT_PRIVATE_KEY/JWT_PUBLIC_KEY if asymmetric)
  - `KYC_WEBHOOK_HMAC_SECRET`
  - `APP_BASE_URL` (e.g. https://stg-app.zinovia.ai or https://app.zinovia.ai)
  - `API_BASE_URL` (e.g. https://stg-api.zinovia.ai)
  - `ENVIRONMENT` (staging | production)

## Staging Release

### 1. Apply migrations

```bash
# From repo root; migrations run inside API container
make migrate
# Or via ECS run-task (see docs/runbook/aws-deploy.md §3)
aws ecs run-task --cluster $CLUSTER --task-definition $TASK_DEF ...
```

Ensure migration `0009_creator_onboarding` is applied:

- `users` table: added `onboarding_state`, `country`, `explicit_intent`, `explicit_intent_locked`
- New tables: `email_verification_tokens`, `onboarding_audit_events`, `idempotency_keys`, `kyc_sessions`

### 2. Deploy backend

```bash
# Build and push API image
docker build -f infra/docker/api/Dockerfile -t $API_ECR:latest .
docker push $API_ECR:latest

# Force ECS to pull new image
aws ecs update-service --cluster $CLUSTER --service zinovia-fans-staging-api --force-new-deployment
```

### 3. Smoke test endpoints

```bash
# Health
curl -s https://stg-api.zinovia.ai/health | jq

# Register (creator onboarding)
curl -s -X POST https://stg-api.zinovia.ai/auth/register \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"email":"smoke@test.com","password":"password123456"}' | jq

# Verify-email (use token from register response)
curl -s -X POST https://stg-api.zinovia.ai/auth/verify-email \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"token":"<verification_token>"}' | jq
```

### 4. Deploy frontend

```bash
docker build -f infra/docker/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://stg-api.zinovia.ai \
  -t $WEB_ECR:latest .
docker push $WEB_ECR:latest

aws ecs update-service --cluster $CLUSTER --service zinovia-fans-staging-web --force-new-deployment
```

### 5. Verify flows

1. **Signup → Verify → Onboarding**
   - Open https://stg-app.zinovia.ai/signup
   - Register with email + password (≥10 chars)
   - Copy verification token from response (or check console in dev)
   - Go to /verify-email, paste token, verify
   - Sign in at /login, should redirect to /onboarding
   - Click "Start verification", redirect to /mock-kyc
   - Click "Approve", return to /onboarding
   - Checklist should show all done

2. **CloudWatch logs**
   - Check API logs for structured JSON (`request_id`, no PII)
   - Confirm no error spikes after deploy

## Production Release

1. Apply migrations to prod RDS
2. Set `KYC_WEBHOOK_HMAC_SECRET` in prod Secrets Manager (use strong secret)
3. Deploy backend
4. Smoke test (register, verify, login)
5. Deploy frontend with `NEXT_PUBLIC_API_BASE_URL=https://api.zinovia.ai`
6. **Note:** `/mock-kyc` is disabled in production (404 or "Not available"); real KYC provider will be added in Feature 2.

## Idempotency Key TTL Cleanup

`idempotency_keys` rows expire via `expires_at`. Optional: add a periodic task (cron, Celery beat) to delete expired rows:

```sql
DELETE FROM idempotency_keys WHERE expires_at < NOW();
```

Or rely on a future scheduled job if one exists in the stack.
