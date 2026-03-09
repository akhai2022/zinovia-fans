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

# Pre-download AI safety models at build time to avoid cold-start latency.
# Models are cached in /app/models (HF_HOME). Total ~1.76GB.
ENV HF_HOME=/app/models \
    TRANSFORMERS_CACHE=/app/models/transformers
RUN python -c "\
from transformers import pipeline; \
pipeline('image-classification', model='Falconsai/nsfw_image_detection'); \
pipeline('image-classification', model='nateraw/vit-age-classifier'); \
from transformers import BlipProcessor, BlipForConditionalGeneration; \
BlipProcessor.from_pretrained('Salesforce/blip-image-captioning-base'); \
BlipForConditionalGeneration.from_pretrained('Salesforce/blip-image-captioning-base'); \
from sentence_transformers import SentenceTransformer; \
SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# Pre-download CatVTON virtual try-on models (~2.5GB additional).
# - runwayml/stable-diffusion-inpainting: UNet + scheduler (~2GB)
# - stabilityai/sd-vae-ft-mse: VAE (~330MB)
# - zhengchong/CatVTON: attention checkpoint (~50MB)
# - mattmdjaga/segformer_b2_clothes: clothing segmenter (~90MB)
RUN python <<'PYEOF'
from diffusers import AutoencoderKL, DDIMScheduler, UNet2DConditionModel
from transformers import AutoModelForSemanticSegmentation, SegformerImageProcessor
from huggingface_hub import snapshot_download

# SD inpainting base (UNet + scheduler)
UNet2DConditionModel.from_pretrained("runwayml/stable-diffusion-inpainting", subfolder="unet")
DDIMScheduler.from_pretrained("runwayml/stable-diffusion-inpainting", subfolder="scheduler")

# VAE
AutoencoderKL.from_pretrained("stabilityai/sd-vae-ft-mse")

# CatVTON attention weights
snapshot_download(repo_id="zhengchong/CatVTON")

# Clothing segmenter (for automasking)
SegformerImageProcessor.from_pretrained("mattmdjaga/segformer_b2_clothes")
AutoModelForSemanticSegmentation.from_pretrained("mattmdjaga/segformer_b2_clothes")

print("CatVTON models pre-downloaded successfully")
PYEOF

# Pre-install argostranslate language packages (en→fr, en→es, en→ar) at build time.
# Packages are cached in /app/argos so the worker doesn't download at runtime.
ENV ARGOS_PACKAGES_DIR=/app/argos
RUN python <<'PYEOF'
import argostranslate.package
argostranslate.package.update_package_index()
available = argostranslate.package.get_available_packages()
for pkg in available:
    if pkg.from_code == 'en' and pkg.to_code in ('fr', 'es', 'ar'):
        argostranslate.package.install_from_path(pkg.download())
        print(f'Installed: en -> {pkg.to_code}')
PYEOF

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
COPY --from=builder /app/models /app/models
COPY --from=builder /app/argos /app/argos
COPY apps/api/app /app/apps/api/app
COPY apps/worker/worker /app/apps/worker/worker
COPY apps/worker/assets /app/apps/worker/assets

# AI model cache paths (pre-downloaded in builder stage)
ENV HF_HOME=/app/models \
    TRANSFORMERS_CACHE=/app/models/transformers \
    ARGOS_PACKAGES_DIR=/app/argos

USER appuser

# Concurrency default 1 to avoid multiple model copies in memory.
# Recommended ECS sizing: 2 vCPU, 8 GB RAM for PyTorch CPU inference.
CMD ["sh", "-c", "celery -A worker.celery_app worker -l INFO -c ${CELERY_CONCURRENCY:-1}"]
