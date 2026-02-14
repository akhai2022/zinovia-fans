#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-https://api.zinovia.ai}"
WEB_URL="${WEB_URL:-https://zinovia.ai}"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

echo "==> DNS + HTTPS"
curl -sS -Ik "$WEB_URL" >/dev/null || fail "web not reachable: $WEB_URL"
pass "web reachable"
curl -sS "$API_URL/health" >/dev/null || fail "api health endpoint not reachable"
pass "api health endpoint reachable"

echo "==> API health payload"
HEALTH_JSON="$(curl -sS "$API_URL/health")"
echo "$HEALTH_JSON" | grep -E "\"ok\"[[:space:]]*:[[:space:]]*true" >/dev/null || fail "api health payload invalid"
pass "api health ok=true"

echo "==> Stripe config sanity"
BILLING_HEALTH="$(curl -sS "$API_URL/billing/health")"
echo "$BILLING_HEALTH" | grep -E "\"stripe_mode\"[[:space:]]*:[[:space:]]*\"(live|test|unknown)\"" >/dev/null || fail "billing health missing stripe_mode"
pass "billing health exposes stripe mode safely"

echo "==> Signup smoke (optional)"
if [[ -n "${TEST_SIGNUP_EMAIL:-}" ]]; then
  IDEM_KEY="smoke-$(date +%s)"
  PAYLOAD="{\"email\":\"$TEST_SIGNUP_EMAIL\",\"password\":\"${TEST_SIGNUP_PASSWORD:-ChangeMe12345}\"}"
  RESP="$(curl -sS -X POST "$API_URL/auth/register" -H "Content-Type: application/json" -H "Idempotency-Key: $IDEM_KEY" -d "$PAYLOAD")" || fail "signup request failed"
  echo "$RESP" | grep -E "\"creator_id\"" >/dev/null || fail "signup did not return creator_id"
  pass "signup request accepted"
  echo "Check API CloudWatch logs for verification email delivery status:"
  echo "  aws logs tail /ecs/zinovia-fans-prod-api --since 15m --follow"
else
  echo "SKIP: TEST_SIGNUP_EMAIL not provided"
fi

echo "==> done"
