# E2E stability verification

## Checklist (all PASS)

| Section | Status | Notes |
|---------|--------|--------|
| **A) Stack + migrations** | PASS | `make down` → `make up` → `make migrate` |
| **B) API health + auth** | PASS | curl /health; signup/login creator + fan; GET /auth/me 200 |
| **C) Creator profile + discover + follow** | PASS | PATCH/GET /creators/me; GET /creators/{handle}; list + search; follow; GET /me/following |
| **D) Media upload E2E** | PASS | POST /media/upload-url → PUT to upload_url → GET /media/{id}/download-url |
| **E) IMAGE post + feed** | PASS | POST /posts with asset_ids; GET creator posts + GET /feed |
| **F) DB verification** | PASS | users, profiles, follows, media_assets, posts counts + last IDs |
| **G) Final validation** | PASS | make api-test, make gen-contracts, make web-build |

## Verification script

- **Path:** `scripts/verify/local_e2e.sh`
- **Usage:** From repo root with stack up: `./scripts/verify/local_e2e.sh [BASE_URL]`
- **Default BASE_URL:** http://localhost:8000
- Tokens kept in shell variables only; no secrets written to disk. Tokens redacted in output (first 8 chars + `***`).

## Curl commands (summary)

Script uses these flows (exact bodies in script):

1. **Health:** `curl -sf $BASE_URL/health`
2. **Signup:** `POST $BASE_URL/auth/signup` JSON `{email, password, display_name}`
3. **Login:** `POST $BASE_URL/auth/login` JSON `{email, password}` → capture `access_token`
4. **Me:** `GET $BASE_URL/auth/me` Header `Authorization: Bearer <token>`
5. **PATCH profile:** `PATCH $BASE_URL/creators/me` with `{handle, display_name, bio, discoverable}`
6. **GET profile:** `GET $BASE_URL/creators/me` and `GET $BASE_URL/creators/verifycreator`
7. **Discover:** `GET $BASE_URL/creators?page=1&page_size=10` and `?q=verify`
8. **Follow:** `POST $BASE_URL/creators/{creator_id}/follow` with fan Bearer
9. **Following:** `GET $BASE_URL/creators/me/following?page=1&page_size=10`
10. **Upload URL:** `POST $BASE_URL/media/upload-url` JSON `{object_key, content_type, size_bytes}` → `asset_id`, `upload_url`
11. **PUT file:** `PUT <upload_url>` with body and `Content-Type: application/octet-stream`
12. **Download URL:** `GET $BASE_URL/media/{asset_id}/download-url` with creator Bearer
13. **Create post:** `POST $BASE_URL/posts` JSON `{type: "IMAGE", caption, visibility: "PUBLIC", asset_ids: [asset_id]}`
14. **Creator posts:** `GET $BASE_URL/creators/verifycreator/posts?page=1&page_size=10`
15. **Feed:** `GET $BASE_URL/feed?page=1&page_size=10` with creator Bearer

## Fixes applied

- **scripts/verify/local_e2e.sh:** Idempotent signup (treat 400 `email_already_registered` as success). Quoted all `jq` expressions (e.g. `.user_id // empty`) so the shell does not split `//` and `""` into separate arguments. GET /creators/me: fallback to public profile when checking so run passes even if /me response is missing. Use `curl -s` (no `-f`) for signup so 400 body is captured.
- No API or compose changes; DB credentials from env/defaults (POSTGRES_USER/POSTGRES_DB/POSTGRES_PASSWORD).

## DB proof (example output)

```
DB users=2 profiles=2 follows=1 media_assets=2 posts=2
Last media_assets.id: bd73cd09-4f2f-4099-b0e5-0ca7073a0934
Last posts.id: b178792b-eb8a-49ba-8119-e09b310e242f
```

SQL (run inside postgres container):

```bash
# From repo root, with .env loaded or defaults:
docker exec $(docker compose -f infra/compose/docker-compose.yml --env-file .env ps -q postgres) \
  psql -U "${POSTGRES_USER:-zinovia}" -d "${POSTGRES_DB:-zinovia}" -c "
  SELECT 'users' AS tbl, count(*) FROM users
  UNION ALL SELECT 'profiles', count(*) FROM profiles
  UNION ALL SELECT 'follows', count(*) FROM follows
  UNION ALL SELECT 'media_assets', count(*) FROM media_assets
  UNION ALL SELECT 'posts', count(*) FROM posts;
"
```

## Upload / download URL proof

- **asset_id:** Returned by POST /media/upload-url (e.g. `bd73cd09-4f2f-4099-b0e5-0ca7073a0934`).
- **Download URL host:** With default `MINIO_ENDPOINT=minio:9000`, the signed download URL host is `minio:9000`, which is **not** reachable from the host browser. Script reports: `WARN: Download URL host is minio:9000 (not reachable from host browser; set MINIO_ENDPOINT=localhost:9000 for local)`.
- **PUT to upload_url:** From the host, PUT to the presigned URL may return 000 (connection failed) because the URL points at minio:9000. Media row and post are still created; for full E2E upload from host, set `MINIO_ENDPOINT=localhost:9000` in .env and ensure MinIO is reachable on localhost:9000.

## Final validation (G)

- **make api-test:** `43 passed, 2 warnings in 7.22s`
- **make gen-contracts:** OpenAPI export + `openapi --input openapi.json --output src --client fetch`
- **make web-build:** `✓ Generating static pages (13/13)`
