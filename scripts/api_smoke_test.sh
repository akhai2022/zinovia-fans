#!/usr/bin/env bash
# API smoke test: exercises the full creator lifecycle end-to-end.
#
# Usage:
#   API_BASE_URL=http://127.0.0.1:8000 ./scripts/api_smoke_test.sh          # local
#   API_BASE_URL=https://api.zinovia.ai ./scripts/api_smoke_test.sh          # production
#
# Prerequisites: curl, python3
#
# What it checks:
#   1. /health + /ready
#   2. Register creator
#   3. Verify email (dev mode: uses returned token)
#   4. Login and store access token
#   5. List creators + feed
#   6. Upload image via presigned URL
#   7. Create post with uploaded image
#   8. Get presigned download URL + verify it works
#   9. Start Stripe subscription checkout (if STRIPE available)
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:8000}"
WORK_DIR="$(mktemp -d)"
COOKIE_JAR="${WORK_DIR}/cookies.txt"
IMAGE_FILE="${WORK_DIR}/smoke.png"

PASS_COUNT=0
FAIL_COUNT=0
FAILED_CHECKS=()

cleanup() { rm -rf "${WORK_DIR}"; }
trap cleanup EXIT

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '\033[32mPASS\033[0m: %s\n' "$1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILED_CHECKS+=("$1")
  printf '\033[31mFAIL\033[0m: %s\n' "$1"
}

skip() {
  printf '\033[33mSKIP\033[0m: %s\n' "$1"
}

json_get() {
  python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('${1}',''))"
}

json_get_nested() {
  python3 -c "import json,sys; d=json.load(sys.stdin); print((d.get('${1}',{}) or {}).get('${2}',''))"
}

echo "======================================"
echo " Zinovia-Fans API Smoke Test"
echo " Target: ${API_BASE_URL}"
echo "======================================"
echo

# --- Health checks ---
HEALTH_BODY="$(curl -sS "${API_BASE_URL}/health" || true)"
if [[ "$(printf '%s' "${HEALTH_BODY}" | json_get status)" == "ok" ]]; then
  pass "GET /health"
else
  fail "GET /health"
fi

READY_BODY="$(curl -sS "${API_BASE_URL}/ready" || true)"
READY_STATUS="$(printf '%s' "${READY_BODY}" | json_get status)"
READY_DB="$(printf '%s' "${READY_BODY}" | json_get_nested checks database)"
if [[ "${READY_STATUS}" == "ok" ]]; then
  pass "GET /ready (db=${READY_DB})"
else
  fail "GET /ready (status=${READY_STATUS}, db=${READY_DB})"
fi

# --- Registration ---
UNIQ="$(date +%s)-${RANDOM}"
EMAIL="smoke-${UNIQ}@example.com"
PASSWORD="SmokePass${UNIQ}!"
IDEMPOTENCY_KEY="smoke-register-${UNIQ}"

REGISTER_BODY="$(curl -sS -X POST "${API_BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: ${IDEMPOTENCY_KEY}" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" || true)"
CREATOR_ID="$(printf '%s' "${REGISTER_BODY}" | json_get creator_id)"
VERIFY_TOKEN="$(printf '%s' "${REGISTER_BODY}" | json_get verification_token)"
EMAIL_STATUS="$(printf '%s' "${REGISTER_BODY}" | json_get email_delivery_status)"

if [[ -n "${CREATOR_ID}" ]]; then
  pass "POST /auth/register (creator_id=${CREATOR_ID:0:8}..., email_status=${EMAIL_STATUS:-n/a})"
else
  fail "POST /auth/register"
fi

# --- Email Verification ---
EMAIL_VERIFIED="false"
if [[ -n "${VERIFY_TOKEN}" ]]; then
  VERIFY_BODY="$(curl -sS -X POST "${API_BASE_URL}/auth/verify-email" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: smoke-verify-${UNIQ}" \
    -d "{\"token\":\"${VERIFY_TOKEN}\"}" || true)"
  VERIFY_STATE="$(printf '%s' "${VERIFY_BODY}" | json_get state)"
  if [[ "${VERIFY_STATE}" == "EMAIL_VERIFIED" ]]; then
    pass "POST /auth/verify-email -> ${VERIFY_STATE}"
    EMAIL_VERIFIED="true"
  else
    fail "POST /auth/verify-email (state=${VERIFY_STATE})"
  fi
else
  skip "POST /auth/verify-email (no token returned; MAIL_PROVIDER=ses?)"
fi

# --- Login ---
LOGIN_BODY="$(curl -sS -c "${COOKIE_JAR}" -X POST "${API_BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" || true)"
ACCESS_TOKEN="$(printf '%s' "${LOGIN_BODY}" | json_get access_token)"
if [[ -n "${ACCESS_TOKEN}" ]]; then
  pass "POST /auth/login (got access_token)"
else
  fail "POST /auth/login"
fi
AUTH=(-H "Authorization: Bearer ${ACCESS_TOKEN}")

# --- List endpoints ---
CREATORS_CODE="$(curl -sS -o /dev/null -w "%{http_code}" "${API_BASE_URL}/creators?page=1&page_size=5" || true)"
if [[ "${CREATORS_CODE}" == "200" ]]; then
  pass "GET /creators (${CREATORS_CODE})"
else
  fail "GET /creators (${CREATORS_CODE})"
fi

FEED_CODE="$(curl -sS -o /dev/null -w "%{http_code}" "${AUTH[@]}" "${API_BASE_URL}/feed?page=1&page_size=5" || true)"
if [[ "${FEED_CODE}" == "200" ]]; then
  pass "GET /feed (${FEED_CODE})"
else
  fail "GET /feed (${FEED_CODE})"
fi

# --- Media upload ---
# 1x1 transparent PNG fixture
python3 -c "
import base64, sys
png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z3xQAAAAASUVORK5CYII='
open(sys.argv[1], 'wb').write(base64.b64decode(png))
" "${IMAGE_FILE}"
SIZE_BYTES="$(wc -c < "${IMAGE_FILE}" | tr -d ' ')"

OBJECT_KEY="smoke/${UNIQ}/image.png"
UPLOAD_BODY="$(curl -sS -X POST "${API_BASE_URL}/media/upload-url" \
  "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"object_key\":\"${OBJECT_KEY}\",\"content_type\":\"image/png\",\"size_bytes\":${SIZE_BYTES}}" || true)"
ASSET_ID="$(printf '%s' "${UPLOAD_BODY}" | json_get asset_id)"
UPLOAD_URL="$(printf '%s' "${UPLOAD_BODY}" | json_get upload_url)"

if [[ -n "${ASSET_ID}" && -n "${UPLOAD_URL}" ]]; then
  pass "POST /media/upload-url (asset_id=${ASSET_ID:0:8}...)"
else
  fail "POST /media/upload-url"
fi

if [[ -n "${UPLOAD_URL}" ]]; then
  PUT_CODE="$(curl -sS -o /dev/null -w "%{http_code}" \
    -X PUT "${UPLOAD_URL}" \
    -H "Content-Type: image/png" \
    --data-binary @"${IMAGE_FILE}" || true)"
  if [[ "${PUT_CODE}" == "200" || "${PUT_CODE}" == "204" ]]; then
    pass "PUT presigned upload (${PUT_CODE})"
  else
    fail "PUT presigned upload (${PUT_CODE})"
  fi
fi

# --- Post creation (requires verified email) ---
if [[ -n "${ASSET_ID}" && "${EMAIL_VERIFIED}" == "true" ]]; then
  POST_BODY="$(curl -sS -X POST "${API_BASE_URL}/posts" \
    "${AUTH[@]}" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"IMAGE\",\"caption\":\"Smoke test post\",\"visibility\":\"PUBLIC\",\"nsfw\":false,\"asset_ids\":[\"${ASSET_ID}\"]}" || true)"
  POST_ID="$(printf '%s' "${POST_BODY}" | json_get id)"
  if [[ -n "${POST_ID}" ]]; then
    pass "POST /posts (post_id=${POST_ID:0:8}...)"
  else
    fail "POST /posts"
  fi
elif [[ -n "${ASSET_ID}" ]]; then
  skip "POST /posts (email not verified; creator cannot post in SES mode)"
fi
if [[ -n "${ASSET_ID}" ]]; then

  # --- Download URL ---
  DL_BODY="$(curl -sS "${API_BASE_URL}/media/${ASSET_ID}/download-url" "${AUTH[@]}" || true)"
  DOWNLOAD_URL="$(printf '%s' "${DL_BODY}" | json_get download_url)"
  if [[ -n "${DOWNLOAD_URL}" ]]; then
    pass "GET /media/{id}/download-url"
    DL_CODE="$(curl -sS -o /dev/null -w "%{http_code}" "${DOWNLOAD_URL}" || true)"
    if [[ "${DL_CODE}" == "200" ]]; then
      pass "GET signed download URL (${DL_CODE})"
    else
      fail "GET signed download URL (${DL_CODE})"
    fi
  else
    fail "GET /media/{id}/download-url"
  fi
fi

# --- Billing checkout (Stripe must be configured) ---
BILLING_HEALTH_BODY="$(curl -sS "${API_BASE_URL}/billing/health" || true)"
STRIPE_MODE="$(printf '%s' "${BILLING_HEALTH_BODY}" | json_get stripe_mode)"
if [[ -n "${STRIPE_MODE}" ]]; then
  pass "GET /billing/health (stripe_mode=${STRIPE_MODE})"

  if [[ -n "${CREATOR_ID}" ]]; then
    CHECKOUT_BODY="$(curl -sS -X POST "${API_BASE_URL}/billing/checkout/subscription" \
      "${AUTH[@]}" \
      -H "Content-Type: application/json" \
      -d "{\"creator_id\":\"${CREATOR_ID}\",\"success_url\":\"https://example.com/success\",\"cancel_url\":\"https://example.com/cancel\"}" || true)"
    CHECKOUT_URL="$(printf '%s' "${CHECKOUT_BODY}" | json_get checkout_url)"
    if [[ -n "${CHECKOUT_URL}" && "${CHECKOUT_URL}" == https://checkout.stripe.com/* ]]; then
      pass "POST /billing/checkout/subscription (got Stripe checkout URL)"
    elif [[ -n "${CHECKOUT_URL}" ]]; then
      pass "POST /billing/checkout/subscription (got checkout URL)"
    else
      fail "POST /billing/checkout/subscription (no checkout_url)"
    fi
  fi
else
  skip "GET /billing/health (Stripe not configured?)"
fi

# --- Summary ---
echo
echo "======================================"
echo " PASS: ${PASS_COUNT}"
echo " FAIL: ${FAIL_COUNT}"
if (( FAIL_COUNT > 0 )); then
  echo
  echo " Failed checks:"
  for check in "${FAILED_CHECKS[@]}"; do
    echo "  - ${check}"
  done
  echo "======================================"
  exit 1
fi
echo " All checks passed."
echo "======================================"
