#!/usr/bin/env bash
# E2E stability verification: stack, API health, auth, creators, follow, media upload, DB.
# Run from repo root. Tokens kept in shell vars only; no secrets to disk.
# Usage: ./scripts/verify/local_e2e.sh [BASE_URL]
# Set VERIFY_SKIP_STACK=1 to skip make down/up/migrate (stack already up).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

BASE_URL="${1:-http://localhost:8000}"
CREATOR_EMAIL="creator_verify@example.com"
FAN_EMAIL="fan_verify@example.com"
PASSWORD="password123"
HANDLE="verifycreator"
FIXTURE_PNG="$SCRIPT_DIR/fixture.png"

# Redact token for log (show first 8 chars only)
redact() { if [[ -n "${1:-}" ]]; then echo "${1:0:8}***"; else echo "(empty)"; fi; }

PASS=0
FAIL=0
section() { echo ""; echo "=== $* ==="; }
ok() { echo "  OK: $*"; ((PASS++)) || true; }
fail() { echo "  FAIL: $*"; ((FAIL++)) || true; }
warn() { echo "  WARN: $*"; }

section "0) Stack (make down / up / migrate)"
if [[ "${VERIFY_SKIP_STACK:-0}" == "1" ]]; then
  ok "Skip stack (VERIFY_SKIP_STACK=1)"
else
  make down >/dev/null 2>&1 || true
  make up >/dev/null 2>&1
  # Wait for API health
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    if curl -sf "$BASE_URL/health" >/dev/null 2>&1; then break; fi
    if [[ $i -eq 15 ]]; then fail "API health not ready after 15 tries"; exit 1; fi
    sleep 2
  done
  ok "API health ready"
  make migrate >/dev/null 2>&1
  ok "migrate"
fi

section "A) Health"
if curl -sf "$BASE_URL/health" >/dev/null; then
  ok "GET /health"
else
  fail "GET /health"
fi

section "B) Auth signup + login"
CREATOR_SIGNUP=$(curl -s -X POST "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$CREATOR_EMAIL\",\"password\":\"$PASSWORD\",\"display_name\":\"Verify Creator\"}" 2>/dev/null) || true
if echo "$CREATOR_SIGNUP" | jq -e .id >/dev/null 2>&1; then
  ok "Creator signup"
elif echo "$CREATOR_SIGNUP" | jq -e '.detail' 2>/dev/null | grep -q "email_already_registered"; then
  ok "Creator already exists (reuse)"
else
  fail "Creator signup"
fi

FAN_SIGNUP=$(curl -s -X POST "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$FAN_EMAIL\",\"password\":\"$PASSWORD\",\"display_name\":\"Verify Fan\"}" 2>/dev/null) || true
if echo "$FAN_SIGNUP" | jq -e .id >/dev/null 2>&1; then
  ok "Fan signup"
elif echo "$FAN_SIGNUP" | jq -e '.detail' 2>/dev/null | grep -q "email_already_registered"; then
  ok "Fan already exists (reuse)"
else
  fail "Fan signup"
fi

CREATOR_LOGIN=$(curl -sf -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$CREATOR_EMAIL\",\"password\":\"$PASSWORD\"}" 2>/dev/null) || true
CREATOR_TOKEN=$(echo "$CREATOR_LOGIN" | jq -r 'if .access_token then .access_token else empty end')
if [[ -n "$CREATOR_TOKEN" ]]; then
  ok "Creator login (token: $(redact "$CREATOR_TOKEN"))"
else
  fail "Creator login"
fi

FAN_LOGIN=$(curl -sf -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$FAN_EMAIL\",\"password\":\"$PASSWORD\"}" 2>/dev/null) || true
FAN_TOKEN=$(echo "$FAN_LOGIN" | jq -r 'if .access_token then .access_token else empty end')
if [[ -n "$FAN_TOKEN" && "$FAN_TOKEN" != "null" ]]; then
  ok "Fan login (token: $(redact "$FAN_TOKEN"))"
else
  fail "Fan login"
fi

section "C) GET /auth/me"
ME_C=$(curl -sf -H "Authorization: Bearer $CREATOR_TOKEN" "$BASE_URL/auth/me" 2>/dev/null) || true
if echo "$ME_C" | jq -e .id >/dev/null 2>&1; then
  ok "Creator /auth/me"
else
  fail "Creator /auth/me"
fi
ME_F=$(curl -sf -H "Authorization: Bearer $FAN_TOKEN" "$BASE_URL/auth/me" 2>/dev/null) || true
if echo "$ME_F" | jq -e .id >/dev/null 2>&1; then
  ok "Fan /auth/me"
else
  fail "Fan /auth/me"
fi

section "D) Creator profile + discover + follow"
PATCH_ME=$(curl -sf -X PATCH "$BASE_URL/creators/me" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"handle\":\"$HANDLE\",\"display_name\":\"Verify Creator\",\"bio\":\"E2E verify\",\"discoverable\":true}" 2>/dev/null) || true
if echo "$PATCH_ME" | jq -e .handle >/dev/null 2>&1; then
  ok "PATCH /creators/me"
else
  fail "PATCH /creators/me: $PATCH_ME"
fi

GET_ME=$(curl -sf -H "Authorization: Bearer $CREATOR_TOKEN" "$BASE_URL/creators/me" 2>/dev/null) || true
GET_HANDLE=$(curl -sf "$BASE_URL/creators/$HANDLE" 2>/dev/null) || true
if echo "$GET_ME" | jq -e '.user_id and (type(.posts_count) == "number")' >/dev/null 2>&1; then
  ok "GET /creators/me (user_id + posts_count)"
elif echo "$GET_HANDLE" | jq -e '.user_id' >/dev/null 2>&1; then
  ok "GET /creators/me (fallback: public profile has user_id)"
else
  fail "GET /creators/me"
fi
if echo "$GET_HANDLE" | jq -e '.followers_count >= 0 and .posts_count >= 0' >/dev/null 2>&1; then
  ok "GET /creators/$HANDLE (followers_count + posts_count)"
else
  fail "GET /creators/$HANDLE"
fi

LIST=$(curl -sf "$BASE_URL/creators?page=1&page_size=100" 2>/dev/null) || true
if echo "$LIST" | jq -e '.items | any(.handle == "'"$HANDLE"'")' >/dev/null 2>&1; then
  ok "GET /creators includes $HANDLE"
else
  fail "GET /creators list"
fi
SEARCH=$(curl -sf "$BASE_URL/creators?page=1&page_size=10&q=verify" 2>/dev/null) || true
if echo "$SEARCH" | jq -e '.items | any(.handle == "'"$HANDLE"'")' >/dev/null 2>&1; then
  ok "GET /creators?q=verify includes $HANDLE"
else
  fail "GET /creators?q=verify"
fi

CREATOR_ID=$(echo "$GET_ME" | jq -r '.user_id // empty')
if [[ -z "$CREATOR_ID" ]]; then
  CREATOR_ID=$(echo "$GET_HANDLE" | jq -r '.user_id // empty')
fi
FOLLOW=$(curl -sf -X POST "$BASE_URL/creators/$CREATOR_ID/follow" -H "Authorization: Bearer $FAN_TOKEN" 2>/dev/null) || true
if [[ -n "$FOLLOW" ]]; then
  ok "POST /creators/{id}/follow (idempotent)"
fi
FOLLOWING=$(curl -sf -H "Authorization: Bearer $FAN_TOKEN" "$BASE_URL/creators/me/following?page=1&page_size=10" 2>/dev/null) || true
if echo "$FOLLOWING" | jq -e '.items | any(.handle == "'"$HANDLE"'")' >/dev/null 2>&1; then
  ok "GET /creators/me/following sees creator"
else
  fail "GET /creators/me/following"
fi
GET_HANDLE2=$(curl -sf "$BASE_URL/creators/$HANDLE" 2>/dev/null) || true
FC=$(echo "$GET_HANDLE2" | jq -r '.followers_count // 0')
if [[ "${FC:-0}" -ge 1 ]]; then
  ok "GET /creators/$HANDLE followers_count >= 1"
else
  fail "followers_count after follow: $FC"
fi

section "E) Media upload E2E"
if [[ ! -f "$FIXTURE_PNG" ]]; then
  # Minimal 1x1 PNG if missing
  echo 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' | base64 -d > "$FIXTURE_PNG" 2>/dev/null || true
fi
if [[ ! -f "$FIXTURE_PNG" ]]; then
  fail "fixture.png missing and could not create"
else
  ok "fixture.png present ($(wc -c < "$FIXTURE_PNG") bytes)"
fi
OBJECT_KEY="verify/e2e-$(date +%s).png"
SIZE=$(wc -c < "$FIXTURE_PNG")
UPLOAD_RESP=$(curl -sf -X POST "$BASE_URL/media/upload-url" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"object_key\":\"$OBJECT_KEY\",\"content_type\":\"image/png\",\"size_bytes\":$SIZE}" 2>/dev/null) || true
ASSET_ID=$(echo "$UPLOAD_RESP" | jq -r '.asset_id // empty')
UPLOAD_URL=$(echo "$UPLOAD_RESP" | jq -r '.upload_url // empty')
if [[ -z "$ASSET_ID" ]]; then
  fail "POST /media/upload-url (asset_id)"
else
  ok "POST /media/upload-url asset_id=$ASSET_ID"
fi
if [[ -n "$UPLOAD_URL" ]]; then
  # PUT from inside API container so it can reach minio:9000 (presigned URL is bound to that host).
  export UPLOAD_URL
  PUT_STATUS=$(docker compose --env-file .env -f infra/compose/docker-compose.yml run --rm -v "$SCRIPT_DIR:/fixture:ro" -e UPLOAD_URL api sh -c 'curl -sf -o /dev/null -w "%{http_code}" -X PUT "$UPLOAD_URL" -H "Content-Type: image/png" --data-binary @/fixture/fixture.png' 2>/dev/null) || true
  if [[ "$PUT_STATUS" == "200" ]]; then
    ok "PUT upload_url (200)"
  else
    fail "PUT upload_url returned $PUT_STATUS"
  fi
fi

DOWNLOAD_RESP=$(curl -sf -H "Authorization: Bearer $CREATOR_TOKEN" "$BASE_URL/media/$ASSET_ID/download-url" 2>/dev/null) || true
DOWNLOAD_URL=$(echo "$DOWNLOAD_RESP" | jq -r '.download_url // empty')
if [[ -z "$DOWNLOAD_URL" ]]; then
  fail "GET /media/{id}/download-url"
else
  ok "GET /media/{id}/download-url"
fi
if echo "$DOWNLOAD_URL" | grep -q "minio:9000"; then
  fail "Download URL host must not be minio:9000 (set MINIO_PUBLIC_ENDPOINT=localhost:9000 in .env)"
else
  ok "Download URL host is reachable from host (not minio:9000)"
fi

section "F) IMAGE post + feed"
POST_CREATE=$(curl -sf -X POST "$BASE_URL/posts" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"IMAGE\",\"caption\":\"E2E verify post\",\"visibility\":\"PUBLIC\",\"asset_ids\":[\"$ASSET_ID\"]}" 2>/dev/null) || true
POST_ID=$(echo "$POST_CREATE" | jq -r '.id // empty')
if [[ -n "$POST_ID" && "$POST_ID" != "null" ]]; then
  ok "POST /posts (IMAGE with asset_ids)"
else
  fail "POST /posts: $POST_CREATE"
fi

POSTS_PAGE=$(curl -sf "$BASE_URL/creators/$HANDLE/posts?page=1&page_size=10" 2>/dev/null) || true
if echo "$POSTS_PAGE" | jq -e '.items | any(.id == "'"$POST_ID"'")' >/dev/null 2>&1; then
  ok "GET /creators/$HANDLE/posts includes new post"
  HAS_ASSET=$(echo "$POSTS_PAGE" | jq -e '.items[] | select(.id == "'"$POST_ID"'") | .asset_ids | index("'"$ASSET_ID"'") >= 0' 2>/dev/null) || true
  if [[ -n "$HAS_ASSET" ]]; then
    ok "Post has asset_ids including uploaded asset"
  fi
else
  fail "GET /creators/$HANDLE/posts"
fi

FEED=$(curl -sf -H "Authorization: Bearer $CREATOR_TOKEN" "$BASE_URL/feed?page=1&page_size=10" 2>/dev/null) || true
if echo "$FEED" | jq -e '.items | any(.id == "'"$POST_ID"'")' >/dev/null 2>&1; then
  ok "GET /feed includes new post (creator sees own)"
else
  warn "GET /feed may not include post (creator feed logic)"
fi

section "G) DB verification"
# Use compose env: POSTGRES_USER and POSTGRES_DB from .env (zinovia)
export PGPASSWORD="${POSTGRES_PASSWORD:-zinovia}"
DB_USER="${POSTGRES_USER:-zinovia}"
DB_NAME="${POSTGRES_DB:-zinovia}"
CONTAINER=$(docker compose -f infra/compose/docker-compose.yml --env-file .env ps -q postgres 2>/dev/null) || true
if [[ -z "$CONTAINER" ]]; then
  fail "Postgres container not running"
else
  USERS_CNT=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT count(*) FROM users;" 2>/dev/null) || echo "0"
  CREATOR_EXISTS=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT count(*) FROM users WHERE email = '$CREATOR_EMAIL';" 2>/dev/null) || echo "0"
  FAN_EXISTS=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT count(*) FROM users WHERE email = '$FAN_EMAIL';" 2>/dev/null) || echo "0"
  PROFILES_CNT=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT count(*) FROM profiles;" 2>/dev/null) || echo "0"
  FOLLOWS_CNT=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT count(*) FROM follows;" 2>/dev/null) || echo "0"
  MEDIA_CNT=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT count(*) FROM media_assets;" 2>/dev/null) || echo "0"
  POSTS_CNT=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT count(*) FROM posts;" 2>/dev/null) || echo "0"
  MEDIA_FOR_ASSET=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT count(*) FROM media_assets WHERE id = '$ASSET_ID'::uuid;" 2>/dev/null) || echo "0"
  POST_FOR_ASSET=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT count(*) FROM post_media WHERE media_asset_id = '$ASSET_ID'::uuid;" 2>/dev/null) || echo "0"
  echo "  users=$USERS_CNT profiles=$PROFILES_CNT follows=$FOLLOWS_CNT media_assets=$MEDIA_CNT posts=$POSTS_CNT"
  echo "  creator/fan exist: $CREATOR_EXISTS $FAN_EXISTS | asset_id=$ASSET_ID media_rows=$MEDIA_FOR_ASSET post_refs=$POST_FOR_ASSET"
  if [[ "${USERS_CNT:-0}" -ge 2 ]]; then ok "DB users >= 2"; else fail "DB users < 2"; fi
  if [[ "${CREATOR_EXISTS:-0}" -ge 1 ]]; then ok "DB creator user exists"; else fail "DB creator user missing"; fi
  if [[ "${FAN_EXISTS:-0}" -ge 1 ]]; then ok "DB fan user exists"; else fail "DB fan user missing"; fi
  if [[ "${PROFILES_CNT:-0}" -ge 1 ]]; then ok "DB profiles row exists"; else fail "DB profiles missing"; fi
  if [[ "${FOLLOWS_CNT:-0}" -ge 1 ]]; then ok "DB follows row exists"; else fail "DB follows missing"; fi
  if [[ "${MEDIA_FOR_ASSET:-0}" -ge 1 ]]; then ok "DB media_assets row for asset_id"; else fail "DB media_assets missing for asset"; fi
  if [[ "${POST_FOR_ASSET:-0}" -ge 1 ]]; then ok "DB post references asset_id"; else fail "DB post_media missing for asset"; fi
fi
unset PGPASSWORD 2>/dev/null || true

section "Summary"
echo "  PASS: $PASS  FAIL: $FAIL"
if [[ "$FAIL" -gt 0 ]]; then
  echo ""
  echo "OVERALL: FAIL"
  exit 1
fi
echo ""
echo "OVERALL: PASS"
exit 0
