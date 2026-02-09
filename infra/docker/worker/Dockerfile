FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN groupadd --gid 10001 appuser && \
    useradd --uid 10001 --gid 10001 --create-home appuser

WORKDIR /app

FROM base AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential curl && \
    rm -rf /var/lib/apt/lists/*

COPY apps/api/pyproject.toml /app/apps/api/pyproject.toml
COPY apps/api/app /app/apps/api/app
COPY apps/worker/pyproject.toml /app/apps/worker/pyproject.toml
COPY apps/worker/worker /app/apps/worker/worker

RUN pip install --no-cache-dir -e /app/apps/api[dev] && \
    pip install --no-cache-dir -e /app/apps/worker[dev]

FROM base AS runtime

# Font for watermark; ffmpeg for video poster extraction
RUN apt-get update && \
    apt-get install -y --no-install-recommends fonts-dejavu-core ffmpeg && \
    rm -rf /var/lib/apt/lists/*
ENV WORKER_FONT_PATH=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf

COPY --from=builder /usr/local /usr/local
COPY apps/api/app /app/apps/api/app
COPY apps/worker/worker /app/apps/worker/worker
COPY apps/worker/assets /app/apps/worker/assets

USER appuser

CMD ["celery", "-A", "worker.celery_app", "worker", "-l", "INFO"]
