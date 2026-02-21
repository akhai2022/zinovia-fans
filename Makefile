.DEFAULT_GOAL := help

# Canonical env file for local compose (repo root .env). Run make from repo root.
COMPOSE_ENV ?= --env-file .env
COMPOSE_FILE := infra/compose/docker-compose.yml
COMPOSE := docker compose $(COMPOSE_ENV) -f $(COMPOSE_FILE)
COMPOSE_EXEC := $(COMPOSE) exec -T

help:
	@echo "Local: launch up down logs api-test worker-test api-lint api-typecheck web-lint web-build web-test migrate seed reset-db gen-contracts verify-local"
	@echo "AWS:   aws-prod-plan aws-prod-apply aws-prod-destroy aws-prod-outputs"
	@echo "Deploy: aws-prod-build-push aws-prod-deploy aws-prod-redeploy aws-prod-smoke"
	@echo "Fix: ./scripts/restore-secrets.sh prod  # when secrets scheduled for deletion"

# Start local stack (alias for up). From repo root: make launch [then make migrate if first run].
launch: up

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down -v

logs:
	$(COMPOSE) logs -f --tail=200

migrate:
	$(COMPOSE_EXEC) api sh -c "cd /app/apps/api && alembic upgrade head"

seed:
	$(COMPOSE_EXEC) api sh -c "cd /app/apps/api && python -m app.tools.seed_data"

reset-db:
	$(COMPOSE_EXEC) api sh -c "cd /app/apps/api && python -m app.tools.reset_db"

api-test:
	$(COMPOSE_EXEC) api sh -c "cd /app/apps/api && pytest -q"

worker-test:
	$(COMPOSE_EXEC) worker sh -c "cd /app && PYTHONPATH=/app/apps/api:/app/apps/worker python -m pytest apps/worker/tests -q"

api-lint:
	$(COMPOSE_EXEC) api sh -c "cd /app/apps/api && ruff check . --cache-dir /tmp/.ruff_cache"

api-typecheck:
	$(COMPOSE_EXEC) api sh -c "cd /app/apps/api && mypy ."

web-lint:
	$(COMPOSE) run --rm --user root web sh -c "npm --prefix apps/web run lint"

web-build:
	$(COMPOSE) run --rm --user root web sh -c "npm --prefix apps/web run build"

gen-contracts:
	$(COMPOSE_EXEC) api sh -c "cd /app/apps/api && python -m app.tools.export_openapi --stdout" > packages/contracts/openapi.json
	$(COMPOSE) run --rm --user root web npm --prefix /app/packages/contracts run gen

gen-contracts-api:
	$(COMPOSE_EXEC) api sh -c "cd /app/apps/api && python -m app.tools.export_openapi --stdout" > packages/contracts/openapi.json

verify-local:
	./scripts/verify/local_e2e.sh

# Requires web app running (make up). Runs Playwright in Docker (compose_default) so deps are available.
# Host alternative: npm install from repo root, then cd apps/web && npx playwright test (BASE_URL=http://localhost:3000).
WEB_TEST_NETWORK := compose_default
web-test:
	docker run --rm --network $(WEB_TEST_NETWORK) \
	  -v "$$(pwd):/app" -w /app \
	  -e PLAYWRIGHT_BASE_URL=http://web:3000 \
	  mcr.microsoft.com/playwright:v1.49.0-noble \
	  sh -c "npm install && cd apps/web && npx playwright test"

# -----------------------------------------------------------------------------
# AWS (infra/aws/terraform; dedicated new VPC, us-east-1)
# -----------------------------------------------------------------------------
AWS_TF_DIR := infra/aws/terraform
# Use repo .tools/terraform if present (not in PATH); override with make TERRAFORM=/path/to/terraform
TERRAFORM ?= $(shell test -x .tools/terraform && echo ./.tools/terraform || echo terraform)
AWS_TF := $(TERRAFORM) -chdir=$(AWS_TF_DIR)

aws-prod-plan:
	$(AWS_TF) init -backend=false
	$(AWS_TF) plan -var-file=env/prod.tfvars -out=prod.plan

aws-prod-apply:
	$(AWS_TF) init -backend=false
	$(AWS_TF) apply -var-file=env/prod.tfvars -auto-approve

# Destroy full prod stack. Allow 20–40 min. Re-run if interrupted.
aws-prod-destroy:
	$(AWS_TF) init -backend=false
	$(AWS_TF) destroy -var-file=env/prod.tfvars -auto-approve

aws-prod-outputs:
	@echo "--- Prod (run from repo root after aws-prod-apply) ---"
	@$(AWS_TF) output 2>/dev/null || (echo "Run: make aws-prod-apply first" && exit 1)

# Build and push all Docker images to ECR. Set NO_CACHE=1 for clean build.
aws-prod-build-push:
	$(if $(NO_CACHE),NO_CACHE=--no-cache) ./scripts/deploy/aws/build_and_push.sh

# Full deploy: terraform apply + build/push + force ECS redeploy + wait for stability.
aws-prod-deploy: aws-prod-apply aws-prod-build-push aws-prod-redeploy

# Build + push images, force ECS redeploy, wait for stability (skips terraform).
aws-prod-redeploy:
	./scripts/deploy/aws/prod_redeploy.sh

# Post-deploy verification: health, DNS, billing, optional signup test.
aws-prod-smoke:
	./scripts/verify/prod_smoke.sh

# API-level smoke test (register, verify, login, upload, post, billing).
aws-prod-api-smoke:
	API_BASE_URL=https://api.zinovia.ai ./scripts/api_smoke_test.sh

# Web-level smoke test (all frontend pages return 200).
aws-prod-web-smoke:
	WEB_BASE_URL=https://zinovia.ai ./scripts/web_smoke_test.sh

