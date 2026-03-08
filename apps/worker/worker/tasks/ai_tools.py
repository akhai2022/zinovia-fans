"""AI tool worker tasks — remove background, cartoonize, animate image.

Pattern follows worker/tasks/media.py:
- _make_session_factory() for per-task DB sessions
- get_object_bytes / put_object_bytes for S3 I/O
- Idempotent: check job status before processing
- Try/except → update status="failed" with error_message
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from io import BytesIO

from celery import shared_task
from PIL import Image
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.settings import get_settings
from worker.storage_io import get_media_bucket, get_object_bytes, put_object_bytes

logger = logging.getLogger(__name__)

MAX_DIMENSION = 4096


def _make_session_factory() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine(str(get_settings().database_url), pool_pre_ping=True)
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


def _strip_exif(img: Image.Image) -> Image.Image:
    out = img.copy()
    out.info.clear()
    return out


def _result_object_key(job_id: str, ext: str = "png") -> str:
    return f"ai-tools/{job_id}/result.{ext}"


async def _load_job(job_id: str) -> dict | None:
    """Load job row as dict. Returns None if not found."""
    from app.modules.ai_tools.tool_models import AiToolJob

    async with _make_session_factory()() as session:
        r = await session.execute(
            select(AiToolJob).where(AiToolJob.id == uuid.UUID(job_id))
        )
        job = r.scalar_one_or_none()
        if not job:
            return None
        return {
            "id": job.id,
            "status": job.status,
            "input_object_key": job.input_object_key,
            "tool": job.tool,
            "params": job.params,
        }


async def _update_job(
    job_id: str,
    status: str,
    result_object_key: str | None = None,
    error_message: str | None = None,
    params: dict | None = None,
) -> None:
    from datetime import datetime, timezone

    from app.modules.ai_tools.tool_models import AiToolJob

    values: dict = {
        "status": status,
        "result_object_key": result_object_key,
        "error_message": error_message,
        "updated_at": datetime.now(timezone.utc),
    }
    if params is not None:
        values["params"] = params

    async with _make_session_factory()() as session:
        await session.execute(
            update(AiToolJob)
            .where(AiToolJob.id == uuid.UUID(job_id))
            .values(**values)
        )
        await session.commit()


@shared_task(name="ai_tools.remove_background")
def remove_background(job_id: str) -> str | None:
    """Remove background from an image using rembg (ONNX CPU).

    1. Load job from DB, check idempotency
    2. Download input image from S3
    3. Validate dimensions (max 4096x4096)
    4. Run rembg.remove()
    5. Strip EXIF, upload PNG result to S3
    6. Update job status
    """
    logger.info("remove_background START", extra={"job_id": job_id})

    # Load job
    job = asyncio.run(_load_job(job_id))
    if not job:
        logger.warning("Job not found", extra={"job_id": job_id})
        return None

    # Idempotent: skip if already processed
    if job["status"] in ("ready", "processing"):
        logger.info("Job already %s, skipping", job["status"], extra={"job_id": job_id})
        return None

    # Mark as processing
    asyncio.run(_update_job(job_id, "processing"))

    try:
        bucket = get_media_bucket()
        raw = get_object_bytes(bucket, job["input_object_key"])
        img = Image.open(BytesIO(raw)).convert("RGBA")

        # Validate dimensions
        w, h = img.size
        if w > MAX_DIMENSION or h > MAX_DIMENSION:
            raise ValueError(f"Image too large: {w}x{h} (max {MAX_DIMENSION}x{MAX_DIMENSION})")

        # Run background removal
        from rembg import remove

        result_img = remove(img)
        result_img = _strip_exif(result_img)

        # Encode as PNG (preserves alpha)
        buf = BytesIO()
        result_img.save(buf, format="PNG")
        buf.seek(0)

        result_key = _result_object_key(job_id)
        put_object_bytes(bucket, result_key, buf.getvalue(), "image/png")

        asyncio.run(_update_job(job_id, "ready", result_object_key=result_key))
        logger.info("remove_background DONE", extra={"job_id": job_id, "result_key": result_key})
        return result_key

    except Exception as e:
        logger.exception("remove_background FAILED", extra={"job_id": job_id})
        asyncio.run(_update_job(job_id, "failed", error_message=str(e)[:500]))
        return None


# ---------------------------------------------------------------------------
# Cartoonize (OpenCV edge-preserving filter — CPU-only, no ML model)
# ---------------------------------------------------------------------------

# Downscale large images before processing to limit CPU time.
CARTOON_MAX_DIM = 2048


def _cartoonize_image(img: Image.Image) -> Image.Image:
    """Apply cartoon effect using OpenCV bilateral filter + adaptive threshold edges.

    Pipeline:
    1. Downscale if needed (cap at CARTOON_MAX_DIM)
    2. Bilateral filter for flat colour regions (preserves edges)
    3. Adaptive threshold on grayscale for bold edges
    4. Combine: colour * edge mask
    """
    import cv2
    import numpy as np

    # Convert PIL → OpenCV BGR
    rgb = img.convert("RGB")
    arr = np.array(rgb)
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)

    # Downscale if needed
    h, w = bgr.shape[:2]
    scale = 1.0
    if max(h, w) > CARTOON_MAX_DIM:
        scale = CARTOON_MAX_DIM / max(h, w)
        bgr = cv2.resize(bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    # 1. Bilateral filter: smooth colour while preserving edges
    #    Apply multiple passes for stronger cartoon effect
    colour = bgr
    for _ in range(3):
        colour = cv2.bilateralFilter(colour, d=9, sigmaColor=75, sigmaSpace=75)

    # 2. Edge detection via adaptive threshold on grayscale
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.medianBlur(gray, 7)
    edges = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, blockSize=9, C=2
    )
    # Convert edges to 3-channel mask
    edges_3ch = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)

    # 3. Combine: colour AND edges (edges are white=255 where no edge, black=0 at edges)
    cartoon = cv2.bitwise_and(colour, edges_3ch)

    # Convert back to PIL RGB
    result_rgb = cv2.cvtColor(cartoon, cv2.COLOR_BGR2RGB)
    return Image.fromarray(result_rgb)


@shared_task(name="ai_tools.cartoonize")
def cartoonize(job_id: str) -> str | None:
    """Apply cartoon effect to an image using OpenCV (CPU-only).

    1. Load job from DB, check idempotency
    2. Download input image from S3
    3. Validate dimensions (max 4096x4096)
    4. Apply cartoon effect (bilateral filter + edge detection)
    5. Strip EXIF, upload JPEG result to S3
    6. Update job status
    """
    logger.info("cartoonize START", extra={"job_id": job_id})

    job = asyncio.run(_load_job(job_id))
    if not job:
        logger.warning("Job not found", extra={"job_id": job_id})
        return None

    if job["status"] in ("ready", "processing"):
        logger.info("Job already %s, skipping", job["status"], extra={"job_id": job_id})
        return None

    asyncio.run(_update_job(job_id, "processing"))

    try:
        bucket = get_media_bucket()
        raw = get_object_bytes(bucket, job["input_object_key"])
        img = Image.open(BytesIO(raw)).convert("RGB")

        w, h = img.size
        if w > MAX_DIMENSION or h > MAX_DIMENSION:
            raise ValueError(f"Image too large: {w}x{h} (max {MAX_DIMENSION}x{MAX_DIMENSION})")

        result_img = _cartoonize_image(img)
        result_img = _strip_exif(result_img)

        buf = BytesIO()
        result_img.save(buf, format="JPEG", quality=90)
        buf.seek(0)

        result_key = _result_object_key(job_id, ext="jpg")
        put_object_bytes(bucket, result_key, buf.getvalue(), "image/jpeg")

        asyncio.run(_update_job(job_id, "ready", result_object_key=result_key))
        logger.info("cartoonize DONE", extra={"job_id": job_id, "result_key": result_key})
        return result_key

    except Exception as e:
        logger.exception("cartoonize FAILED", extra={"job_id": job_id})
        asyncio.run(_update_job(job_id, "failed", error_message=str(e)[:500]))
        return None


# ---------------------------------------------------------------------------
# Animate Image (OpenCV Ken Burns — CPU-only, no ML model)
# ---------------------------------------------------------------------------

ANIMATE_MAX_DIM = 2048

# Motion preset configs: (zoom_factor, pan_px)
MOTION_PRESETS = {
    "gentle": (0.05, 15),
    "dynamic": (0.12, 40),
    "zoom": (0.20, 5),
}


def _smoothstep(t: float) -> float:
    """Hermite smoothstep for organic easing."""
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def _generate_ken_burns_frames(
    img: Image.Image,
    motion_preset: str = "gentle",
    num_frames: int = 15,
) -> list:
    """Generate Ken Burns motion frames from a still image.

    Returns list of numpy BGR arrays (OpenCV format).
    """
    import cv2
    import numpy as np

    zoom_factor, pan_px = MOTION_PRESETS.get(motion_preset, MOTION_PRESETS["gentle"])

    rgb = img.convert("RGB")
    arr = np.array(rgb)
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)

    # Downscale if needed
    h, w = bgr.shape[:2]
    if max(h, w) > ANIMATE_MAX_DIM:
        scale = ANIMATE_MAX_DIM / max(h, w)
        bgr = cv2.resize(bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        h, w = bgr.shape[:2]

    frames = []
    for i in range(num_frames):
        t = i / max(num_frames - 1, 1)
        ease = _smoothstep(t)

        # Zoom: start at 1.0, end at 1.0 + zoom_factor
        z = 1.0 + zoom_factor * ease

        # Pan: shift centre horizontally
        cx = w / 2 + pan_px * ease
        cy = h / 2

        # Compute crop region
        crop_w = w / z
        crop_h = h / z
        x1 = max(0, int(cx - crop_w / 2))
        y1 = max(0, int(cy - crop_h / 2))
        x2 = min(w, int(cx + crop_w / 2))
        y2 = min(h, int(cy + crop_h / 2))

        cropped = bgr[y1:y2, x1:x2]
        frame = cv2.resize(cropped, (w, h), interpolation=cv2.INTER_LINEAR)
        frames.append(frame)

    return frames


def _encode_mp4(frames: list, fps: int, output_path: str, width: int, height: int) -> None:
    """Encode frames to H.264 MP4 via ffmpeg for browser-compatible playback."""
    import os
    import subprocess
    import tempfile

    import cv2

    # Write frames as PNGs to temp dir, then encode with ffmpeg
    with tempfile.TemporaryDirectory() as tmpdir:
        for idx, f in enumerate(frames):
            cv2.imwrite(os.path.join(tmpdir, f"frame_{idx:04d}.png"), f)

        cmd = [
            "ffmpeg", "-y",
            "-framerate", str(fps),
            "-i", os.path.join(tmpdir, "frame_%04d.png"),
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2",
            output_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {result.stderr[:500]}")


def _encode_gif(frames: list, fps: int, output_path: str) -> None:
    """Encode frames to GIF using Pillow."""
    import cv2

    pil_frames = []
    for f in frames:
        rgb = cv2.cvtColor(f, cv2.COLOR_BGR2RGB)
        pil_frames.append(Image.fromarray(rgb))

    duration_ms = int(1000 / fps)
    pil_frames[0].save(
        output_path,
        save_all=True,
        append_images=pil_frames[1:],
        duration=duration_ms,
        loop=0,
        optimize=True,
    )


@shared_task(name="ai_tools.animate_image")
def animate_image(job_id: str) -> str | None:
    """Apply Ken Burns motion effect to an image (CPU-only).

    1. Load job from DB, check idempotency
    2. Download input image from S3
    3. Validate dimensions
    4. Generate motion frames (zoom + pan + smoothstep easing)
    5. Encode to MP4 or GIF
    6. Upload result to S3
    7. Update job status
    """
    import tempfile

    logger.info("animate_image START", extra={"job_id": job_id})

    job = asyncio.run(_load_job(job_id))
    if not job:
        logger.warning("Job not found", extra={"job_id": job_id})
        return None

    if job["status"] in ("ready", "processing"):
        logger.info("Job already %s, skipping", job["status"], extra={"job_id": job_id})
        return None

    asyncio.run(_update_job(job_id, "processing"))

    try:
        params = job.get("params") or {}
        motion_preset = params.get("motion_preset", "gentle")
        num_frames = params.get("num_frames", 15)
        fps = params.get("fps", 7)
        output_format = params.get("output_format", "mp4")

        bucket = get_media_bucket()
        raw = get_object_bytes(bucket, job["input_object_key"])
        img = Image.open(BytesIO(raw)).convert("RGB")

        w, h = img.size
        if w > MAX_DIMENSION or h > MAX_DIMENSION:
            raise ValueError(f"Image too large: {w}x{h} (max {MAX_DIMENSION}x{MAX_DIMENSION})")

        frames = _generate_ken_burns_frames(img, motion_preset, num_frames)

        if not frames:
            raise ValueError("No frames generated")

        frame_h, frame_w = frames[0].shape[:2]

        if output_format == "gif":
            ext = "gif"
            content_type = "image/gif"
            with tempfile.NamedTemporaryFile(suffix=".gif", delete=False) as tmp:
                tmp_path = tmp.name
            _encode_gif(frames, fps, tmp_path)
        else:
            ext = "mp4"
            content_type = "video/mp4"
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
                tmp_path = tmp.name
            _encode_mp4(frames, fps, tmp_path, frame_w, frame_h)

        import os

        with open(tmp_path, "rb") as f:
            result_bytes = f.read()
        os.unlink(tmp_path)

        result_key = _result_object_key(job_id, ext=ext)
        put_object_bytes(bucket, result_key, result_bytes, content_type)

        asyncio.run(_update_job(job_id, "ready", result_object_key=result_key))
        logger.info("animate_image DONE", extra={"job_id": job_id, "result_key": result_key})
        return result_key

    except Exception as e:
        logger.exception("animate_image FAILED", extra={"job_id": job_id})
        asyncio.run(_update_job(job_id, "failed", error_message=str(e)[:500]))
        return None


# ---------------------------------------------------------------------------
# Auto Caption (HuggingFace transformers — CPU-only)
# ---------------------------------------------------------------------------

MAX_CAPTION_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@shared_task(name="ai_tools.auto_caption", bind=True, max_retries=1)
def auto_caption(self, job_id: str) -> dict | None:
    """Generate image caption, alt-text, and keywords using HuggingFace models (CPU).

    1. Load job from DB, check idempotency
    2. Download input image from S3
    3. Validate file size (<10MB) and format
    4. Run caption model (GIT-base fast or BLIP better)
    5. Format output per mode/tone
    6. Store result in job params
    7. Update job status
    """
    logger.info("auto_caption START", extra={"job_id": job_id})

    job = asyncio.run(_load_job(job_id))
    if not job:
        logger.warning("Job not found", extra={"job_id": job_id})
        return None

    if job["status"] in ("ready", "processing"):
        logger.info("Job already %s, skipping", job["status"], extra={"job_id": job_id})
        return None

    asyncio.run(_update_job(job_id, "processing"))

    try:
        params = job.get("params") or {}
        mode = params.get("mode", "short")
        tone = params.get("tone", "neutral")
        quality = params.get("quality", "fast")
        include_keywords = params.get("include_keywords", True)

        bucket = get_media_bucket()
        raw = get_object_bytes(bucket, job["input_object_key"])

        # Validate file size
        if len(raw) > MAX_CAPTION_FILE_SIZE:
            raise ValueError(f"File too large: {len(raw)} bytes (max {MAX_CAPTION_FILE_SIZE})")

        # Validate image format
        img = Image.open(BytesIO(raw))
        if img.format and img.format.upper() not in ("JPEG", "JPG", "PNG", "WEBP"):
            raise ValueError(f"Unsupported image format: {img.format}")

        from worker.ml.caption_cpu_runner import run_caption

        result = run_caption(
            image_bytes=raw,
            mode=mode,
            tone=tone,
            quality=quality,
            include_keywords=include_keywords,
        )

        # Store result in params
        updated_params = {**params, "result": result}
        asyncio.run(_update_job(job_id, "ready", params=updated_params))
        logger.info(
            "auto_caption DONE",
            extra={
                "job_id": job_id,
                "model": result.get("model"),
                "inference_ms": result.get("timings", {}).get("inference_ms"),
            },
        )
        return result

    except Exception as e:
        logger.exception("auto_caption FAILED", extra={"job_id": job_id})
        asyncio.run(_update_job(job_id, "failed", error_message=str(e)[:500]))
        return None
