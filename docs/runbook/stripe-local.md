# Stripe local setup (zinovia-fans)

Production-quality runbook for running Stripe subscription flows locally (checkout + webhook).

## Prerequisites

- **Stripe account** in [test mode](https://dashboard.stripe.com/test/dashboard)
- **Stripe CLI** [installed](https://stripe.com/docs/stripe-cli#install) and [logged in](https://stripe.com/docs/stripe-cli#login): `stripe login`
- Stack running: `make up` and `make migrate` (see [Local development](local-dev.md))

## Local URLs

| Service | URL |
|--------|-----|
| Web (Next.js) | http://localhost:3000 |
| API (FastAPI) | http://localhost:8000 |

## Required env vars (local)

Set these in the backend env (e.g. root `.env` or `apps/api/.env` used by Docker Compose):

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Test secret key from [Stripe Dashboard → API keys](https://dashboard.stripe.com/test/apikeys), e.g. `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | For local: the signing secret from `stripe listen` (see below), e.g. `whsec_...` |
| `CHECKOUT_SUCCESS_URL` | `http://localhost:3000/billing/success` |
| `CHECKOUT_CANCEL_URL` | `http://localhost:3000/billing/cancel` |

Optional:

- `STRIPE_WEBHOOK_TEST_BYPASS` – set to `true` **only in test env** (pytest) to skip signature verification. Do **not** enable in production or when using Stripe CLI locally.

## Step-by-step

### a) Start stack and DB

```bash
make up
make migrate
```

Ensure the API is reachable at http://localhost:8000 (e.g. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health`).

### b) Run Stripe webhook listener

In a **separate terminal**:

```bash
stripe listen --forward-to http://localhost:8000/billing/webhooks/stripe
```

- The CLI forwards Stripe events to your local API.
- Copy the **webhook signing secret** printed in the output (e.g. `whsec_xxxxxxxx`). You will need it in the next step.

### c) Set webhook secret and restart API

1. Set `STRIPE_WEBHOOK_SECRET` in your backend env to the `whsec_...` value from step (b).
2. Restart the API so it picks up the new value (e.g. `docker compose restart api` or restart the process that runs the API).

### d) Trigger via UI (recommended)

1. Open http://localhost:3000 and sign up / log in.
2. Create a creator (set handle via profile/settings).
3. As a different user (fan), go to the creator’s profile and click **Subscribe**.
4. Complete Stripe Checkout with test card `4242 4242 4242 4242` (any future expiry, any CVC).
5. After payment, Stripe sends events to your webhook; verify subscription in DB and that the fan can see SUBSCRIBERS-only posts.

### e) Optional: CLI trigger (for event testing)

Use only for ad‑hoc event tests; payloads may not match your DB:

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
```

For full flow testing, use the UI and a real checkout (step d).

## Debug tips

- **Where to inspect logs**  
  API: `docker compose logs -f api` (or the terminal where the API runs). Webhook requests and errors appear there.

- **Invalid signature (400)**  
  - Ensure `STRIPE_WEBHOOK_SECRET` matches the secret shown by `stripe listen` for the forward URL.  
  - Restart the API after changing the secret.

- **Webhook not reached**  
  - If the API runs in Docker, use a URL the host can reach (e.g. `http://host.docker.internal:8000/billing/webhooks/stripe` on Mac/Windows).  
  - If the API runs on the host, `http://localhost:8000/billing/webhooks/stripe` is correct.

- **501 “Stripe not configured”**  
  - Checkout: set `STRIPE_SECRET_KEY` to a valid test key (and restart API).  
  - Webhook: set `STRIPE_WEBHOOK_SECRET` from `stripe listen` (and restart API).

- **Idempotency**  
  The webhook handler stores each Stripe event by `event_id`. Duplicate events (e.g. replay) are acknowledged with `duplicate_ignored` and not processed again.

## How to run `stripe listen` for localhost

From the host machine (where Stripe CLI runs), forward to the API that serves the webhook:

```bash
stripe listen --forward-to http://localhost:8000/billing/webhooks/stripe
```

If the API runs inside Docker and the CLI is on the host, use the URL your host uses to reach the API (e.g. `http://localhost:8000/...` if port 8000 is published). On Mac/Windows, if the API container is only reachable via host networking, use `http://host.docker.internal:8000/billing/webhooks/stripe` from the host so the CLI can reach the container.

## Full E2E test (Checkout → Webhook → ACTIVE → unlock SUBSCRIBERS posts)

1. **Start stack**
   ```bash
   make up
   make migrate
   ```

2. **Run Stripe webhook listener**
   In a separate terminal:
   ```bash
   stripe listen --forward-to http://localhost:8000/billing/webhooks/stripe
   ```
   Copy the `whsec_...` secret into your backend env as `STRIPE_WEBHOOK_SECRET` and restart the API.

3. **Create SUBSCRIBERS post as creator**
   - Open http://localhost:3000, sign up as a creator, set a handle (e.g. `/settings/profile` or PATCH `/creators/me`).
   - Create a post with visibility **SUBSCRIBERS** (e.g. from creator post creation flow or API).

4. **Subscribe as fan via UI**
   - Sign up / log in as a **different** user (fan).
   - Go to the creator’s profile `/creators/{handle}`.
   - Click **Subscribe** → complete Stripe Checkout with test card `4242 4242 4242 4242`.

5. **Confirm webhook received**
   - In the terminal where `stripe listen` is running, you should see events forwarded (e.g. `checkout.session.completed`, `invoice.paid`).
   - In API logs: `docker compose logs -f api` (or your API process). Look for 200 responses to `/billing/webhooks/stripe` and no 4xx/5xx.

6. **Confirm DB subscription row ACTIVE**
   - From the API container:
     ```bash
     docker compose exec api sh -c "cd /app/apps/api && python -m app.tools.print_subscriptions"
     ```
   - You should see a row with `status=active`, `active_effective=True` for the fan/creator pair.

7. **Confirm fan can see SUBSCRIBERS posts**
   - As the fan, open:
     - **GET /creators/{handle}/posts** (creator profile posts) → the SUBSCRIBERS post appears.
     - **GET /feed** (or http://localhost:3000/feed) → the SUBSCRIBERS post appears in the feed (fan must follow the creator for the post to be in feed; subscription unlocks visibility).

**Where to look in logs/DB**

- **Logs:** `docker compose logs api` or the process stdout. Webhook handler returns 200 and logs only on missing metadata or missing fan/creator mapping (warning).
- **DB:** Table `subscriptions`. Script: `python -m app.tools.print_subscriptions` (run inside API container or with `DATABASE_URL` set). Check `status = 'active'` and `current_period_end` null or in the future.
- **Idempotency:** Re-sending the same Stripe event (same `event.id`) returns 200 with `status: "duplicate_ignored"` and does not change subscriptions or create duplicate rows.
