# ADR 0001: Initial architecture

## Status
Accepted

## Context
We need a monorepo with a FastAPI backend, Celery worker, Next.js frontend, and contract-first API integration. Local development must be containerized with Docker Compose and production deploys target AWS.

## Decision
- Use FastAPI + SQLAlchemy async + Alembic for the API.
- Use Celery with Redis broker for background work.
- Use Next.js App Router + Tailwind + shadcn/ui for the web app.
- Use OpenAPI as source of truth and generate a TypeScript client.
- Use MinIO locally with a storage abstraction for S3 in production.
- Use ledger-first accounting with transactional balance updates.

## Consequences
- CI must verify contracts, migrations, linting, typechecks, and builds.
- Backend changes require regenerating the TS client in the same PR.
