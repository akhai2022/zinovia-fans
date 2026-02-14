#!/usr/bin/env bash
# Restore AWS Secrets Manager secrets that are "scheduled for deletion".
# Run after a previous destroy; secrets stay in pending-deletion for 7–30 days.
# Usage: ./scripts/restore-secrets.sh [prod]
# Requires: AWS CLI configured

set -euo pipefail

ENV="${1:-prod}"
PREFIX="zinovia-fans-${ENV}"

SECRETS=(
  "${PREFIX}-database-url"
  "${PREFIX}-db-password"
  "${PREFIX}-jwt-secret"
  "${PREFIX}-csrf-secret"
  "${PREFIX}-stripe-secret-key"
  "${PREFIX}-stripe-webhook-secret"
)

for name in "${SECRETS[@]}"; do
  if aws secretsmanager describe-secret --secret-id "$name" 2>/dev/null | grep -q "DeletedDate"; then
    echo "Restoring $name..."
    aws secretsmanager restore-secret --secret-id "$name" || true
  else
    echo "Skipping $name (not in deleted state)"
  fi
done

echo "Done. Re-run: make aws-prod-apply"
