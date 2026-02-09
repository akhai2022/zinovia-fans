#!/usr/bin/env bash
# Build and push API, Web, Worker images to ECR for staging (or prod).
# Run from repo root. Requires: AWS CLI, Docker, Terraform applied so ECR repos exist.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TF_DIR="${TF_DIR:-$REPO_ROOT/infra/aws/terraform}"
ENV="${ENV:-staging}"
API_BASE_URL="${API_BASE_URL:-}"

cd "$REPO_ROOT"

# When no custom domain, staging uses public ECS: set API_BASE_URL via get_api_url.sh before building web.
if [[ "$ENV" == "staging" ]]; then
  if [[ -z "${API_BASE_URL:-}" ]] && [[ -x "$REPO_ROOT/scripts/deploy/aws/get_api_url.sh" ]]; then
    API_BASE_URL="$(cd "$REPO_ROOT" && ./scripts/deploy/aws/get_api_url.sh 2>/dev/null)" || true
  fi
  API_BASE_URL="${API_BASE_URL:-https://stg-api.zinovia.ai}"
elif [[ "$ENV" == "prod" ]]; then
  API_BASE_URL="${API_BASE_URL:-https://api.zinovia.ai}"
else
  echo "ENV must be staging or prod (got: $ENV)" >&2
  exit 1
fi

# Resolve Terraform binary (use repo .tools if present)
TERRAFORM="${TERRAFORM:-terraform}"
if [[ -x "$REPO_ROOT/.tools/terraform" ]]; then
  TERRAFORM="$REPO_ROOT/.tools/terraform"
fi
export PATH="$(dirname "$TERRAFORM"):$PATH"

VAR_FILE="env/${ENV}.tfvars"
if [[ ! -f "$TF_DIR/$VAR_FILE" ]]; then
  echo "Missing $TF_DIR/$VAR_FILE" >&2
  exit 1
fi

echo "--- ECR login and repo URLs (env=$ENV) ---"
AWS_REGION="$("$TERRAFORM" -chdir="$TF_DIR" output -raw aws_region 2>/dev/null || echo "us-east-1")"
API_ECR="$("$TERRAFORM" -chdir="$TF_DIR" output -raw ecr_api_url 2>/dev/null)" || true
WEB_ECR="$("$TERRAFORM" -chdir="$TF_DIR" output -raw ecr_web_url 2>/dev/null)" || true
WORKER_ECR="$("$TERRAFORM" -chdir="$TF_DIR" output -raw ecr_worker_url 2>/dev/null)" || true

if [[ -z "${API_ECR:-}" ]] || [[ -z "${WEB_ECR:-}" ]] || [[ -z "${WORKER_ECR:-}" ]]; then
  echo "Run Terraform apply first so ECR repos exist. Example: make aws-stg-apply" >&2
  exit 1
fi

aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${API_ECR%%/*}"

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'norev')"
TAG_SHA="${GIT_SHA}"
TAG_LATEST="${ENV}-latest"

echo "--- Build API ---"
docker build -f infra/docker/api/Dockerfile -t "${API_ECR}:${TAG_SHA}" -t "${API_ECR}:${TAG_LATEST}" .
echo "--- Build Web (NEXT_PUBLIC_API_BASE_URL=$API_BASE_URL) ---"
docker build -f infra/docker/web/Dockerfile --build-arg NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL" \
  -t "${WEB_ECR}:${TAG_SHA}" -t "${WEB_ECR}:${TAG_LATEST}" .
echo "--- Build Worker ---"
docker build -f infra/docker/worker/Dockerfile -t "${WORKER_ECR}:${TAG_SHA}" -t "${WORKER_ECR}:${TAG_LATEST}" .

echo "--- Push API ---"
docker push "${API_ECR}:${TAG_SHA}"
docker push "${API_ECR}:${TAG_LATEST}"
echo "--- Push Web ---"
docker push "${WEB_ECR}:${TAG_SHA}"
docker push "${WEB_ECR}:${TAG_LATEST}"
echo "--- Push Worker ---"
docker push "${WORKER_ECR}:${TAG_SHA}"
docker push "${WORKER_ECR}:${TAG_LATEST}"

echo ""
echo "--- Final image URIs ---"
echo "API:   ${API_ECR}:${TAG_SHA}  (and :${TAG_LATEST})"
echo "Web:   ${WEB_ECR}:${TAG_SHA}  (and :${TAG_LATEST})"
echo "Worker: ${WORKER_ECR}:${TAG_SHA}  (and :${TAG_LATEST})"
