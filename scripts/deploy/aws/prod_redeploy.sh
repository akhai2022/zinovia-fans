#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TF_DIR="${TF_DIR:-$REPO_ROOT/infra/aws/terraform}"
TERRAFORM="${TERRAFORM:-terraform}"
AWS_REGION="${AWS_REGION:-$("$TERRAFORM" -chdir="$TF_DIR" output -raw aws_region)}"

echo "==> build and push images"
"$REPO_ROOT/scripts/deploy/aws/build_and_push.sh"

CLUSTER_NAME="$("$TERRAFORM" -chdir="$TF_DIR" output -raw ecs_cluster_name)"
API_SERVICE="$("$TERRAFORM" -chdir="$TF_DIR" output -raw ecs_api_service_name)"
WEB_SERVICE="$("$TERRAFORM" -chdir="$TF_DIR" output -raw ecs_web_service_name)"
WORKER_SERVICE="$("$TERRAFORM" -chdir="$TF_DIR" output -raw ecs_worker_service_name)"

echo "==> force new ECS deployment (api/web/worker)"
aws ecs update-service --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --service "$API_SERVICE" --force-new-deployment >/dev/null
aws ecs update-service --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --service "$WEB_SERVICE" --force-new-deployment >/dev/null
aws ecs update-service --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --service "$WORKER_SERVICE" --force-new-deployment >/dev/null

echo "==> waiting for stability"
aws ecs wait services-stable --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --services "$API_SERVICE" "$WEB_SERVICE" "$WORKER_SERVICE"

echo "==> redeploy completed"
