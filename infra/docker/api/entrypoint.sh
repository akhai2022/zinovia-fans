#!/bin/sh
set -e

# Run Alembic migrations before starting the API server.
# This ensures schema changes are applied automatically on every deploy.
# "upgrade head" is idempotent -- a no-op when already at the latest revision.

cd /app/apps/api

echo "[entrypoint] Running database migrations..."
if python -m alembic upgrade head; then
  echo "[entrypoint] Migrations complete."
else
  echo "[entrypoint] WARNING: migrations failed (exit $?). Starting server anyway." >&2
  echo "[entrypoint] The API may encounter errors if the schema is out of date." >&2
fi

# Hand off to the original CMD (uvicorn)
exec "$@"
