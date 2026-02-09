# Release gate and smoke checklist

## Release gate (automated)

Run from repo root with stack up (`make up`). All must pass before release.

| Command | Status | Final log line |
|--------|--------|-----------------|
| `make migrate` | PASS | `Running upgrade ... -> 0006_billing_webhook_metadata` |
| `make api-test` | PASS | `43 passed, 2 warnings in 6.78s` |
| `make gen-contracts` | PASS | `openapi --input openapi.json --output src --client fetch` (exit 0) |
| `make web-build` | PASS | `✓ Generating static pages (13/13)` / Next.js build success |

### Fix applied during gate (2026-02-07)

- **api-test failure:** `test_visibility_followers_visible_to_follower` expected 0 items for anon when only post is FOLLOWERS. Default `include_locked=true` now returns a locked teaser. **Fix:** Request with `include_locked=False` for the anon assertion so locked posts are hidden when not requesting teasers. File: `apps/api/tests/test_posts.py`.

---

## Manual smoke checklist

Run with stack up and web dev server (e.g. `make up` then ensure web is serving on port 3000, or run `npm run dev` in apps/web). Base URL: http://localhost:3000.

### A) Web

| Check | Result | Notes |
|-------|--------|-------|
| `/login` works | _Manual_ | Page loads; sign-in form works |
| `/signup` works | _Manual_ | Page loads; registration works |
| `/creators` shows list | _Manual_ | Discoverable creators listed |
| `/creators/<handle>`: unlocked thumbnails for PUBLIC posts | _Manual_ | IMAGE posts with asset_ids show thumbnails |
| `/creators/<handle>`: locked tiles for FOLLOWERS/SUBSCRIBERS (pre-follow/subscribe) | _Manual_ | Placeholder + overlay "Follow to unlock" / "Subscribe to unlock"; no images |
| After follow/subscribe, locked posts become unlocked | _Manual_ | Same posts show thumbnails/full content (subscribe may require DB test if Stripe not configured) |

### B) Media

| Check | Result | Notes |
|-------|--------|-------|
| Upload image post (unlocked) displays on feed + creator page | _Manual_ | Create PUBLIC IMAGE post; confirm on feed and creator profile |

### C) Auth

| Check | Result | Notes |
|-------|--------|-------|
| Cookie session works in browser (no forced Bearer) | _Manual_ | Login via UI; navigate to protected routes without re-auth |

---

## How to run smoke

1. `make up` (ensure web service is running; if not, start it).
2. Open http://localhost:3000.
3. Sign up / log in; open `/creators`, pick a creator, open `/creators/<handle>`.
4. Verify PUBLIC posts show thumbnails, FOLLOWERS/SUBSCRIBERS show locked tiles (pre-follow/subscribe).
5. Follow or subscribe (or insert subscription in DB for quick test); refresh and confirm locked posts unlock.
6. As creator, upload an image post (PUBLIC); confirm it appears on feed and creator page.
7. Confirm cookie session: close tab, reopen localhost; still logged in.

---

## Known issues / notes

- **api-test:** Requires migrated DB (`make up` then `make migrate` before `make api-test`). Without migrate, tests fail with `relation "users" does not exist`.
- **gen-contracts:** First command uses `exec` (api must be running). Redirect captures only stdout; `openapi.json` should stay valid.
- **Stripe:** If Stripe not configured, checkout returns 501; subscription state can be faked in DB for "locked → unlocked" smoke.
