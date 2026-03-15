"""Demo backend for motion transfer.

Produces a visually transformed output by compositing the target identity
onto each frame of the source video, applying color grading, and blending.
This runs on CPU using OpenCV + ffmpeg — no GPU required.

Replace with a real GPU backend (WanAnimate, XDyna, MimicMotion) for
production-quality results.
"""

from __future__ import annotations

import logging
import os
import subprocess
import tempfile
import time
from io import BytesIO
from typing import Any

import cv2
import numpy as np
from PIL import Image

from worker.ml.motion_transfer.base import (
    BackendCapabilities,
    MotionTransferBackend,
    MotionTransferInputs,
    MotionTransferResult,
    MotionTransferSettings,
)

logger = logging.getLogger(__name__)


def _load_target_face(target_bytes: bytes, size: tuple[int, int]) -> np.ndarray:
    """Load target identity image, resize to match frame, return as BGR numpy array."""
    img = Image.open(BytesIO(target_bytes)).convert("RGB")
    img = img.resize(size, Image.LANCZOS)
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def _apply_identity_blend(
    frame: np.ndarray,
    target_face: np.ndarray,
    identity_strength: float,
    realism: float,
    frame_idx: int,
    total_frames: int,
) -> np.ndarray:
    """Blend target identity onto source frame with configurable strength.

    Uses multiple techniques:
    1. Alpha blend of target identity onto center of frame
    2. Color transfer from target to source (shifts skin/clothing tones)
    3. Smooth transition animation
    """
    h, w = frame.shape[:2]
    th, tw = target_face.shape[:2]
    result = frame.copy()

    # --- Color transfer: shift source colors toward target palette ---
    # Convert both to LAB color space for perceptual color transfer
    src_lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB).astype(np.float64)
    tgt_lab = cv2.cvtColor(target_face, cv2.COLOR_BGR2LAB).astype(np.float64)

    # Compute mean/std per channel
    for ch in range(3):
        src_mean, src_std = src_lab[:, :, ch].mean(), src_lab[:, :, ch].std() + 1e-6
        tgt_mean, tgt_std = tgt_lab[:, :, ch].mean(), tgt_lab[:, :, ch].std() + 1e-6
        # Shift source distribution toward target
        blend_factor = identity_strength * 0.5  # partial color transfer
        src_lab[:, :, ch] = (
            (1 - blend_factor) * src_lab[:, :, ch]
            + blend_factor * ((src_lab[:, :, ch] - src_mean) * (tgt_std / src_std) + tgt_mean)
        )

    src_lab = np.clip(src_lab, 0, 255).astype(np.uint8)
    result = cv2.cvtColor(src_lab, cv2.COLOR_LAB2BGR)

    # --- Central identity overlay with elliptical mask ---
    # Place target face in center with smooth feathered edges
    center_x, center_y = w // 2, h // 2

    # Scale target to ~60% of frame
    scale = 0.6
    overlay_w = int(w * scale)
    overlay_h = int(h * scale)
    target_resized = cv2.resize(target_face, (overlay_w, overlay_h), interpolation=cv2.INTER_LINEAR)

    # Create elliptical alpha mask with soft edges
    mask = np.zeros((overlay_h, overlay_w), dtype=np.float32)
    cv2.ellipse(
        mask,
        (overlay_w // 2, overlay_h // 2),
        (overlay_w // 2 - 10, overlay_h // 2 - 10),
        0, 0, 360, 1.0, -1,
    )
    # Gaussian blur for feathered edges
    mask = cv2.GaussianBlur(mask, (51, 51), 25)

    # Apply identity strength to the overlay opacity
    alpha = mask * identity_strength * 0.7

    # Compute paste region
    x1 = center_x - overlay_w // 2
    y1 = center_y - overlay_h // 2
    x2 = x1 + overlay_w
    y2 = y1 + overlay_h

    # Clip to frame bounds
    src_x1 = max(0, -x1)
    src_y1 = max(0, -y1)
    dst_x1 = max(0, x1)
    dst_y1 = max(0, y1)
    dst_x2 = min(w, x2)
    dst_y2 = min(h, y2)
    src_x2 = src_x1 + (dst_x2 - dst_x1)
    src_y2 = src_y1 + (dst_y2 - dst_y1)

    if dst_x2 > dst_x1 and dst_y2 > dst_y1:
        roi = result[dst_y1:dst_y2, dst_x1:dst_x2]
        overlay_roi = target_resized[src_y1:src_y2, src_x1:src_x2]
        alpha_roi = alpha[src_y1:src_y2, src_x1:src_x2, np.newaxis]

        blended = (roi * (1 - alpha_roi) + overlay_roi * alpha_roi).astype(np.uint8)
        result[dst_y1:dst_y2, dst_x1:dst_x2] = blended

    # --- Subtle cinematic color grade ---
    # Slight teal-orange grade based on realism slider
    grade_strength = (1.0 - realism) * 0.3  # more stylized = stronger grade
    if grade_strength > 0.01:
        b, g, r = cv2.split(result)
        # Boost blues in shadows, oranges in highlights
        lut_b = np.array([min(255, int(i + grade_strength * 20 * (1 - i / 255))) for i in range(256)], dtype=np.uint8)
        lut_r = np.array([min(255, int(i + grade_strength * 15 * (i / 255))) for i in range(256)], dtype=np.uint8)
        b = cv2.LUT(b, lut_b)
        r = cv2.LUT(r, lut_r)
        result = cv2.merge([b, g, r])

    return result


class StubMotionTransferBackend(MotionTransferBackend):
    """CPU demo backend that composites target identity onto source video.

    Applies:
    - Color transfer from target to source frames
    - Identity overlay (elliptical blend of target face onto each frame)
    - Cinematic color grading (teal-orange based on realism slider)
    - Picture-in-picture of original target in corner

    Replace with a real GPU model for production quality.
    """

    def get_capabilities(self) -> BackendCapabilities:
        return BackendCapabilities(
            name="demo_composite",
            max_duration_sec=30.0,
            max_resolution=1024,
            supports_garment=False,
            supports_lip_sync=False,
            supports_background_preservation=False,
            requires_gpu=False,
        )

    def validate_inputs(
        self, inputs: MotionTransferInputs, settings: MotionTransferSettings
    ) -> list[str]:
        errors: list[str] = []
        if not inputs.source_video_bytes:
            errors.append("source_video_bytes is empty")
        if not inputs.target_bytes:
            errors.append("target_bytes is empty")
        if inputs.source_duration_sec > 30.0:
            errors.append("source video exceeds 30s maximum")
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
        t0 = time.monotonic()

        # Write source video to temp file
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as src_f:
            src_f.write(inputs.source_video_bytes)
            src_path = src_f.name

        frames_dir = tempfile.mkdtemp(prefix="mt_frames_")
        out_path = src_path + "_mt_out.mp4"

        try:
            if progress_callback:
                progress_callback(0.05, "generating")

            resolution = settings.output_resolution
            fps = settings.output_fps

            # Extract frames from source video
            cap = cv2.VideoCapture(src_path)
            if not cap.isOpened():
                raise RuntimeError("Failed to open source video")

            frames = []
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                frames.append(frame)
            cap.release()

            if not frames:
                raise RuntimeError("No frames extracted from source video")

            total_frames = len(frames)
            logger.info(
                "Extracted %d frames from source", total_frames,
                extra={"resolution": f"{frames[0].shape[1]}x{frames[0].shape[0]}"},
            )

            if progress_callback:
                progress_callback(0.15, "generating")

            # Load and prepare target identity
            frame_h, frame_w = frames[0].shape[:2]
            target_face = _load_target_face(inputs.target_bytes, (frame_w, frame_h))

            # Create small PIP thumbnail of target (corner overlay)
            pip_size = max(64, min(frame_w, frame_h) // 5)
            target_pip = cv2.resize(target_face, (pip_size, pip_size), interpolation=cv2.INTER_AREA)
            # Add border to PIP
            target_pip = cv2.copyMakeBorder(target_pip, 2, 2, 2, 2, cv2.BORDER_CONSTANT, value=(255, 255, 255))

            if progress_callback:
                progress_callback(0.20, "generating")

            # Process each frame
            processed_frames = []
            for i, frame in enumerate(frames):
                # Resize frame to output resolution
                out_h = resolution
                out_w = int(frame_w * (resolution / frame_h))
                if out_w % 2 != 0:
                    out_w += 1
                if out_h % 2 != 0:
                    out_h += 1
                frame_resized = cv2.resize(frame, (out_w, out_h), interpolation=cv2.INTER_AREA)
                target_resized = cv2.resize(target_face, (out_w, out_h), interpolation=cv2.INTER_AREA)

                # Apply identity blend
                processed = _apply_identity_blend(
                    frame_resized,
                    target_resized,
                    identity_strength=settings.identity_strength,
                    realism=settings.realism,
                    frame_idx=i,
                    total_frames=total_frames,
                )

                # Add PIP of target identity in top-right corner
                pip_h, pip_w = target_pip.shape[:2]
                pip_resized = cv2.resize(target_pip, (pip_size + 4, pip_size + 4))
                pip_rh, pip_rw = pip_resized.shape[:2]
                if pip_rw < out_w and pip_rh < out_h:
                    margin = 10
                    py1 = margin
                    px1 = out_w - pip_rw - margin
                    py2 = py1 + pip_rh
                    px2 = px1 + pip_rw
                    if px1 >= 0 and py2 <= out_h:
                        processed[py1:py2, px1:px2] = pip_resized

                processed_frames.append(processed)

                # Update progress every 10%
                if i % max(1, total_frames // 10) == 0:
                    pct = 0.20 + 0.60 * (i / total_frames)
                    if progress_callback:
                        progress_callback(pct, "generating")

            if progress_callback:
                progress_callback(0.82, "generating")

            # Write processed frames to temp PNGs
            for idx, pf in enumerate(processed_frames):
                cv2.imwrite(os.path.join(frames_dir, f"frame_{idx:06d}.png"), pf)

            if progress_callback:
                progress_callback(0.88, "generating")

            # Encode to MP4 with ffmpeg
            out_h, out_w = processed_frames[0].shape[:2]
            cmd = [
                "ffmpeg", "-y",
                "-framerate", str(fps),
                "-i", os.path.join(frames_dir, "frame_%06d.png"),
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "20",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                "-vf", f"scale={out_w}:{out_h}",
                out_path,
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if result.returncode != 0:
                raise RuntimeError(f"ffmpeg encode failed: {result.stderr[:500]}")

            if progress_callback:
                progress_callback(0.95, "generating")

            with open(out_path, "rb") as f:
                output_bytes = f.read()

            t1 = time.monotonic()

            return MotionTransferResult(
                output_video_bytes=output_bytes,
                content_type="video/mp4",
                backend_name="demo_composite",
                timings={
                    "total_ms": int((t1 - t0) * 1000),
                    "frames_processed": total_frames,
                },
                metadata={
                    "note": "Demo composite backend — CPU-based identity blend",
                    "output_resolution": resolution,
                    "output_fps": fps,
                    "identity_strength": settings.identity_strength,
                    "realism": settings.realism,
                },
            )
        finally:
            # Cleanup temp files
            for p in (src_path, out_path):
                if os.path.exists(p):
                    os.unlink(p)
            import shutil
            if os.path.exists(frames_dir):
                shutil.rmtree(frames_dir, ignore_errors=True)
