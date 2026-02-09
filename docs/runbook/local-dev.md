# Local development

Quick reference for running zinovia-fans on your machine.

## Setup

1. **Copy `.env.example` to `.env`** at the repo root and set values (database, Stripe, etc.). Compose and Make targets use this file.
2. Run all **make** targets from the **repo root** so `--env-file .env` resolves correctly.
3. If Postgres was previously initialized with the wrong env (e.g. wrong user/password), you must **remove the Postgres volume and restart** so Postgres re-initializes with the current `.env`. See “Clean DB reset” below.

## Stack

- **make up** – start services (API, web, Postgres, Redis, MinIO, etc.)
- **make migrate** – run DB migrations
- **make down** – stop and remove containers (and volumes with `-v`)

See [MVP checklist](mvp-checklist.md) for full command list.

## Clean DB reset (remove Postgres volume)

If you see “role postgres does not exist” or Postgres was initialized with different env, reset the DB and start fresh:

```bash
make down
docker volume ls | grep zinovia
# Remove the postgres volume for this project (it will include "postgres" in the name)
docker volume rm <volume_name>
make up
make migrate
```

Replace `<volume_name>` with the actual volume from the list (e.g. `compose_pgdata` when using the default compose file).

## Web: "Cannot find module './135.js'" (or similar)

This is a **stale Next.js build cache**: the `.next` directory (in the `web_next` volume) has out-of-sync webpack chunks. Clear it and restart:

```bash
docker compose --env-file .env -f infra/compose/docker-compose.yml down
docker volume rm compose_web_next 2>/dev/null || true
# Or list and remove the correct volume: docker volume ls | grep web_next
make up
```

If your compose project name differs, the volume may be named `<project>_web_next`. Use `docker volume ls` to find it.

## URLs

- Web: http://localhost:3000  
- API: http://localhost:8000  

## Feed and auth (browser)

The web app calls the API from the **browser** (not from the Next server). The browser must reach the API at a URL it can access (e.g. `http://localhost:8000`), not Docker-internal hostnames like `http://api:8000`.

### Env vars for local

- **Web** (apps/web):  
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`  
  - If unset, the app defaults to `http://localhost:8000` so feed and auth work without setting it.
- **API** (apps/api):  
  - `CORS_ORIGINS=http://localhost:3000` (default) so the API allows credentialed requests from the web origin.

When running **web in Docker** (e.g. `make up`), the compose file already sets `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` for the web service so the browser uses the correct API URL.

**Auth:** Cookie-based. Login sets an `access_token` cookie (HttpOnly, SameSite=Lax, Secure=false locally). The OpenAPI client is configured with `credentials: "include"` so all API requests from the browser send this cookie.

### How to confirm in DevTools

1. **Feed request URL:** Open DevTools → Network. Sign in, then go to `/feed`. Find the request to `/feed` (or `feed?page=1&page_size=20`). The **Request URL** should be `http://localhost:8000/feed` (not `localhost:3000` and not `api:8000`).
2. **Cookies:** In the same request, check **Request Headers**. You should see `Cookie: access_token=...` (or in Application → Cookies, an `access_token` for `localhost`).
3. **Response:** When logged in, the feed request should return **200** and JSON. When logged out, **401** and the feed page shows “Sign in to see your feed” with a Log in button.

### API base URL (single source of truth)

The API base URL is resolved in **`apps/web/lib/apiBase.ts`** (`getApiBaseUrl()`). All generated `@zinovia/contracts` clients use it via `OpenAPI.BASE` set in **`apps/web/lib/api.ts`**. In development the console logs the resolved URL once: `[zinovia-fans] API base URL: http://localhost:8000`. A **dev-only** diagnostics page is at **`/debug`**: it shows the resolved base URL and calls `GET /health` to confirm the API is reachable.

## Pages checklist (local, API up)

With `make up` and API healthy, confirm:

| Page | Expected |
|------|----------|
| `/` | Home loads. |
| `/creators` | Creator list loads (or “Sign in to see creators” if API requires auth; or “API unreachable” if API is down). |
| `/creators/[handle]` | Profile loads for an existing handle (or “Creator not found” / “Sign in” / “API unreachable” with Retry). |
| `/feed` | Logged out → “Sign in to see your feed” with Log in. Logged in → feed list or empty state. |
| `/debug` | (Dev only) Shows API base URL and /health status. |

Manual checks:

```bash
curl -s http://localhost:8000/health
# {"status":"ok"}

curl -s "http://localhost:8000/creators?page=1&page_size=10"
# JSON (may require cookie or return 401)

open http://localhost:3000/creators
# List loads or clear error (login / API unreachable)
```

## Stripe (subscriptions)

For local checkout and webhooks, configure Stripe test keys and the CLI. See **[Stripe local setup](stripe-local.md)** for:

- Required env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, checkout URLs)
- Step-by-step: `stripe listen`, set secret, trigger via UI or CLI
- Debug tips and idempotency notes

Without Stripe configured, the billing endpoints return **501** with a clear message; the rest of the app works.
