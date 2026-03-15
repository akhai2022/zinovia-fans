# GPU Worker Dockerfile — Wan2.2-Animate-14B inference
#
# Installs all worker dependencies from pyproject.toml, then upgrades
# torch/diffusers to GPU-compatible versions for Wan2.2-Animate.

FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/models \
    TRANSFORMERS_CACHE=/app/models/transformers \
    PYTHONPATH=/app/apps/api:/app/apps/worker \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility

# Install Python 3.12 + system deps (single layer)
RUN apt-get update && apt-get install -y --no-install-recommends \
    software-properties-common curl build-essential && \
    add-apt-repository ppa:deadsnakes/ppa -y && \
    apt-get update && apt-get install -y --no-install-recommends \
    python3.12 python3.12-venv python3.12-dev \
    ffmpeg git && \
    ln -sf /usr/bin/python3.12 /usr/local/bin/python && \
    ln -sf /usr/bin/python3.12 /usr/local/bin/python3 && \
    python3 -m ensurepip --upgrade 2>/dev/null || true && \
    python3 -m pip install --upgrade pip setuptools wheel && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy source code (skip assets/ to avoid flat-layout discovery issue)
COPY apps/api/app /app/apps/api/app
COPY apps/worker/worker /app/apps/worker/worker
COPY apps/worker/pyproject.toml /app/apps/worker/pyproject.toml

# Install ALL worker deps from pyproject.toml (same as CPU worker)
# Then upgrade torch/diffusers for GPU Wan2.2-Animate support
RUN cd /app/apps/worker && \
    pip install . && \
    pip install \
    fastapi uvicorn httptools \
    "sqlalchemy[asyncio]" asyncpg \
    pydantic pydantic-settings \
    argon2-cffi python-jose passlib python-multipart \
    "redis[hiredis]" minio && \
    pip install --upgrade \
    "torch>=2.5" \
    "diffusers>=0.37" \
    "transformers>=4.49" \
    "accelerate>=1.0"

# Celery worker: listen on 'gpu' queue
CMD ["sh", "-c", "celery -A worker.celery_app worker -l INFO -c ${CELERY_CONCURRENCY:-1} -Q gpu"]
