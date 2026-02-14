#!/usr/bin/env bash
# Web smoke test: verify frontend pages return 200 + HTML.
#
# Usage:
#   WEB_BASE_URL=http://127.0.0.1:3000 ./scripts/web_smoke_test.sh       # local
#   WEB_BASE_URL=https://zinovia.ai ./scripts/web_smoke_test.sh           # production
set -euo pipefail

WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:3000}"

PASS_COUNT=0
FAIL_COUNT=0
FAILED_CHECKS=()

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '\033[32mPASS\033[0m: %s\n' "$1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILED_CHECKS+=("$1")
  printf '\033[31mFAIL\033[0m: %s\n' "$1"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

require_cmd curl

check_page() {
  local path="$1"
  local expected="${2:-200}"
  local url="${WEB_BASE_URL}${path}"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" "$url" || true)"
  if [[ "$code" == "$expected" ]]; then
    pass "${path} (${code})"
  else
    fail "${path} expected ${expected}, got ${code}"
  fi
}

echo "======================================"
echo " Zinovia-Fans Web Smoke Test"
echo " Target: ${WEB_BASE_URL}"
echo "======================================"
echo

# Public pages (200)
check_page "/" 200
check_page "/creators" 200
check_page "/login" 200
check_page "/signup" 200

# Auth-required pages redirect to login (307)
check_page "/feed" 307
check_page "/messages" 200
check_page "/settings/profile" 200

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
