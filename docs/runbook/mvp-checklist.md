# MVP checklist

Quick commands and manual smoke checks for a clean deploy or after big changes.

## Commands

| Command | Purpose |
|---------|---------|
| `make up` | Start stack (API, web, Postgres, Redis, MinIO, etc.) |
| `make migrate` | Run DB migrations |
| `make api-test` | Run API test suite |
| `make gen-contracts` | Export OpenAPI from API and regenerate `@zinovia/contracts` |
| `make web-build` | Build Next.js web app |

Typical order after clone: `make up` → `make migrate` → (optional) `make seed` → `make api-test` and `make web-build`.

## Manual smoke routes

- **Auth:** `/signup`, `/login`
- **Feed:** `/feed` (authenticated)
- **Discover:** `/creators`
- **Creator profile:** `/creators/{handle}` (use a handle from discover)
- **Settings:** `/settings/profile` (creator profile edit)
- **Create post:** create post flow from creator UI
- **Upload image:** upload media and attach to post (if implemented)

Use an authenticated session (login first); for creator-only pages use a creator account.
