#!/usr/bin/env bash
# Restore staging secrets that are in "scheduled for deletion" so Terraform can manage them again.
# All operations in us-east-1. Run from repo root. Requires: AWS CLI.
set -euo pipefail
REGION="${AWS_REGION:-us-east-1}"
PREFIX="zinovia-fans-staging"
for name in \
  "${PREFIX}-database-url" \
  "${PREFIX}-db-password" \
  "${PREFIX}-jwt-secret" \
  "${PREFIX}-csrf-secret" \
  "${PREFIX}-stripe-secret-key" \
  "${PREFIX}-stripe-webhook-secret"; do
  state=$(aws secretsmanager describe-secret --secret-id "$name" --region "$REGION" --query 'DeletedDate' --output text 2>/dev/null || true)
  if [[ -n "${state}" && "${state}" != "None" ]]; then
    echo "Restoring $name in $REGION ..."
    aws secretsmanager restore-secret --secret-id "$name" --region "$REGION"
  fi
done
echo "Done. Re-run: terraform apply -var-file=env/staging.tfvars -auto-approve"
