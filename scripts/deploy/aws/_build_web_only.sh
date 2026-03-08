#!/usr/bin/env bash
# Build and push ONLY the web image to ECR. For quick web-only deploys.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TF_DIR="${TF_DIR:-$REPO_ROOT/infra/aws/terraform}"
TERRAFORM="${TERRAFORM:-terraform}"
if [[ -x "$REPO_ROOT/.tools/terraform" ]]; then
  TERRAFORM="$REPO_ROOT/.tools/terraform"
fi

cd "$REPO_ROOT"

AWS_REGION="$("$TERRAFORM" -chdir="$TF_DIR" output -raw aws_region 2>/dev/null || echo "us-east-1")"
WEB_ECR="$("$TERRAFORM" -chdir="$TF_DIR" output -raw ecr_web_url 2>/dev/null)"

if [[ -z "${WEB_ECR:-}" ]]; then
  echo "ERROR: Could not resolve WEB ECR URL from Terraform output" >&2
  exit 1
fi

echo "WEB_ECR=$WEB_ECR"

# Login
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${WEB_ECR%%/*}"

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'norev')"
TAG_SHA="${GIT_SHA}"
TAG_LATEST="prod-latest"
TAG_ECS_LATEST="latest"

API_BASE_URL="${API_BASE_URL:-https://api.zinovia.ai}"
API_SAME_ORIGIN_PROXY="${API_SAME_ORIGIN_PROXY:-true}"
STRIPE_PUBLISHABLE_KEY="${STRIPE_PUBLISHABLE_KEY:-}"

echo "--- Build Web (NO_CACHE) ---"
docker build --no-cache -f infra/docker/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL" \
  --build-arg NEXT_PUBLIC_APP_URL=https://zinovia.ai \
  --build-arg NEXT_PUBLIC_API_SAME_ORIGIN_PROXY="$API_SAME_ORIGIN_PROXY" \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="$STRIPE_PUBLISHABLE_KEY" \
  -t "${WEB_ECR}:${TAG_SHA}" \
  -t "${WEB_ECR}:${TAG_LATEST}" \
  -t "${WEB_ECR}:${TAG_ECS_LATEST}" \
  .

echo "--- Push Web ---"
docker push "${WEB_ECR}:${TAG_SHA}"
docker push "${WEB_ECR}:${TAG_LATEST}"
docker push "${WEB_ECR}:${TAG_ECS_LATEST}"

echo "--- Deploy Web service ---"
aws ecs update-service \
  --cluster zinovia-fans-prod-cluster \
  --service zinovia-fans-prod-web \
  --force-new-deployment \
  --region "$AWS_REGION" \
  --query 'service.serviceName' --output text

echo "--- Done ---"
echo "Web: ${WEB_ECR}:${TAG_SHA}"
