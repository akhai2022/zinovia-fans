#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TF_DIR="${TF_DIR:-$REPO_ROOT/infra/aws/terraform}"
TF_VAR_FILE="${TF_VAR_FILE:-env/prod.tfvars}"
TERRAFORM="${TERRAFORM:-terraform}"

echo "==> terraform init"
"$TERRAFORM" -chdir="$TF_DIR" init

echo "==> terraform plan ($TF_VAR_FILE)"
"$TERRAFORM" -chdir="$TF_DIR" plan -var-file="$TF_VAR_FILE"

echo "==> terraform apply ($TF_VAR_FILE)"
"$TERRAFORM" -chdir="$TF_DIR" apply -var-file="$TF_VAR_FILE" -auto-approve

echo "==> done"
