#!/usr/bin/env bash
#
# Zinovia Fans — Stability Runner
# Runs smoke tests + Playwright E2E in sequence.
# Usage: bash scripts/qa/stability-runner.sh [API_BASE] [WEB_BASE]
#
set -euo pipefail

API_BASE="${1:-https://api.zinovia.ai}"
WEB_BASE="${2:-https://zinovia.ai}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

green()  { printf '\033[32m%s\033[0m\n' "$*"; }
red()    { printf '\033[31m%s\033[0m\n' "$*"; }

echo ""
echo "========================================"
echo "  Zinovia Fans — Stability Runner"
echo "  API: $API_BASE"
echo "  Web: $WEB_BASE"
echo "========================================"

# Step 1: Smoke tests
echo ""
echo "── Step 1: Bash Smoke Tests ──"
if bash "$REPO_ROOT/scripts/qa/smoke.sh" "$API_BASE" "$WEB_BASE"; then
  green "Smoke tests PASSED"
else
  red "Smoke tests FAILED"
  exit 1
fi

# Step 2: Playwright E2E (if installed)
echo ""
echo "── Step 2: Playwright E2E ──"
cd "$REPO_ROOT/apps/web"

if npx playwright --version >/dev/null 2>&1; then
  # Ensure browsers installed
  npx playwright install chromium --with-deps 2>/dev/null || true

  PLAYWRIGHT_BASE_URL="$WEB_BASE" API_BASE_URL="$API_BASE" npx playwright test --reporter=list
  green "Playwright E2E PASSED"
else
  echo "  Playwright not installed, skipping E2E"
fi

echo ""
echo "========================================"
green "  ALL STABILITY CHECKS PASSED"
echo "========================================"
