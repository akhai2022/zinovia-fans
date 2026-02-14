FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN groupadd --gid 10001 appuser && \
    useradd --uid 10001 --gid 10001 --create-home appuser

WORKDIR /app

FROM base AS builder

ARG APT_RETRIES=5
ARG APT_SLEEP_SECONDS=3
ARG PIP_RETRIES=10
ARG PIP_DEFAULT_TIMEOUT=120

RUN set -eux; \
    i=1; \
    while true; do \
      apt-get update && \
      apt-get install -y --no-install-recommends build-essential curl && \
      rm -rf /var/lib/apt/lists/* && \
      break; \
      if [ "$i" -ge "$APT_RETRIES" ]; then \
        echo "apt-get failed after ${i} attempts" >&2; \
        exit 1; \
      fi; \
      echo "apt-get attempt ${i} failed; retrying in ${APT_SLEEP_SECONDS}s..." >&2; \
      sleep "$APT_SLEEP_SECONDS"; \
      i=$((i+1)); \
    done

COPY apps/api/pyproject.toml /app/apps/api/pyproject.toml
COPY apps/api/app /app/apps/api/app
COPY apps/worker/pyproject.toml /app/apps/worker/pyproject.toml
COPY apps/worker/worker /app/apps/worker/worker

RUN pip install --no-cache-dir --retries ${PIP_RETRIES} --timeout ${PIP_DEFAULT_TIMEOUT} -e /app/apps/api[dev] && \
    pip install --no-cache-dir --retries ${PIP_RETRIES} --timeout ${PIP_DEFAULT_TIMEOUT} -e /app/apps/worker[dev]

FROM base AS runtime

# Font for watermark; ffmpeg for video poster extraction
RUN set -eux; \
    i=1; \
    while true; do \
      apt-get update && \
      apt-get install -y --no-install-recommends fonts-dejavu-core ffmpeg && \
      rm -rf /var/lib/apt/lists/* && \
      break; \
      if [ "$i" -ge "$APT_RETRIES" ]; then \
        echo "apt-get failed after ${i} attempts" >&2; \
        exit 1; \
      fi; \
      echo "apt-get attempt ${i} failed; retrying in ${APT_SLEEP_SECONDS}s..." >&2; \
      sleep "$APT_SLEEP_SECONDS"; \
      i=$((i+1)); \
    done
ENV WORKER_FONT_PATH=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf

COPY --from=builder /usr/local /usr/local
COPY apps/api/app /app/apps/api/app
COPY apps/worker/worker /app/apps/worker/worker
COPY apps/worker/assets /app/apps/worker/assets

USER appuser

CMD ["sh", "-c", "celery -A worker.celery_app worker -l INFO -c ${CELERY_CONCURRENCY:-2}"]
