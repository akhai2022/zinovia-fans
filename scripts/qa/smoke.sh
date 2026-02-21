#!/usr/bin/env bash
#
# Zinovia Fans — Production Smoke Test Suite
# Usage: bash scripts/qa/smoke.sh [API_BASE] [WEB_BASE]
#
set -euo pipefail

API_BASE="${1:-https://api.zinovia.ai}"
WEB_BASE="${2:-https://zinovia.ai}"
PASS=0
FAIL=0
SKIP=0
RESULTS=""

green()  { printf '\033[32m%s\033[0m\n' "$*"; }
red()    { printf '\033[31m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

check() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    green "  PASS  $name"
    PASS=$((PASS+1))
    RESULTS+="PASS $name\n"
  else
    red "  FAIL  $name"
    FAIL=$((FAIL+1))
    RESULTS+="FAIL $name\n"
  fi
}

skip() {
  local name="$1" reason="$2"
  yellow "  SKIP  $name ($reason)"
  SKIP=$((SKIP+1))
  RESULTS+="SKIP $name ($reason)\n"
}

assert_status() {
  local url="$1" expected="$2"
  local actual
  actual=$(curl -s -o /dev/null -w '%{http_code}' "$url")
  [ "$actual" = "$expected" ]
}

assert_json_field() {
  local url="$1" field="$2" expected="$3"
  local body
  body=$(curl -s "$url")
  echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); assert str(d.get('$field',''))=='$expected', f'got {d.get(\"$field\")}'" 2>/dev/null
}

assert_contains() {
  local url="$1" needle="$2"
  curl -s "$url" | grep -q "$needle"
}

# ----- cookie jar for authenticated tests -----
COOKIE_JAR=$(mktemp)
trap "rm -f $COOKIE_JAR" EXIT

echo ""
echo "===================================="
echo "  Zinovia Fans Smoke Test"
echo "  API: $API_BASE"
echo "  Web: $WEB_BASE"
echo "===================================="
echo ""

# ─── SECTION 1: Health ───
echo "── Health ──"
check "API /health returns 200"       assert_status "$API_BASE/health" 200
check "API /health.ok = true"         assert_json_field "$API_BASE/health" "ok" "True"
check "API /ready returns 200"        assert_status "$API_BASE/ready" 200
check "Web homepage returns 200"      assert_status "$WEB_BASE/" 200
check "Billing health returns 200"    assert_status "$API_BASE/billing/health" 200
echo ""

# ─── SECTION 2: CORS ───
echo "── CORS ──"
check "CORS allows web origin" bash -c "
  curl -sI -X OPTIONS '$API_BASE/health' \
    -H 'Origin: $WEB_BASE' \
    -H 'Access-Control-Request-Method: GET' \
    | grep -iq 'access-control-allow-origin'
"
echo ""

# ─── SECTION 3: Public API Endpoints ───
echo "── Public API ──"
check "GET /creators returns items"    bash -c "curl -s '$API_BASE/creators?page=1&page_size=5' | python3 -c 'import sys,json; d=json.load(sys.stdin); assert \"items\" in d'"
check "GET /posts/search returns ok"   assert_status "$API_BASE/posts/search?q=test&page=1&page_size=5" 200
check "GET /creators/sitemap works"    assert_status "$API_BASE/creators/sitemap" 200
check "GET /brand/assets works"        assert_status "$API_BASE/brand/assets" 200
echo ""

# ─── SECTION 4: Auth (API-level) ───
echo "── Auth ──"
TS=$(date +%s)
FAN_EMAIL="smoke+fan${TS}@test.zinovia.ai"
FAN_PASS="SmokeTest123!"
CREATOR_EMAIL="smoke+creator${TS}@test.zinovia.ai"
CREATOR_PASS="SmokeCreator123!"

# Fan signup
FAN_SIGNUP=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_BASE/auth/signup" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$FAN_EMAIL\",\"password\":\"$FAN_PASS\",\"display_name\":\"Smoke Fan\",\"date_of_birth\":\"2000-01-01\"}")
if [ "$FAN_SIGNUP" = "200" ] || [ "$FAN_SIGNUP" = "201" ]; then
  green "  PASS  Fan signup ($FAN_SIGNUP)"
  PASS=$((PASS+1))
else
  red "  FAIL  Fan signup (got $FAN_SIGNUP)"
  FAIL=$((FAIL+1))
fi

# Fan login
FAN_LOGIN=$(curl -s -o /dev/null -w '%{http_code}' -c "$COOKIE_JAR" -X POST "$API_BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$FAN_EMAIL\",\"password\":\"$FAN_PASS\"}")
check "Fan login returns 200" [ "$FAN_LOGIN" = "200" ]

# Session check
check "Fan /auth/me returns 200" bash -c "curl -s -b '$COOKIE_JAR' -o /dev/null -w '%{http_code}' '$API_BASE/auth/me' | grep -q 200"

# Creator register
CREATOR_REG=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: smoke-${TS}" \
  -d "{\"email\":\"$CREATOR_EMAIL\",\"password\":\"$CREATOR_PASS\"}")
if [ "$CREATOR_REG" = "200" ] || [ "$CREATOR_REG" = "201" ]; then
  green "  PASS  Creator register ($CREATOR_REG)"
  PASS=$((PASS+1))
else
  red "  FAIL  Creator register (got $CREATOR_REG)"
  FAIL=$((FAIL+1))
fi

# Wrong password
WRONG_PASS=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"nobody@test.zinovia.ai","password":"WrongPass999"}')
check "Wrong password returns 401" [ "$WRONG_PASS" = "401" ]

# Unauth /auth/me
UNAUTH_ME=$(curl -s -o /dev/null -w '%{http_code}' "$API_BASE/auth/me")
check "Unauth /auth/me returns 401" [ "$UNAUTH_ME" = "401" ]
echo ""

# ─── SECTION 5: Feed ───
echo "── Feed ──"
check "Authenticated /feed returns 200" bash -c "curl -s -b '$COOKIE_JAR' -o /dev/null -w '%{http_code}' '$API_BASE/feed?page=1&page_size=20' | grep -q 200"
check "Unauthenticated /feed returns 401" bash -c "curl -s -o /dev/null -w '%{http_code}' '$API_BASE/feed?page=1&page_size=20' | grep -q 401"
echo ""

# ─── SECTION 6: Public Pages ───
echo "── Public Pages ──"
for path in "/" "/creators" "/about" "/pricing" "/how-it-works" "/privacy" "/terms" "/help" "/contact" "/login" "/signup"; do
  check "Page $path returns 200" assert_status "$WEB_BASE$path" 200
done
echo ""

# ─── SECTION 7: Creator Profile ───
echo "── Creator Profile ──"
FIRST_HANDLE=$(curl -s "$API_BASE/creators?page=1&page_size=1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['items'][0]['handle'] if d.get('items') else '')" 2>/dev/null || true)
if [ -n "$FIRST_HANDLE" ]; then
  check "Creator profile API /$FIRST_HANDLE" assert_status "$API_BASE/creators/$FIRST_HANDLE" 200
  check "Creator posts API" assert_status "$API_BASE/creators/$FIRST_HANDLE/posts?page_size=20" 200
  check "Creator profile page" assert_status "$WEB_BASE/creators/$FIRST_HANDLE" 200
else
  skip "Creator profile tests" "No creators found"
fi
echo ""

# ─── SECTION 8: Stripe/Billing ───
echo "── Billing ──"
BILLING_STATUS=$(curl -s -b "$COOKIE_JAR" -o /dev/null -w '%{http_code}' "$API_BASE/billing/status")
check "Billing status API accessible" [ "$BILLING_STATUS" = "200" ]
echo ""

# ─── SUMMARY ───
echo ""
echo "===================================="
echo "  RESULTS: $PASS passed, $FAIL failed, $SKIP skipped"
echo "===================================="
if [ $FAIL -gt 0 ]; then
  red "SOME TESTS FAILED"
  exit 1
else
  green "ALL TESTS PASSED"
  exit 0
fi
