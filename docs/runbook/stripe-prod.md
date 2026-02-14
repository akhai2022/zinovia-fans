# Stripe Production Runbook

## Required keys and mode

- API uses `STRIPE_SECRET_KEY` from Secrets Manager.
- Web uses `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- API startup logs stripe mode (`live` or `test`) without exposing key.

## Endpoints

- Checkout: `POST /billing/checkout/subscription`
- Webhook: `POST /billing/webhooks/stripe`
- Alias webhook: `POST /webhooks/stripe`
- Health/config sanity: `GET /billing/health`

## Stripe Dashboard settings

1. Set webhook endpoint:
   - `https://api.zinovia.ai/billing/webhooks/stripe`
2. Subscribe to events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - (optional existing tips/PPV events)
3. Copy webhook signing secret into:
   - AWS Secrets Manager: `...-stripe-webhook-secret`

## Validation checklist

1. `curl -i https://api.zinovia.ai/billing/health`
2. Ensure `stripe_mode` is `live` in production.
3. Start subscription from creator page and verify redirect to Stripe Checkout.
4. Complete payment and verify:
   - Stripe dashboard event delivered with `200`
   - subscription row updated in API DB
   - user lands on `/billing/success`

## Troubleshooting

- If checkout returns 501:
  - verify `STRIPE_SECRET_KEY` secret value and API rollout.
- If webhook fails signature:
  - verify `STRIPE_WEBHOOK_SECRET` matches dashboard endpoint secret.
- If browser shows API unreachable:
  - verify CORS and `/api` proxy env (`NEXT_PUBLIC_API_SAME_ORIGIN_PROXY=true`).
