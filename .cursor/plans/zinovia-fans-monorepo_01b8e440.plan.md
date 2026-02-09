---
name: zinovia-fans-monorepo
overview: Scaffold a full monorepo from scratch with Docker Compose local dev, FastAPI/Celery backend, Next.js frontend, contracts pipeline, and AWS deployment per requirements.
todos:
  - id: scaffold-structure
    content: Create monorepo layout and governance files
    status: pending
  - id: docker-make
    content: Add Dockerfiles, compose, and Make targets
    status: pending
  - id: api-core
    content: Build API core, db, health, tests
    status: pending
  - id: contracts
    content: Add OpenAPI export + TS client pipeline
    status: pending
  - id: features
    content: Implement auth, media, billing skeletons
    status: pending
  - id: aws-ci
    content: Add AWS infra and CI workflow
    status: pending
isProject: false
---

# Monorepo Scaffold Plan

## Scope summary

- Build full repo layout from scratch under the workspace root.
- Include governance files, Docker/Compose setup, API core + auth/media/billing skeletons, contracts pipeline, AWS infra, and Make targets.

## Repo structure

- Create the requested layout under the root:
  - `apps/api`, `apps/worker`, `apps/web`, `packages/contracts`, `infra/compose`, `infra/docker`, `infra/aws`, `docs/adr`, `docs/runbook`, `scripts`.

## Governance deliverables

- Add `CONTRIBUTING.md`, `CODEOWNERS`, PR template, and ADR 0001.
  - Files: [/home/akhai/workspace/zinovia-fans/CONTRIBUTING.md](/home/akhai/workspace/zinovia-fans/CONTRIBUTING.md), [/home/akhai/workspace/zinovia-fans/CODEOWNERS](/home/akhai/workspace/zinovia-fans/CODEOWNERS), [/home/akhai/workspace/zinovia-fans/.github/PULL_REQUEST_TEMPLATE.md](/home/akhai/workspace/zinovia-fans/.github/PULL_REQUEST_TEMPLATE.md), [/home/akhai/workspace/zinovia-fans/docs/adr/0001-initial-architecture.md](/home/akhai/workspace/zinovia-fans/docs/adr/0001-initial-architecture.md)

## Docker + Make

- Add multi-stage Dockerfiles (non-root) for API, worker, web.
- Add docker-compose for local dev with Postgres, Redis, MinIO, API, worker, web; include health checks and startup wait logic for API/worker.
- Add `Makefile` targets for `up`, `down`, `logs`, `api-test`, `api-lint`, `api-typecheck`, `web-lint`, `web-build`, `migrate`, `seed`, `reset-db`, `gen-contracts`.
  - Files: [/home/akhai/workspace/zinovia-fans/infra/compose/docker-compose.yml](/home/akhai/workspace/zinovia-fans/infra/compose/docker-compose.yml), [/home/akhai/workspace/zinovia-fans/infra/docker/api/Dockerfile](/home/akhai/workspace/zinovia-fans/infra/docker/api/Dockerfile), [/home/akhai/workspace/zinovia-fans/infra/docker/worker/Dockerfile](/home/akhai/workspace/zinovia-fans/infra/docker/worker/Dockerfile), [/home/akhai/workspace/zinovia-fans/infra/docker/web/Dockerfile](/home/akhai/workspace/zinovia-fans/infra/docker/web/Dockerfile), [/home/akhai/workspace/zinovia-fans/Makefile](/home/akhai/workspace/zinovia-fans/Makefile)

## API core

- Scaffold FastAPI app with settings, JSON logging, error handling, DB async setup, migrations, `/health` and `/ready`.
- Add test harness with pytest, ruff, mypy configs.
  - Files: [/home/akhai/workspace/zinovia-fans/apps/api/app/main.py](/home/akhai/workspace/zinovia-fans/apps/api/app/main.py), [/home/akhai/workspace/zinovia-fans/apps/api/app/core/settings.py](/home/akhai/workspace/zinovia-fans/apps/api/app/core/settings.py), [/home/akhai/workspace/zinovia-fans/apps/api/app/core/logging.py](/home/akhai/workspace/zinovia-fans/apps/api/app/core/logging.py), [/home/akhai/workspace/zinovia-fans/apps/api/app/db/session.py](/home/akhai/workspace/zinovia-fans/apps/api/app/db/session.py), [/home/akhai/workspace/zinovia-fans/apps/api/app/db/migrations](/home/akhai/workspace/zinovia-fans/apps/api/app/db/migrations), [/home/akhai/workspace/zinovia-fans/apps/api/tests](/home/akhai/workspace/zinovia-fans/apps/api/tests)

## Contracts pipeline

- Export OpenAPI JSON from API and generate TS client under `packages/contracts`.
- Wire CI check and `make gen-contracts` to keep OpenAPI + client in sync.
  - Files: [/home/akhai/workspace/zinovia-fans/packages/contracts](/home/akhai/workspace/zinovia-fans/packages/contracts), [/home/akhai/workspace/zinovia-fans/scripts/gen-contracts.sh](/home/akhai/workspace/zinovia-fans/scripts/gen-contracts.sh)

## Auth module (feature-first)

- Implement `api/modules/auth` with users/profiles, cookie JWT, RBAC, rate limit, CSRF strategy doc, and tests.
- Implement `web/features/auth` with `/login`, `/signup`, `/me`, using generated client.
  - Files: [/home/akhai/workspace/zinovia-fans/apps/api/app/modules/auth](/home/akhai/workspace/zinovia-fans/apps/api/app/modules/auth), [/home/akhai/workspace/zinovia-fans/apps/web/app/login/page.tsx](/home/akhai/workspace/zinovia-fans/apps/web/app/login/page.tsx), [/home/akhai/workspace/zinovia-fans/apps/web/app/signup/page.tsx](/home/akhai/workspace/zinovia-fans/apps/web/app/signup/page.tsx), [/home/akhai/workspace/zinovia-fans/apps/web/app/me/page.tsx](/home/akhai/workspace/zinovia-fans/apps/web/app/me/page.tsx)

## Media subsystem

- Add storage abstraction with MinIO signed URLs in local, S3 in prod by config.
- Add worker task for thumbnail generation and API endpoints for signed URLs; enforce access.
  - Files: [/home/akhai/workspace/zinovia-fans/apps/api/app/modules/media](/home/akhai/workspace/zinovia-fans/apps/api/app/modules/media), [/home/akhai/workspace/zinovia-fans/apps/worker/app/tasks/media.py](/home/akhai/workspace/zinovia-fans/apps/worker/app/tasks/media.py)

## Billing skeleton

- Add Stripe webhook receiver with signature verification and idempotency table; create ledger schema with balances table updated transactionally.
  - Files: [/home/akhai/workspace/zinovia-fans/apps/api/app/modules/billing](/home/akhai/workspace/zinovia-fans/apps/api/app/modules/billing), [/home/akhai/workspace/zinovia-fans/apps/api/app/modules/ledger](/home/akhai/workspace/zinovia-fans/apps/api/app/modules/ledger)

## AWS infra + docs

- Add Terraform (ECS, RDS, S3, CloudFront, etc.) and deploy runbook.
  - Files: [/home/akhai/workspace/zinovia-fans/infra/aws](/home/akhai/workspace/zinovia-fans/infra/aws), [/home/akhai/workspace/zinovia-fans/docs/runbook](/home/akhai/workspace/zinovia-fans/docs/runbook)

## CI

- Add a CI workflow running lint/typecheck/tests, web build, contracts check, and migration check.
  - Files: [/home/akhai/workspace/zinovia-fans/.github/workflows/ci.yml](/home/akhai/workspace/zinovia-fans/.github/workflows/ci.yml)

## Validation

- Ensure `make api-test` and `make web-build` pass locally.
- Provide exact local run commands and key excerpts only in the final response.

