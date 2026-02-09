# API overview

Short reference for API semantics and main routes. See OpenAPI (e.g. `/openapi.json`) for full schemas.

## Authentication

- **Cookie-first, optional Bearer.** The API accepts either a session cookie (`access_token`, set by `POST /auth/login`) or `Authorization: Bearer <token>`. Typical web app: login sets the cookie; server-rendered or same-origin requests use the cookie. Mobile or external clients use Bearer.
- Unauthenticated requests to protected routes return **401**.

## “Me” endpoints

| Route | Semantics |
|-------|-----------|
| **GET /auth/me** | Current authenticated user (any role). Returns user + profile. Use for “who is logged in” and role (e.g. fan vs creator). |
| **GET /creators/me** | Current user’s **creator** profile. **Creator role only**; fans get 403. Use for settings prefill and creator dashboard. |
| **GET /creators/me/following** | Paginated list of creators the **current user** follows. Authenticated user required. |

## Creator profile routes

| Route | Semantics |
|-------|-----------|
| **GET /creators/{handle}** | Public creator profile by handle (discoverable creators only). Optional auth: when present, `is_following` and visibility are contextual. |
| **GET /creators/{handle}/posts** | Creator’s posts, paginated. Visibility: PUBLIC to all; FOLLOWERS to followers (or creator); SUBSCRIBERS to creator only (no subscriber view in this endpoint). Optional auth for visibility filtering. |

## Admin / internal endpoints

- **POST /ledger/entries** — **Admin-only.** Creates a ledger entry (internal tooling, e.g. balance adjustments). Not used by the web app; requires admin role.
