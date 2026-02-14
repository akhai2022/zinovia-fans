# QA Stripe Webhook (FastAPI on ECS)

Endpoint:

- `POST https://api.zinovia.ai/webhooks/stripe`

## Expected response behavior

- Invalid signature: `400` with `invalid_signature`
- Invalid JSON payload: `400` with `invalid_payload`
- Duplicate event id: `200` with `duplicate_ignored`
- Handled event: `200` with `processed`
- Unknown event type: `200` with `ignored`

## Stripe Dashboard checks

1. Use one destination only for this endpoint.
2. Ensure selected events include:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`

## Basic curl checks

```bash
curl -i https://api.zinovia.ai/health
curl -i -X POST https://api.zinovia.ai/webhooks/stripe
```

The second call should not return `404` (route exists). It should return `400` without valid Stripe signature.

## Log checks (CloudWatch)

Look for structured fields:

- `request_id`
- `stripe_event_id`
- `event_type`
- `outcome` (`processed|ignored|duplicate|invalid_signature`)

Example:

```bash
aws logs tail /ecs/zinovia-fans-prod-api --since 30m --region us-east-1 --format short | rg "stripe webhook"
```
