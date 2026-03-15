"""Replicate API backend for motion transfer / character animation.

Calls hosted Wan2.2-Animate (or compatible) models via Replicate's API.
Runs on CPU workers — no local GPU needed. Model runs on Replicate's GPUs.

Requires:
  - REPLICATE_API_TOKEN env var (already in Zinovia secrets)
  - replicate Python package (already in worker dependencies)

Configuration:
  - REPLICATE_MT_MODEL: Replicate model ID (default: wan-video/wan2.2-animate)
"""

from __future__ import annotations

import base64
import logging
import os
import time
from io import BytesIO
from typing import Any

from worker.ml.motion_transfer.base import (
    BackendCapabilities,
    MotionTransferBackend,
    MotionTransferInputs,
    MotionTransferResult,
    MotionTransferSettings,
)

logger = logging.getLogger(__name__)


def _replicate_model_id() -> str:
    return os.environ.get("REPLICATE_MT_MODEL", "zsxkib/mimic-motion")


def _replicate_timeout() -> int:
    return int(os.environ.get("REPLICATE_MT_TIMEOUT", "1200"))  # 20 min


class ReplicateMotionTransferBackend(MotionTransferBackend):
    """Hosted API backend using Replicate for motion transfer inference.

    Calls a hosted model via Replicate's prediction API. The model
    runs on Replicate's GPU infrastructure — no local GPU required.

    Supports animate and replace modes depending on the hosted model's
    capabilities.
    """

    def get_capabilities(self) -> BackendCapabilities:
        return BackendCapabilities(
            name="replicate_hosted",
            max_duration_sec=15.0,
            max_resolution=1280,
            supports_garment=False,
            supports_lip_sync=False,
            supports_background_preservation=False,
            requires_gpu=False,  # GPU runs on Replicate's side
        )

    def validate_inputs(
        self, inputs: MotionTransferInputs, settings: MotionTransferSettings
    ) -> list[str]:
        errors: list[str] = []

        if not inputs.source_video_bytes:
            errors.append("Source video is empty")
        if not inputs.target_bytes:
            errors.append("Target identity image is empty")
        if inputs.source_duration_sec > 15.0:
            errors.append(
                f"Source video too long for Replicate: {inputs.source_duration_sec:.1f}s (max 15s)"
            )

        # Check API token
        token = os.environ.get("REPLICATE_API_TOKEN", "")
        if not token:
            errors.append(
                "REPLICATE_API_TOKEN not set. Required for hosted GPU inference."
            )

        return errors

    def prepare(
        self, inputs: MotionTransferInputs, settings: MotionTransferSettings
    ) -> dict:
        return {"ready": True}

    def generate(
        self,
        inputs: MotionTransferInputs,
        settings: MotionTransferSettings,
        prep_context: dict,
        progress_callback: Any | None = None,
    ) -> MotionTransferResult:
        import replicate

        t0 = time.monotonic()
        timings: dict[str, int] = {}

        model_id = _replicate_model_id()
        timeout = _replicate_timeout()

        logger.info("Replicate inference START: model=%s", model_id)

        if progress_callback:
            progress_callback(0.05, "generating")

        # Encode inputs as data URIs for Replicate
        source_mime = inputs.source_content_type or "video/mp4"
        target_mime = inputs.target_content_type or "image/jpeg"

        source_b64 = base64.b64encode(inputs.source_video_bytes).decode("ascii")
        target_b64 = base64.b64encode(inputs.target_bytes).decode("ascii")

        source_uri = f"data:{source_mime};base64,{source_b64}"
        target_uri = f"data:{target_mime};base64,{target_b64}"

        # Build input dict — adapt to the specific model's API
        replicate_input = {
            "motion_video": source_uri,
            "reference_image": target_uri,
        }

        # Add optional params if model supports them
        if settings.seed is not None:
            replicate_input["seed"] = settings.seed

        if progress_callback:
            progress_callback(0.10, "generating")

        try:
            t_inf = time.monotonic()

            # Run prediction (blocks until complete or timeout)
            output = replicate.run(
                model_id,
                input=replicate_input,
                timeout=timeout,
            )

            timings["inference_ms"] = int((time.monotonic() - t_inf) * 1000)

            if progress_callback:
                progress_callback(0.85, "postprocessing")

            # Download output video
            # Replicate returns either a URL string or a FileOutput object
            if isinstance(output, str):
                output_url = output
            elif hasattr(output, "url"):
                output_url = output.url
            elif isinstance(output, list) and len(output) > 0:
                output_url = output[0] if isinstance(output[0], str) else str(output[0])
            else:
                output_url = str(output)

            logger.info("Replicate output URL: %s", output_url[:200])

            # Download the result
            import urllib.request

            t_dl = time.monotonic()
            with urllib.request.urlopen(output_url, timeout=120) as resp:
                output_bytes = resp.read()
            timings["download_ms"] = int((time.monotonic() - t_dl) * 1000)

            if not output_bytes:
                raise RuntimeError("Replicate returned empty output")

            # Integrity check
            if output_bytes == inputs.source_video_bytes:
                raise RuntimeError(
                    "INTEGRITY FAILURE: Replicate output is identical to source video"
                )

            timings["total_ms"] = int((time.monotonic() - t0) * 1000)

            logger.info(
                "Replicate inference DONE: %d bytes, %dms",
                len(output_bytes),
                timings["total_ms"],
            )

            return MotionTransferResult(
                output_video_bytes=output_bytes,
                content_type="video/mp4",
                backend_name="replicate_hosted",
                timings=timings,
                metadata={
                    "model_id": model_id,
                    "mode": settings.mode,
                    "output_size_bytes": len(output_bytes),
                },
            )

        except Exception as e:
            logger.exception("Replicate inference FAILED: model=%s", model_id)
            raise RuntimeError(
                f"Replicate inference failed: {str(e)[:300]}. "
                f"Model: {model_id}"
            ) from e
