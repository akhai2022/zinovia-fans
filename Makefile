.DEFAULT_GOAL := help

# Canonical env file for local compose (repo root .env). Run make from repo root.
COMPOSE_ENV ?= --env-file .env
COMPOSE_FILE := infra/compose/docker-compose.yml
COMPOSE := docker compose $(COMPOSE_ENV) -f $(COMPOSE_FILE)
COMPOSE_EXEC := $(COMPOSE) exec -T

help:
	@echo "Targets: launch up down logs api-test worker-test api-lint api-typecheck web-lint web-build web-test migrate seed reset-db gen-contracts verify-local"
	@echo "AWS: aws-stg-plan aws-stg-apply aws-stg-outputs aws-stg-destroy aws-prod-plan aws-prod-apply aws-prod-destroy terraform-destroy"

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
	$(COMPOSE_EXEC) api sh -c "cd /app/apps/api && ruff check ."

api-typecheck:
	$(COMPOSE_EXEC) api sh -c "cd /app/apps/api && mypy ."

web-lint:
	$(COMPOSE) run --rm --user root web sh -c "npm --prefix apps/web run lint"

web-build:
	$(COMPOSE) run --rm --user root web sh -c "npm --prefix apps/web run build"

gen-contracts:
	$(COMPOSE_EXEC) api sh -c "cd /app/apps/api && python -m app.tools.export_openapi --stdout" > packages/contracts/openapi.json
	$(COMPOSE) run --rm --user root web npm --prefix /app/packages/contracts run gen

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
AWS_TF := terraform -chdir=$(AWS_TF_DIR)

aws-stg-plan:
	$(AWS_TF) init -backend=false
	$(AWS_TF) plan -var-file=env/staging.tfvars -out=staging.plan

aws-stg-apply:
	$(AWS_TF) init -backend=false
	$(AWS_TF) apply -var-file=env/staging.tfvars -auto-approve

aws-stg-outputs:
	@echo "--- Staging (run from repo root after aws-stg-apply) ---"
	@$(AWS_TF) output 2>/dev/null || (echo "Run: make aws-stg-apply first" && exit 1)

# Destroy full staging stack. Allow 20–40 min (Lambda ENIs can delay SG deletion). Re-run if interrupted.
aws-stg-destroy:
	$(AWS_TF) init -backend=false
	$(AWS_TF) destroy -var-file=env/staging.tfvars -auto-approve

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

# Destroy Terraform stack (default: staging). Use aws-prod-destroy for production.
terraform-destroy: aws-stg-destroy

