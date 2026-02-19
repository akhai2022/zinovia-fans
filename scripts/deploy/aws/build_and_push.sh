#!/usr/bin/env bash
# Build and push API, Web, Worker images to ECR for prod.
# Run from repo root. Requires: AWS CLI, Docker, Terraform applied so ECR repos exist.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TF_DIR="${TF_DIR:-$REPO_ROOT/infra/aws/terraform}"
ENV="${ENV:-prod}"
API_BASE_URL="${API_BASE_URL:-https://api.zinovia.ai}"
# Disabled: the web container cannot resolve api.zinovia.ai from inside the VPC.
# Browser calls https://api.zinovia.ai directly; CORS is configured to allow this.
API_SAME_ORIGIN_PROXY="${API_SAME_ORIGIN_PROXY:-false}"
STRIPE_PUBLISHABLE_KEY="${STRIPE_PUBLISHABLE_KEY:-}"
RETRY_ATTEMPTS="${RETRY_ATTEMPTS:-5}"
RETRY_SLEEP_BASE_SECONDS="${RETRY_SLEEP_BASE_SECONDS:-2}"
# Set NO_CACHE=--no-cache to force clean builds (avoids stale layer issues).
DOCKER_BUILD_FLAGS="${NO_CACHE:-}"

cd "$REPO_ROOT"

retry() {
  local -r what="$1"
  shift
  local attempt=1
  while true; do
    if "$@"; then
      return 0
    fi
    if [[ "$attempt" -ge "$RETRY_ATTEMPTS" ]]; then
      echo "ERROR: failed after ${attempt} attempts: ${what}" >&2
      return 1
    fi
    local sleep_for=$((RETRY_SLEEP_BASE_SECONDS * attempt))
    echo "WARN: attempt ${attempt} failed: ${what}; retrying in ${sleep_for}s..." >&2
    sleep "$sleep_for"
    attempt=$((attempt + 1))
  done
}

if [[ "$ENV" != "prod" ]]; then
  echo "ENV must be prod (got: $ENV)" >&2
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
  echo "Run Terraform apply first so ECR repos exist. Example: make aws-prod-apply" >&2
  exit 1
fi

retry "docker login to ECR" bash -lc "aws ecr get-login-password --region \"$AWS_REGION\" | docker login --username AWS --password-stdin \"${API_ECR%%/*}\""

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'norev')"
TAG_SHA="${GIT_SHA}"
TAG_LATEST="${ENV}-latest"
TAG_ECS_LATEST="latest"

echo "--- Running tests before build ---"
COMPOSE_FILE="$REPO_ROOT/infra/compose/docker-compose.yml"
if docker compose -f "$COMPOSE_FILE" ps --quiet worker 2>/dev/null | grep -q .; then
  docker compose -f "$COMPOSE_FILE" exec -T worker sh -c "cd /app/apps/api && python -m pytest tests/ -q --tb=short" \
    || { echo "ERROR: API tests failed — aborting build" >&2; exit 1; }
  docker compose -f "$COMPOSE_FILE" exec -T worker sh -c "cd /app/apps/worker && python -m pytest tests/ -q --tb=short" \
    || { echo "ERROR: Worker tests failed — aborting build" >&2; exit 1; }
else
  echo "WARN: Docker Compose services not running — skipping pre-build tests" >&2
fi

echo "--- Build API ---"
docker build ${DOCKER_BUILD_FLAGS} -f infra/docker/api/Dockerfile \
  -t "${API_ECR}:${TAG_SHA}" \
  -t "${API_ECR}:${TAG_LATEST}" \
  -t "${API_ECR}:${TAG_ECS_LATEST}" \
  .
APP_URL="--build-arg NEXT_PUBLIC_APP_URL=https://zinovia.ai"
echo "--- Build Web (NEXT_PUBLIC_API_BASE_URL=$API_BASE_URL) ---"
docker build ${DOCKER_BUILD_FLAGS} -f infra/docker/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL" $APP_URL \
  --build-arg NEXT_PUBLIC_API_SAME_ORIGIN_PROXY="$API_SAME_ORIGIN_PROXY" \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="$STRIPE_PUBLISHABLE_KEY" \
  -t "${WEB_ECR}:${TAG_SHA}" \
  -t "${WEB_ECR}:${TAG_LATEST}" \
  -t "${WEB_ECR}:${TAG_ECS_LATEST}" \
  .
echo "--- Build Worker ---"
docker build ${DOCKER_BUILD_FLAGS} -f infra/docker/worker/Dockerfile \
  -t "${WORKER_ECR}:${TAG_SHA}" \
  -t "${WORKER_ECR}:${TAG_LATEST}" \
  -t "${WORKER_ECR}:${TAG_ECS_LATEST}" \
  .

echo "--- Push API ---"
retry "docker push ${API_ECR}:${TAG_SHA}" docker push "${API_ECR}:${TAG_SHA}"
retry "docker push ${API_ECR}:${TAG_LATEST}" docker push "${API_ECR}:${TAG_LATEST}"
retry "docker push ${API_ECR}:${TAG_ECS_LATEST}" docker push "${API_ECR}:${TAG_ECS_LATEST}"
echo "--- Push Web ---"
retry "docker push ${WEB_ECR}:${TAG_SHA}" docker push "${WEB_ECR}:${TAG_SHA}"
retry "docker push ${WEB_ECR}:${TAG_LATEST}" docker push "${WEB_ECR}:${TAG_LATEST}"
retry "docker push ${WEB_ECR}:${TAG_ECS_LATEST}" docker push "${WEB_ECR}:${TAG_ECS_LATEST}"
echo "--- Push Worker ---"
retry "docker push ${WORKER_ECR}:${TAG_SHA}" docker push "${WORKER_ECR}:${TAG_SHA}"
retry "docker push ${WORKER_ECR}:${TAG_LATEST}" docker push "${WORKER_ECR}:${TAG_LATEST}"
retry "docker push ${WORKER_ECR}:${TAG_ECS_LATEST}" docker push "${WORKER_ECR}:${TAG_ECS_LATEST}"

echo ""
echo "--- Final image URIs ---"
echo "API:    ${API_ECR}:${TAG_SHA}"
echo "API:    ${API_ECR}:${TAG_LATEST}"
echo "API:    ${API_ECR}:${TAG_ECS_LATEST}"
echo "Web:    ${WEB_ECR}:${TAG_SHA}"
echo "Web:    ${WEB_ECR}:${TAG_LATEST}"
echo "Web:    ${WEB_ECR}:${TAG_ECS_LATEST}"
echo "Worker: ${WORKER_ECR}:${TAG_SHA}"
echo "Worker: ${WORKER_ECR}:${TAG_LATEST}"
echo "Worker: ${WORKER_ECR}:${TAG_ECS_LATEST}"
