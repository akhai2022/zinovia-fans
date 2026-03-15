"""Worker task for Motion Transfer / Character Replace.

Pipeline stages:
1. preprocessing  — CPU: probe video, extract metadata, preview frame, audio
2. generating     — GPU: run generation backend
3. postprocessing — CPU: transcode, create thumbnail, persist outputs

Each stage updates job.params.stage and job.params.progress so the
frontend can show granular progress to the user.
"""

from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import tempfile
import time
import uuid
from io import BytesIO

from celery import shared_task
from PIL import Image
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.settings import get_settings
from worker.storage_io import get_media_bucket, get_object_bytes, put_object_bytes

logger = logging.getLogger(__name__)

MAX_SOURCE_VIDEO_BYTES = 200_000_000  # 200 MB
MAX_SOURCE_DURATION_SEC = 30.0


def _make_session_factory() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine(str(get_settings().database_url), pool_pre_ping=True)
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


def _result_object_key(job_id: str, ext: str = "mp4") -> str:
    return f"ai-tools/{job_id}/result.{ext}"


def _preview_object_key(job_id: str) -> str:
    return f"ai-tools/{job_id}/preview.jpg"


async def _load_job(job_id: str) -> dict | None:
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
        "updated_at": datetime.now(timezone.utc),
    }
    if result_object_key is not None:
        values["result_object_key"] = result_object_key
    if error_message is not None:
        values["error_message"] = error_message
    if params is not None:
        values["params"] = params

    async with _make_session_factory()() as session:
        await session.execute(
            update(AiToolJob)
            .where(AiToolJob.id == uuid.UUID(job_id))
            .values(**values)
        )
        await session.commit()


def _remux_audio(source_video_bytes: bytes, generated_video_bytes: bytes) -> bytes:
    """Re-mux audio from the source video onto the generated output using ffmpeg.

    Takes the video stream from generated_video and audio stream from source_video,
    producing a combined MP4. Falls back to generated video if ffmpeg fails.
    """
    import os
    import subprocess
    import tempfile

    src_path = None
    gen_path = None
    out_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix="_src.mp4", delete=False) as f:
            f.write(source_video_bytes)
            src_path = f.name
        with tempfile.NamedTemporaryFile(suffix="_gen.mp4", delete=False) as f:
            f.write(generated_video_bytes)
            gen_path = f.name
        out_path = gen_path + "_muxed.mp4"

        cmd = [
            "ffmpeg", "-y",
            "-i", gen_path,     # video from generated
            "-i", src_path,     # audio from source
            "-c:v", "copy",     # copy video stream as-is
            "-c:a", "aac",      # re-encode audio to AAC
            "-b:a", "128k",
            "-map", "0:v:0",    # video from first input
            "-map", "1:a:0",    # audio from second input
            "-shortest",        # trim to shorter stream
            "-movflags", "+faststart",
            out_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            logger.warning("Audio remux failed, using video without audio: %s", result.stderr[:300])
            return generated_video_bytes

        with open(out_path, "rb") as f:
            return f.read()
    except Exception as e:
        logger.warning("Audio remux exception, falling back: %s", str(e)[:200])
        return generated_video_bytes
    finally:
        for p in (src_path, gen_path, out_path):
            if p and os.path.exists(p):
                os.unlink(p)


def _update_stage(job_id: str, params: dict, stage: str, progress: float) -> dict:
    """Update stage/progress in params and persist to DB."""
    updated = {**params, "stage": stage, "progress": round(progress, 2)}
    asyncio.run(_update_job(job_id, "processing", params=updated))
    return updated


@shared_task(
    name="ai_tools.motion_transfer",
    bind=True,
    time_limit=1800,       # 30 min hard timeout
    soft_time_limit=1500,  # 25 min soft timeout
    acks_late=True,
    reject_on_worker_lost=True,
)
def motion_transfer(self, job_id: str) -> str | None:
    """Run motion transfer pipeline: preprocess → generate → postprocess.

    1. Load job from DB, check idempotency
    2. Download source video + target asset + optional garment from S3
    3. Preprocess: probe video, validate, extract preview frame
    4. Generate: invoke backend through abstraction layer
    5. Postprocess: create thumbnail, persist results
    6. Update job status to ready
    """
    logger.info("motion_transfer START", extra={"job_id": job_id})

    # --- Load and check idempotency ---
    job = asyncio.run(_load_job(job_id))
    if not job:
        logger.warning("Job not found", extra={"job_id": job_id})
        return None

    if job["status"] == "ready":
        logger.info("Job already ready, skipping", extra={"job_id": job_id})
        return None

    # Check if canceled
    params = job.get("params") or {}
    if params.get("stage") == "canceled":
        logger.info("Job was canceled, skipping", extra={"job_id": job_id})
        return None

    asyncio.run(_update_job(job_id, "processing"))

    try:
        # =============================================
        # STAGE 1: PREPROCESSING (CPU)
        # =============================================
        params = _update_stage(job_id, params, "preprocessing", 0.05)

        bucket = get_media_bucket()

        # Download source video
        source_bytes = get_object_bytes(bucket, job["input_object_key"])
        if len(source_bytes) > MAX_SOURCE_VIDEO_BYTES:
            raise ValueError(
                f"Source video too large: {len(source_bytes)} bytes "
                f"(max {MAX_SOURCE_VIDEO_BYTES})"
            )

        # Download target identity asset
        target_object_key = params.get("target_object_key")
        if not target_object_key:
            raise ValueError("Missing target_object_key in job params")
        target_bytes = get_object_bytes(bucket, target_object_key)

        # Download optional garment
        garment_bytes = None
        garment_object_key = params.get("garment_object_key")
        if garment_object_key:
            garment_bytes = get_object_bytes(bucket, garment_object_key)

        params = _update_stage(job_id, params, "preprocessing", 0.10)

        # Probe source video metadata
        from worker.ml.motion_transfer.preprocess import (
            extract_audio,
            extract_preview_frame,
            probe_video,
            validate_source_video,
        )

        source_content_type = params.get("source_content_type", "video/mp4")

        # For video inputs, probe metadata
        if source_content_type.startswith("video/"):
            meta = probe_video(source_bytes)
            validation_errors = validate_source_video(meta, MAX_SOURCE_DURATION_SEC)
            if validation_errors:
                raise ValueError("; ".join(validation_errors))
        else:
            # Source is an image — minimal metadata
            img = Image.open(BytesIO(source_bytes))
            meta = {
                "duration_sec": 0,
                "fps": params.get("output_fps", 24),
                "width": img.size[0],
                "height": img.size[1],
                "has_audio": False,
                "codec": "image",
            }

        params = _update_stage(job_id, params, "preprocessing", 0.15)

        # Extract preview frame
        if source_content_type.startswith("video/"):
            preview_bytes = extract_preview_frame(source_bytes)
        else:
            # Use source image itself as preview
            buf = BytesIO()
            Image.open(BytesIO(source_bytes)).convert("RGB").save(buf, "JPEG", quality=85)
            preview_bytes = buf.getvalue()

        # Upload preview
        preview_key = _preview_object_key(job_id)
        put_object_bytes(bucket, preview_key, preview_bytes, "image/jpeg")
        params = {**params, "preview_object_key": preview_key}

        params = _update_stage(job_id, params, "preprocessing", 0.20)

        # =============================================
        # STAGE 2: GENERATION (GPU or CPU stub)
        # =============================================
        params = _update_stage(job_id, params, "generating", 0.25)

        from worker.ml.motion_transfer.base import (
            MotionTransferInputs,
            MotionTransferSettings,
        )
        from worker.ml.motion_transfer.registry import get_backend

        inputs = MotionTransferInputs(
            source_video_bytes=source_bytes,
            source_content_type=source_content_type,
            target_bytes=target_bytes,
            target_content_type=params.get("target_content_type", "image/jpeg"),
            garment_bytes=garment_bytes,
            garment_content_type="image/jpeg" if garment_bytes else None,
            source_fps=meta["fps"],
            source_duration_sec=meta["duration_sec"],
            source_width=meta["width"],
            source_height=meta["height"],
            source_has_audio=meta["has_audio"],
        )

        settings = MotionTransferSettings(
            mode=params.get("mode", "animate"),
            preserve_background=params.get("preserve_background", False),
            preserve_audio=params.get("preserve_audio", True),
            retarget_pose=params.get("retarget_pose", False),
            use_relighting_lora=params.get("use_relighting_lora", False),
            output_resolution=int(params.get("output_resolution", 720)),
            output_fps=int(params.get("output_fps", 24)),
            seed=params.get("seed"),
        )

        logger.info(
            "Backend selection: mode=%s, source_asset=%s, target_asset=%s",
            settings.mode,
            job["input_object_key"],
            params.get("target_object_key"),
            extra={"job_id": job_id},
        )

        backend = get_backend(params.get("backend_name"))
        capabilities = backend.get_capabilities()

        logger.info(
            "Using backend: %s (gpu=%s)",
            capabilities.name,
            capabilities.requires_gpu,
            extra={"job_id": job_id},
        )

        # Validate with backend
        backend_errors = backend.validate_inputs(inputs, settings)
        if backend_errors:
            raise ValueError(f"Backend validation: {'; '.join(backend_errors)}")

        # Prepare
        prep_context = backend.prepare(inputs, settings)
        prep_context["job_id"] = job_id

        def progress_callback(pct: float, stage: str = "generating") -> None:
            # Map backend progress (0-1) to overall progress (0.25 - 0.85)
            overall = 0.25 + pct * 0.60
            _update_stage(job_id, params, stage, overall)

        params = _update_stage(job_id, params, "generating", 0.30)

        # Generate
        result = backend.generate(inputs, settings, prep_context, progress_callback)

        params = _update_stage(job_id, params, "generating", 0.85)

        # =============================================
        # STAGE 3: POSTPROCESSING (CPU)
        # =============================================
        params = _update_stage(job_id, params, "postprocessing", 0.88)

        output_bytes = result.output_video_bytes

        # INTEGRITY: output must not be identical to source
        if output_bytes == source_bytes:
            raise RuntimeError(
                "INTEGRITY FAILURE: Generated output is identical to source video. "
                f"Backend '{result.backend_name}' did not produce a new result."
            )

        logger.info(
            "Generation integrity OK: backend=%s, output=%d bytes (source=%d bytes)",
            result.backend_name,
            len(output_bytes),
            len(source_bytes),
            extra={"job_id": job_id},
        )

        # Re-mux audio from source video onto generated output if requested
        if settings.preserve_audio and meta["has_audio"] and source_content_type.startswith("video/"):
            logger.info("Re-muxing source audio onto output", extra={"job_id": job_id})
            output_bytes = _remux_audio(source_bytes, output_bytes)

        params = _update_stage(job_id, params, "postprocessing", 0.93)

        # Upload result video
        result_key = _result_object_key(job_id)
        put_object_bytes(bucket, result_key, output_bytes, result.content_type)

        # Store metadata in params
        final_params = {
            **params,
            "stage": "completed",
            "progress": 1.0,
            "backend_name": result.backend_name,
            "timings": result.timings,
            "backend_metadata": result.metadata,
            "source_meta": meta,
        }

        params = _update_stage(job_id, final_params, "completed", 1.0)

        asyncio.run(
            _update_job(job_id, "ready", result_object_key=result_key, params=final_params)
        )

        logger.info(
            "motion_transfer DONE",
            extra={
                "job_id": job_id,
                "result_key": result_key,
                "backend": result.backend_name,
                "timings": result.timings,
            },
        )
        return result_key

    except Exception as e:
        logger.exception("motion_transfer FAILED", extra={"job_id": job_id})
        error_params = {**params, "stage": "failed", "progress": 0.0}
        asyncio.run(
            _update_job(
                job_id, "failed",
                error_message=str(e)[:500],
                params=error_params,
            )
        )
        return None
