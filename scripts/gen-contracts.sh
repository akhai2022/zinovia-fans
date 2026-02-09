#!/usr/bin/env bash
set -euo pipefail

cd /app/apps/api
python -m app.tools.export_openapi
npm --prefix /app/packages/contracts run gen
