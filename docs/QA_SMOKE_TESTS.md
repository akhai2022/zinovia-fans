# PPV Message Unlocks QA Smoke Tests

This checklist validates PPV locked media in DMs without Celery/worker dependencies.

## Preconditions

- API deployed and reachable behind ALB.
- Stripe secrets configured in API task environment:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- Feature flag enabled in target environment:
  - `ENABLE_PPVM=true`

## Manual smoke flow

1. Create a creator account and a fan account.
2. Fan opens creator profile and clicks **Message**.
3. Creator opens the conversation, attaches media, enables **Lock media (PPV)**, sets `$5.00`, sends.
4. Fan sees locked media row with unlock CTA.
5. Fan clicks unlock and completes payment with Stripe test card:
   - `4242 4242 4242 4242`
6. Verify webhook receives `payment_intent.succeeded`.
7. Fan can now fetch and open `/dm/message-media/{id}/download-url`.
8. Fan cannot purchase same `message_media_id` again:
   - API returns `ALREADY_UNLOCKED`.
9. Non-participant user cannot:
   - list messages in the conversation,
   - send messages to it,
   - create intent for its message media,
   - fetch its download URL.

## API quick checks

```bash
# health
curl -i https://api.zinovia.ai/health
curl -i https://api.zinovia.ai/ready

# webhook route reachable (signature required; this checks route exists)
curl -i -X POST https://api.zinovia.ai/webhooks/stripe
```

## Required outcomes

- Locked message media remains inaccessible until purchase is `SUCCEEDED`.
- Creator always has access to locked media in their own conversation.
- Purchase unlock is durable across page refresh/relogin.
- Duplicate webhook events do not create duplicate state transitions.
- No secrets or full webhook payloads appear in logs.
