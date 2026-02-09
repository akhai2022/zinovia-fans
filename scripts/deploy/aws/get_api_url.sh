#!/usr/bin/env bash
# Print current staging API URL (http://<task-public-ip>:8000) for public ECS API.
# Run from repo root after terraform apply. Use: export API_BASE_URL=$(./scripts/deploy/aws/get_api_url.sh)
# All AWS calls use us-east-1.
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TF_DIR="${TF_DIR:-$REPO_ROOT/infra/aws/terraform}"

TERRAFORM="${TERRAFORM:-terraform}"
if [[ -x "$REPO_ROOT/.tools/terraform" ]]; then
  TERRAFORM="$REPO_ROOT/.tools/terraform"
fi

CLUSTER="$("$TERRAFORM" -chdir="$TF_DIR" output -raw ecs_cluster_name 2>/dev/null)" || true
SERVICE="$("$TERRAFORM" -chdir="$TF_DIR" output -raw ecs_api_service_name 2>/dev/null)" || true
if [[ -z "${CLUSTER:-}" ]] || [[ -z "${SERVICE:-}" ]]; then
  echo "Run terraform apply first and ensure api_no_alb service exists." >&2
  exit 1
fi

TASK_ARN=$(aws ecs list-tasks --cluster "$CLUSTER" --service-name "$SERVICE" --desired-status RUNNING --region "$AWS_REGION" --query 'taskArns[0]' --output text 2>/dev/null) || true
if [[ -z "${TASK_ARN:-}" ]] || [[ "$TASK_ARN" == "None" ]]; then
  echo "No running API task. Start the ECS service and retry." >&2
  exit 1
fi

ENI=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" --region "$AWS_REGION" --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text 2>/dev/null) || true
if [[ -z "${ENI:-}" ]] || [[ "$ENI" == "None" ]]; then
  echo "Could not get task network interface." >&2
  exit 1
fi

PUBLIC_IP=$(aws ec2 describe-network-interfaces --network-interface-ids "$ENI" --region "$AWS_REGION" --query 'NetworkInterfaces[0].Association.PublicIp' --output text 2>/dev/null) || true
if [[ -z "${PUBLIC_IP:-}" ]] || [[ "$PUBLIC_IP" == "None" ]]; then
  echo "No public IP for task (check subnet/assign_public_ip)." >&2
  exit 1
fi

echo "http://${PUBLIC_IP}:8000"
