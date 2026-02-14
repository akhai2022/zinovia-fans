#!/usr/bin/env bash
# Destroy prod stack and recreate from scratch.
# Usage: ./scripts/deploy/prod-destroy-recreate.sh
# Requires: AWS CLI, Docker, Terraform. Run from repo root.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TF_DIR="$REPO_ROOT/infra/aws/terraform"
TF_VARS="-var-file=env/prod.tfvars -var=enable_cloudfront=false -var=db_deletion_protection=false -lock=false"

cd "$REPO_ROOT"

echo "=== 1. Destroy prod (allow 15-25 min for AWS ENI/network cleanup) ==="
cd "$TF_DIR"
terraform init -backend=false
terraform destroy $TF_VARS -auto-approve || true
# Re-run if interrupted; some resources (ENIs) take time to release
if terraform state list 2>/dev/null | grep -q .; then
  echo "State not empty - re-run destroy if needed"
  sleep 30
  terraform destroy $TF_VARS -auto-approve || true
fi

echo "=== 2. Apply prod from scratch ==="
terraform apply $TF_VARS -auto-approve

echo "=== 3. Build and push images ==="
cd "$REPO_ROOT"
ENV=prod ./scripts/deploy/aws/build_and_push.sh

echo "=== 4. Tag :latest for ECS task definitions ==="
API_ECR=$(terraform -chdir="$TF_DIR" output -raw ecr_api_url)
WEB_ECR=$(terraform -chdir="$TF_DIR" output -raw ecr_web_url)
WORKER_ECR=$(terraform -chdir="$TF_DIR" output -raw ecr_worker_url)
for img in "$API_ECR" "$WEB_ECR" "$WORKER_ECR"; do
  docker tag "${img}:prod-latest" "${img}:latest" 2>/dev/null || true
  docker push "${img}:latest"
done

echo "=== 5. Run migrations ==="
TASK_DEF=$(terraform -chdir="$TF_DIR" output -raw migrate_task_definition)
CLUSTER=$(terraform -chdir="$TF_DIR" output -raw ecs_cluster_name)
SUBNETS=$(terraform -chdir="$TF_DIR" output -json private_subnet_ids | jq -c '.')
SG=$(terraform -chdir="$TF_DIR" output -raw ecs_security_group_id)
aws ecs run-task --cluster "$CLUSTER" --task-definition "$TASK_DEF" --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=$SUBNETS,securityGroups=[\"$SG\"],assignPublicIp=DISABLED}" \
  --region us-east-1 --output json | jq -r '.tasks[0].taskArn'

echo "=== 6. Force ECS deployment (pull latest) ==="
for svc in api web worker; do
  aws ecs update-service --cluster "$CLUSTER" --service "zinovia-fans-prod-$svc" --force-new-deployment --region us-east-1 --output json | jq -r '.service.serviceName'
done

echo ""
echo "=== Done. Wait 2-5 min for ECS to stabilize, then: ==="
echo "  curl -s http://api.zinovia.ai/health"
echo "  curl -s -o /dev/null -w '%{http_code}' http://zinovia.ai"
