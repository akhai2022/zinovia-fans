# Production Workflow: Signup → Verify Email → Onboarding → Subscription

## Overview

This document maps the implemented production workflow from current code paths.

## 1) Signup (creator account creation)

- **UI entrypoint:** `apps/web/app/signup/page.tsx`
- **Client API wrapper:** `apps/web/lib/onboardingApi.ts` → `registerCreator()`
- **Backend endpoint:** `POST /auth/register` in `apps/api/app/modules/auth/router.py` (`register()`)
- **Backend create logic:** `register_creator()` in `apps/api/app/modules/auth/service.py`
- **Email token creation:** `create_email_verification_token()` in `apps/api/app/modules/onboarding/service.py`
- **Verification email delivery:** `send_verification_email()` in `apps/api/app/modules/onboarding/mail.py`

### Request
- Body: `{ email, password }`
- Header: `Idempotency-Key` (required)

### Response
- `201`: `{ creator_id, verification_token?, email_delivery_status }`
  - `verification_token` returned only in console-mail mode (local/staging convenience).
  - `email_delivery_status`: `sent` or `failed`.

### Failure paths
- `400 email_already_registered`
- `409 idempotency_key_conflict`
- `5xx` unexpected backend failures

## 2) Email verification

- **UI entrypoint:** `apps/web/app/verify-email/page.tsx`
- Token source:
  - Query param: `/verify-email?token=...`
  - Or `sessionStorage` fallback from signup
- **Client API wrapper:** `verifyEmail()` in `apps/web/lib/onboardingApi.ts`
- **Backend endpoint:** `POST /auth/verify-email` in `apps/api/app/modules/auth/router.py` (`verify_email()`)
- **Token consume:** `consume_email_verification_token()` in `apps/api/app/modules/onboarding/service.py`
- **State transition:** `transition_creator_state(..., "EMAIL_VERIFIED", ...)`

### Request
- Body: `{ token }`
- Header: `Idempotency-Key` (required)

### Response
- `200`: `{ creator_id, state: "EMAIL_VERIFIED" }`

### Failure paths
- `400 invalid_or_expired_token`
- `400 invalid_state_for_verification`
- `409 idempotency_key_conflict`

## 3) Login/session

- **UI:** `apps/web/app/login/page.tsx`
- **Backend:** `POST /auth/login` in `apps/api/app/modules/auth/router.py` (`login()`)
- Session cookie is set from `_cookie_settings()`:
  - `Secure` from `COOKIE_SECURE`
  - `SameSite` from `COOKIE_SAMESITE`
  - `Domain` from `COOKIE_DOMAIN` (optional)
- Auth resolution:
  - cookie-first then bearer token in `apps/api/app/modules/auth/deps.py`

## 4) Onboarding status and KYC

- **UI:** `apps/web/app/onboarding/page.tsx`
- **Status endpoint:** `GET /onboarding/status` (`apps/api/app/modules/onboarding/router.py`)
- **Checklist derivation:** `get_onboarding_checklist()` in `apps/api/app/modules/onboarding/service.py`
- **Create KYC session:** `POST /kyc/session` (`apps/api/app/modules/onboarding/kyc_router.py`)
- **KYC state transitions:** `KYC_PENDING`, `KYC_APPROVED`, `KYC_REJECTED`

### States
- `CREATED`
- `EMAIL_VERIFIED`
- `KYC_PENDING`
- `KYC_SUBMITTED`
- `KYC_APPROVED`
- `KYC_REJECTED`

## 5) Subscription checkout and Stripe webhook

- **Creator page UI:** `apps/web/app/creators/[handle]/page.tsx`
- **Checkout button component:** `apps/web/features/billing/components/SubscribeCheckoutButton.tsx`
- **Client SDK call:** `BillingService.billingCheckoutSubscription()` from `@zinovia/contracts`
- **Backend checkout endpoint:** `POST /billing/checkout/subscription` in `apps/api/app/modules/billing/router.py`
- **Checkout creation logic:** `create_checkout_session()` in `apps/api/app/modules/billing/service.py`
- **Webhook endpoint:** `POST /billing/webhooks/stripe` (+ `/webhooks/stripe` alias)
- **Webhook processing:** `handle_stripe_event()` in billing service

### Stripe events handled
- `checkout.session.completed`
- `customer.subscription.created|updated|deleted`
- `invoice.paid`, `invoice.payment_failed`
- payment intent events for tips/PPV

## 6) Cookies, CORS, and frontend API base

- CORS middleware: `apps/api/app/main.py`
- Allowed origins source: `CORS_ORIGINS` env (`settings.cors_origins_list()`)
- Frontend API resolution:
  - `apps/web/lib/env.ts`
  - if `NEXT_PUBLIC_API_SAME_ORIGIN_PROXY=true` browser uses `/api`
  - rewrite in `apps/web/next.config.mjs` forwards `/api/:path*` to `NEXT_PUBLIC_API_BASE_URL`

## 7) Required production env vars

### API
- `DATABASE_URL`
- `JWT_SECRET`, `CSRF_SECRET`
- `COOKIE_SECURE=true`
- `COOKIE_SAMESITE=none`
- `CORS_ORIGINS=https://zinovia.ai,https://www.zinovia.ai,https://api.zinovia.ai`
- `APP_BASE_URL=https://zinovia.ai`
- `PUBLIC_WEB_BASE_URL=https://zinovia.ai`
- `MAIL_PROVIDER=ses`
- `MAIL_FROM=noreply@zinovia.ai`
- `AWS_REGION=us-east-1`
- `STRIPE_SECRET_KEY` (Secrets Manager)
- `STRIPE_WEBHOOK_SECRET` (Secrets Manager)

### Web
- `NEXT_PUBLIC_API_BASE_URL=https://api.zinovia.ai`
- `NEXT_PUBLIC_API_SAME_ORIGIN_PROXY=true`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`
