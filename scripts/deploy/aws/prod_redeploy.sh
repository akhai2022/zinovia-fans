#!/usr/bin/env bash
# Build, push, and redeploy all ECS services with the current git HEAD image.
# Registers new task definition revisions with the updated image tag, then
# updates each ECS service to use them.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TF_DIR="${TF_DIR:-$REPO_ROOT/infra/aws/terraform}"
TERRAFORM="${TERRAFORM:-terraform}"
if [[ -x "$REPO_ROOT/.tools/terraform" ]]; then
  TERRAFORM="$REPO_ROOT/.tools/terraform"
fi
AWS_REGION="${AWS_REGION:-$("$TERRAFORM" -chdir="$TF_DIR" output -raw aws_region 2>/dev/null || echo us-east-1)}"

echo "==> build and push images"
"$REPO_ROOT/scripts/deploy/aws/build_and_push.sh"

GIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo 'norev')"

CLUSTER_NAME="$("$TERRAFORM" -chdir="$TF_DIR" output -raw ecs_cluster_name)"
API_SERVICE="$("$TERRAFORM" -chdir="$TF_DIR" output -raw ecs_api_service_name)"
WEB_SERVICE="$("$TERRAFORM" -chdir="$TF_DIR" output -raw ecs_web_service_name)"
WORKER_SERVICE="$("$TERRAFORM" -chdir="$TF_DIR" output -raw ecs_worker_service_name)"

# Register new task definition revisions with updated image tags.
register_new_revision() {
  local family="$1"
  local new_tag="$2"

  # Get current task definition JSON
  local current
  current="$(aws ecs describe-task-definition --region "$AWS_REGION" --task-definition "$family" --query 'taskDefinition' --output json)"

  # Replace image tag in container definitions
  local container_defs
  container_defs="$(echo "$current" | jq --arg tag "$new_tag" '.containerDefinitions | map(.image = (.image | sub(":[^:]+$"; ":\($tag)")))')"

  # Extract fields needed for registration
  local task_role execution_role cpu memory network_mode requires_compat volumes
  task_role="$(echo "$current" | jq -r '.taskRoleArn // empty')"
  execution_role="$(echo "$current" | jq -r '.executionRoleArn // empty')"
  cpu="$(echo "$current" | jq -r '.cpu // empty')"
  memory="$(echo "$current" | jq -r '.memory // empty')"
  network_mode="$(echo "$current" | jq -r '.networkMode // empty')"
  requires_compat="$(echo "$current" | jq -r '.requiresCompatibilities // [] | join(" ")')"
  volumes="$(echo "$current" | jq '.volumes // []')"
  local ephemeral_storage
  ephemeral_storage="$(echo "$current" | jq '.ephemeralStorage // empty')"

  local cmd=(
    aws ecs register-task-definition
    --region "$AWS_REGION"
    --family "$family"
    --container-definitions "$container_defs"
    --volumes "$volumes"
  )
  [[ -n "$task_role" ]] && cmd+=(--task-role-arn "$task_role")
  [[ -n "$execution_role" ]] && cmd+=(--execution-role-arn "$execution_role")
  [[ -n "$cpu" ]] && cmd+=(--cpu "$cpu")
  [[ -n "$memory" ]] && cmd+=(--memory "$memory")
  [[ -n "$network_mode" ]] && cmd+=(--network-mode "$network_mode")
  [[ -n "$requires_compat" ]] && cmd+=(--requires-compatibilities $requires_compat)
  [[ -n "$ephemeral_storage" && "$ephemeral_storage" != "null" ]] && cmd+=(--ephemeral-storage "$ephemeral_storage")

  local new_rev
  new_rev="$("${cmd[@]}" --query 'taskDefinition.taskDefinitionArn' --output text)"
  echo "$new_rev"
}

echo "==> registering new task definitions (tag: ${GIT_SHA})"
API_TD="$(register_new_revision "zinovia-fans-prod-api" "$GIT_SHA")"
echo "  API:    $API_TD"
WEB_TD="$(register_new_revision "zinovia-fans-prod-web" "$GIT_SHA")"
echo "  Web:    $WEB_TD"
WORKER_TD="$(register_new_revision "zinovia-fans-prod-worker" "$GIT_SHA")"
echo "  Worker: $WORKER_TD"

echo "==> updating ECS services"
aws ecs update-service --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --service "$API_SERVICE" --task-definition "$API_TD" --force-new-deployment >/dev/null
aws ecs update-service --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --service "$WEB_SERVICE" --task-definition "$WEB_TD" --force-new-deployment >/dev/null
aws ecs update-service --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --service "$WORKER_SERVICE" --task-definition "$WORKER_TD" --force-new-deployment >/dev/null

# Also update Terraform main.tf so it stays in sync for next terraform apply.
MAIN_TF="$TF_DIR/main.tf"
sed -i -E \
  "s|(module\.ecr\.api_repository_url):[a-f0-9]+\"|\1:${GIT_SHA}\"|" \
  "$MAIN_TF"
sed -i -E \
  "s|(module\.ecr\.web_repository_url):[a-f0-9]+\"|\1:${GIT_SHA}\"|" \
  "$MAIN_TF"
sed -i -E \
  "s|(module\.ecr\.worker_repository_url):[a-f0-9]+\"|\1:${GIT_SHA}\"|" \
  "$MAIN_TF"

echo "==> waiting for stability"
aws ecs wait services-stable --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --services "$API_SERVICE" "$WEB_SERVICE" "$WORKER_SERVICE"

echo "==> redeploy completed (tag: ${GIT_SHA})"
