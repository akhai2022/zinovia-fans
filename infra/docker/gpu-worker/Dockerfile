# GPU Worker Dockerfile — MimicMotion (SVD-based character animation)
#
# Self-hosted motion transfer on g4dn.2xlarge (8 vCPU, 32GB RAM, 16GB T4).
# Model weights ~12GB total (SVD base + MimicMotion + DWPose).
#
# Uses python:3.12-slim as base + installs torch with CUDA support via pip.
# No NVIDIA base image needed — PyTorch bundles CUDA runtime.

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/models \
    TRANSFORMERS_CACHE=/app/models/transformers \
    PYTHONPATH=/app/apps/api:/app/apps/worker:/app/vendor/MimicMotion \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget build-essential ffmpeg git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy source code
COPY apps/api/app /app/apps/api/app
COPY apps/worker/worker /app/apps/worker/worker
COPY apps/worker/pyproject.toml /app/apps/worker/pyproject.toml

# Install worker deps
RUN cd /app/apps/worker && \
    pip install . && \
    pip install \
    fastapi uvicorn httptools \
    "sqlalchemy[asyncio]" asyncpg \
    pydantic pydantic-settings \
    argon2-cffi python-jose passlib python-multipart \
    "redis[hiredis]" minio resend

# Install PyTorch with CUDA 12.4 support (bundles CUDA runtime, no nvidia base needed)
RUN pip install \
    torch torchvision --index-url https://download.pytorch.org/whl/cu124 && \
    pip install \
    "diffusers>=0.27" \
    "transformers>=4.44" \
    "accelerate>=0.27" \
    einops omegaconf decord \
    onnxruntime-gpu \
    matplotlib

# Clone MimicMotion repo (vendored for pipeline + DWPose code)
RUN git clone --depth 1 https://github.com/Tencent/MimicMotion.git /app/vendor/MimicMotion && \
    rm -rf /app/vendor/MimicMotion/.git && \
    # Fix safe_globals call for PyTorch >= 2.6 (expects single list, not *args)
    sed -i 's/with torch.serialization.safe_globals(\*allowed_modules):/with torch.serialization.safe_globals(allowed_modules):/' \
        /app/vendor/MimicMotion/mimicmotion/utils/loader.py

# Pre-download model weights at build time (~12GB total)
RUN mkdir -p /app/models/DWPose && \
    wget -q --show-progress \
         https://huggingface.co/tencent/MimicMotion/resolve/main/MimicMotion_1-1.pth \
         -O /app/models/MimicMotion_1-1.pth && \
    wget -q https://huggingface.co/yzd-v/DWPose/resolve/main/yolox_l.onnx \
         -O /app/models/DWPose/yolox_l.onnx && \
    wget -q https://huggingface.co/yzd-v/DWPose/resolve/main/dw-ll_ucoco_384.onnx \
         -O /app/models/DWPose/dw-ll_ucoco_384.onnx

# SVD base model (~5-6GB) downloads on first pipeline load.
# Not pre-downloaded here because the model is gated on HuggingFace.
# First job start will take ~5 min extra for the download.

# Celery worker: login to HuggingFace (for gated models) then start on 'gpu' queue
CMD ["sh", "-c", "if [ -n \"$HF_TOKEN\" ]; then python -c \"from huggingface_hub import login; login(token='$HF_TOKEN', add_to_git_credential=False)\" 2>/dev/null; fi && celery -A worker.celery_app worker -l INFO -c ${CELERY_CONCURRENCY:-1} -Q gpu"]
