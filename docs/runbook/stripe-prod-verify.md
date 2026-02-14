# Stripe Production Verification (zinovia.ai)

This playbook verifies Stripe billing is production-ready for:

- Web: `https://zinovia.ai`
- API: `https://api.zinovia.ai`
- Webhook: `https://api.zinovia.ai/webhooks/stripe`

## 1) Confirm Stripe mode and key wiring

### API billing health (sanitized)

```bash
curl -sS "https://api.zinovia.ai/billing/health" | jq
```

Expected:

- `stripe_mode` is `live` in production.
- `stripe_configured` is `true`.
- `webhook_configured` is `true`.

### Validate API secrets are not test keys (without printing full values)

```bash
AWS_REGION=us-east-1
aws secretsmanager get-secret-value \
  --region "$AWS_REGION" \
  --secret-id "zinovia-fans-prod-stripe-secret-key" \
  --query SecretString --output text \
| awk '{ if ($0 ~ /^sk_live_/) print "OK: sk_live"; else if ($0 ~ /^sk_test_/) print "BAD: sk_test"; else print "BAD: unknown prefix" }'
```

For web publishable key, verify your deployment/build input is live:

```bash
echo "$STRIPE_PUBLISHABLE_KEY" | awk '{ if ($0 ~ /^pk_live_/) print "OK: pk_live"; else if ($0 ~ /^pk_test_/) print "BAD: pk_test"; else print "BAD: unknown/empty" }'
```

## 2) Validate checkout flow and subscription state

### Create checkout session as an authenticated fan

```bash
API_BASE="https://api.zinovia.ai"
TOKEN="<fan_jwt>"
CREATOR_HANDLE="<creator_handle>"
SUCCESS_URL="https://zinovia.ai/billing/success?return=%2Ffeed"
CANCEL_URL="https://zinovia.ai/billing/cancel?return=%2Fcreators"

curl -sS -X POST "$API_BASE/billing/checkout/subscription" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"creator_handle\":\"$CREATOR_HANDLE\",\"success_url\":\"$SUCCESS_URL\",\"cancel_url\":\"$CANCEL_URL\"}" | jq
```

Expected:

- HTTP `200`
- JSON contains `checkout_url` pointing to Stripe-hosted checkout.

### After successful checkout return, verify local subscription status

```bash
curl -sS "$API_BASE/billing/status" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Optional filter by creator:

```bash
CREATOR_USER_ID="<creator_user_uuid>"
curl -sS "$API_BASE/billing/status?creator_user_id=$CREATOR_USER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
```

## 3) Validate webhook delivery + idempotency

### API logs should show receives and processing

```bash
aws logs tail "/ecs/zinovia-fans-prod-api" --since 30m --region us-east-1 \
  --format short | rg "stripe webhook"
```

Expected:

- `stripe webhook received event_id=...`
- `stripe webhook processed event_id=...`
- Re-delivery of same event should show `duplicate_ignored` (or safe retry if previously unprocessed).

### SQL checks (subscriptions + stripe_events)

```sql
SELECT event_id, event_type, received_at, processed_at
FROM stripe_events
ORDER BY received_at DESC
LIMIT 50;
```

```sql
SELECT fan_user_id, creator_user_id, status, current_period_end, stripe_subscription_id, updated_at
FROM subscriptions
ORDER BY updated_at DESC
LIMIT 50;
```

Idempotency check for duplicates:

```sql
SELECT event_id, COUNT(*) AS n
FROM stripe_events
GROUP BY event_id
HAVING COUNT(*) > 1;
```

Expected: zero rows.

## 4) Validate paywalled media access rules

### Non-subscriber cannot access locked media URL

```bash
LOCKED_MESSAGE_MEDIA_ID="<message_media_uuid>"
NON_SUBSCRIBER_TOKEN="<fan_without_access_jwt>"

curl -i -sS \
  -H "Authorization: Bearer $NON_SUBSCRIBER_TOKEN" \
  "$API_BASE/dm/message-media/$LOCKED_MESSAGE_MEDIA_ID/download-url"
```

Expected: `403`/`404` (no signed URL).

### Authorized viewer can access signed URL

```bash
AUTHORIZED_TOKEN="<creator_or_unlocked_fan_jwt>"
curl -sS \
  -H "Authorization: Bearer $AUTHORIZED_TOKEN" \
  "$API_BASE/dm/message-media/$LOCKED_MESSAGE_MEDIA_ID/download-url" | jq
```

Expected: `download_url` present and short TTL.

## 5) Local/docker debugging shortcuts

```bash
# API logs
docker compose logs -f api

# Trigger local webhook test with Stripe CLI (if configured locally)
stripe listen --forward-to localhost:8000/webhooks/stripe
stripe trigger checkout.session.completed
```

## 6) Required production invariants

- Production uses only live Stripe keys (`sk_live_*`, `pk_live_*`).
- Webhook endpoint is public HTTPS and signature verification is enabled.
- `stripe_events.event_id` uniqueness enforces webhook idempotency.
- Subscription lifecycle updates are visible in `subscriptions` table and `/billing/status`.
