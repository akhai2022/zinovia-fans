# Stripe Webhook Secret Rotation (Production)

This project supports webhook signing secret rotation with two env vars:

- `STRIPE_WEBHOOK_SECRET` (primary/current)
- `STRIPE_WEBHOOK_SECRET_PREVIOUS` (optional fallback during rotation window)

The API verifies signatures against the primary secret first, then the previous secret.

## Rotation procedure

1. In Stripe Dashboard, create/roll webhook signing secret for the same endpoint:
   - `https://api.zinovia.ai/webhooks/stripe`
2. Update Secrets Manager values:
   - Set `STRIPE_WEBHOOK_SECRET` to the new `whsec_...`
   - Set `STRIPE_WEBHOOK_SECRET_PREVIOUS` to the old `whsec_...`
3. Redeploy API ECS service (force new deployment).
4. Verify webhook deliveries are successful in Stripe and API logs.
5. After stable period, remove previous secret:
   - Set `STRIPE_WEBHOOK_SECRET_PREVIOUS` to empty
   - Redeploy API.

## Notes

- Do not configure two Stripe webhook destinations with different signing secrets to the same URL.
- Never log webhook secrets or request payload bodies.
