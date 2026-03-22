"""Self-hosted MimicMotion backend for motion transfer.

Uses the Tencent MimicMotion model (based on Stable Video Diffusion) for
pose-driven character animation. Runs entirely on GPU — no external API.

Requirements:
  - GPU with >= 16GB VRAM (T4 16GB works)
  - ~12 GB disk for model weights (SVD base + MimicMotion checkpoint + DWPose)
  - diffusers, torch, onnxruntime-gpu, decord, einops, omegaconf

Configuration via env:
  - MIMIC_MOTION_CKPT: Path to MimicMotion_1-1.pth (default: /app/models/MimicMotion_1-1.pth)
  - MIMIC_MOTION_BASE_MODEL: SVD base model ID (default: stabilityai/stable-video-diffusion-img2vid-xt-1-1)
  - MIMIC_MOTION_DWPOSE_DIR: Path to DWPose ONNX models (default: /app/models/DWPose)
  - MIMIC_MOTION_RESOLUTION: Output height (default: 576, width scales to 1024)
  - MIMIC_MOTION_NUM_STEPS: Diffusion steps (default: 25)
  - MIMIC_MOTION_TILE_SIZE: Frames per chunk (default: 16, lower = less VRAM)
  - MIMIC_MOTION_FPS: Output FPS (default: 15)
  - MIMIC_MOTION_MAX_DURATION: Max source video duration (default: 15)
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import tempfile
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

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


def _cfg(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def _ckpt_path() -> str:
    return _cfg("MIMIC_MOTION_CKPT", "/app/models/MimicMotion_1-1.pth")


def _base_model() -> str:
    return _cfg(
        "MIMIC_MOTION_BASE_MODEL",
        "stabilityai/stable-video-diffusion-img2vid-xt-1-1",
    )


def _dwpose_dir() -> str:
    return _cfg("MIMIC_MOTION_DWPOSE_DIR", "/app/models/DWPose")


def _resolution() -> int:
    return int(_cfg("MIMIC_MOTION_RESOLUTION", "576"))


def _num_steps() -> int:
    return int(_cfg("MIMIC_MOTION_NUM_STEPS", "25"))


def _tile_size() -> int:
    return int(_cfg("MIMIC_MOTION_TILE_SIZE", "16"))


def _tile_overlap() -> int:
    return int(_cfg("MIMIC_MOTION_TILE_OVERLAP", "6"))


def _output_fps() -> int:
    return int(_cfg("MIMIC_MOTION_FPS", "15"))


def _max_duration() -> float:
    return float(_cfg("MIMIC_MOTION_MAX_DURATION", "15"))


def _sample_stride() -> int:
    return int(_cfg("MIMIC_MOTION_SAMPLE_STRIDE", "2"))


# ---------------------------------------------------------------------------
# Singleton pipeline loader
# ---------------------------------------------------------------------------

_pipeline = None
_pose_detector = None


def _get_pipeline():
    """Load MimicMotion pipeline singleton."""
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    import torch
    from mimicmotion.utils.loader import create_pipeline

    logger.info("Loading MimicMotion pipeline (base=%s, ckpt=%s)", _base_model(), _ckpt_path())
    t0 = time.monotonic()

    class _InferConfig:
        base_model_path = _base_model()
        ckpt_path = _ckpt_path()

    device = torch.device("cuda")
    _pipeline = create_pipeline(_InferConfig(), device)

    elapsed = time.monotonic() - t0
    logger.info("MimicMotion pipeline loaded in %.1fs", elapsed)
    return _pipeline


def _get_pose_detector():
    """Load DWPose detector singleton."""
    global _pose_detector
    if _pose_detector is not None:
        return _pose_detector

    from mimicmotion.dwpose.preprocess import Preprocessor

    logger.info("Loading DWPose detector from %s", _dwpose_dir())
    _pose_detector = Preprocessor()
    _pose_detector.load(
        det_model_path=os.path.join(_dwpose_dir(), "yolox_l.onnx"),
        pose_model_path=os.path.join(_dwpose_dir(), "dw-ll_ucoco_384.onnx"),
    )
    logger.info("DWPose detector loaded")
    return _pose_detector


# ---------------------------------------------------------------------------
# Video helpers
# ---------------------------------------------------------------------------


def _frames_to_mp4(frames, fps: int, output_path: str) -> None:
    """Encode list of PIL Images to MP4 via ffmpeg."""
    import cv2
    import numpy as np
    from PIL import Image as PILImage

    if not frames:
        raise ValueError("No frames to encode")

    with tempfile.TemporaryDirectory() as tmpdir:
        for idx, frame in enumerate(frames):
            if isinstance(frame, PILImage.Image):
                arr = np.array(frame)
            else:
                arr = frame
            if arr.dtype in (np.float32, np.float64):
                arr = (np.clip(arr, 0, 1) * 255).astype(np.uint8)
            bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
            cv2.imwrite(os.path.join(tmpdir, f"frame_{idx:06d}.png"), bgr)

        cmd = [
            "ffmpeg", "-y",
            "-framerate", str(fps),
            "-i", os.path.join(tmpdir, "frame_%06d.png"),
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            output_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg encode failed: {result.stderr[:500]}")


# ---------------------------------------------------------------------------
# Backend implementation
# ---------------------------------------------------------------------------


class MimicMotionBackend(MotionTransferBackend):
    """Self-hosted MimicMotion backend for pose-driven character animation.

    Based on Stable Video Diffusion with confidence-aware pose guidance.
    Fits on g4dn.2xlarge (8 vCPU, 32GB RAM, 16GB T4 GPU).
    """

    def get_capabilities(self) -> BackendCapabilities:
        return BackendCapabilities(
            name="mimic_motion",
            max_duration_sec=_max_duration(),
            max_resolution=1024,
            supports_garment=False,
            supports_lip_sync=False,
            supports_background_preservation=False,
            requires_gpu=True,
        )

    def validate_inputs(
        self, inputs: MotionTransferInputs, settings: MotionTransferSettings
    ) -> list[str]:
        errors: list[str] = []

        if not inputs.source_video_bytes:
            errors.append("Source video is empty")
        if not inputs.target_bytes:
            errors.append("Target identity image is empty")
        if inputs.source_duration_sec > _max_duration() + 0.5:
            errors.append(
                f"Source video too long: {inputs.source_duration_sec:.1f}s "
                f"(max {_max_duration()}s)"
            )

        try:
            import torch
            if not torch.cuda.is_available():
                errors.append("No CUDA GPU available. MimicMotion requires a GPU.")
        except ImportError:
            errors.append("PyTorch not installed.")

        if not os.path.exists(_ckpt_path()):
            errors.append(f"MimicMotion checkpoint not found: {_ckpt_path()}")

        return errors

    def prepare(
        self, inputs: MotionTransferInputs, settings: MotionTransferSettings
    ) -> dict:
        """Write input assets to workspace and preload pipeline."""
        workspace = tempfile.mkdtemp(prefix="mimic_")

        source_path = os.path.join(workspace, "source.mp4")
        with open(source_path, "wb") as f:
            f.write(inputs.source_video_bytes)

        target_ext = "png" if inputs.target_content_type == "image/png" else "jpg"
        target_path = os.path.join(workspace, f"target.{target_ext}")
        with open(target_path, "wb") as f:
            f.write(inputs.target_bytes)

        # Trigger model loading
        _get_pipeline()
        _get_pose_detector()

        return {
            "workspace": workspace,
            "source_path": source_path,
            "target_path": target_path,
        }

    def generate(
        self,
        inputs: MotionTransferInputs,
        settings: MotionTransferSettings,
        prep_context: dict,
        progress_callback: Any | None = None,
    ) -> MotionTransferResult:
        import numpy as np
        import torch
        from PIL import Image as PILImage

        workspace = prep_context["workspace"]
        source_path = prep_context["source_path"]
        target_path = prep_context["target_path"]

        t0 = time.monotonic()
        timings: dict[str, int] = {}

        try:
            # ===== PREPROCESS: Extract poses =====
            if progress_callback:
                progress_callback(0.05, "preprocessing")

            logger.info("Extracting poses from source video")
            t_pre = time.monotonic()

            from mimicmotion.utils.utils import get_video_pose, get_image_pose

            pose_detector = _get_pose_detector()
            resolution = _resolution()
            sample_stride = _sample_stride()

            # Extract poses from driving video
            pose_pixels, detected_bodies = get_video_pose(
                source_path,
                pose_detector,
                resolution=resolution,
                sample_stride=sample_stride,
            )

            # Load and process reference image
            ref_image = PILImage.open(target_path).convert("RGB")
            src_fps = inputs.source_fps or 24

            # Get reference image pose for alignment
            ref_pose = get_image_pose(ref_image, pose_detector, resolution=resolution)

            timings["preprocess_ms"] = int((time.monotonic() - t_pre) * 1000)
            logger.info(
                "Preprocessing done: %d pose frames extracted",
                pose_pixels.shape[1] if hasattr(pose_pixels, 'shape') else len(pose_pixels),
            )

            if progress_callback:
                progress_callback(0.20, "generating")

            # ===== INFERENCE =====
            logger.info("Starting MimicMotion inference")
            t_inf = time.monotonic()

            pipe = _get_pipeline()
            device = torch.device("cuda")

            # Prepare tensors
            if not isinstance(pose_pixels, torch.Tensor):
                pose_pixels = torch.tensor(pose_pixels)
            pose_pixels = pose_pixels.unsqueeze(0).to(device)

            # Reference image as tensor
            from torchvision import transforms
            transform = transforms.Compose([
                transforms.Resize((resolution, int(resolution * 1024 / 576))),
                transforms.ToTensor(),
            ])
            image_pixels = transform(ref_image).unsqueeze(0).to(device)

            num_frames = pose_pixels.shape[1]
            tile_size = min(_tile_size(), num_frames)
            tile_overlap = min(_tile_overlap(), tile_size - 1)

            generator = None
            if settings.seed is not None:
                generator = torch.Generator(device=device).manual_seed(settings.seed)
            else:
                generator = torch.Generator(device=device).manual_seed(42)

            # Progress callback for diffusion steps
            def step_callback(pipe_obj, step_idx, timestep, callback_kwargs):
                if progress_callback:
                    pct = 0.20 + 0.65 * (step_idx / max(_num_steps(), 1))
                    progress_callback(pct, "generating")
                return callback_kwargs

            with torch.no_grad():
                output = pipe(
                    image=image_pixels,
                    image_pose=pose_pixels,
                    num_frames=num_frames,
                    tile_size=tile_size,
                    tile_overlap=tile_overlap,
                    height=resolution,
                    width=int(resolution * 1024 / 576),
                    fps=7,
                    noise_aug_strength=0.0,
                    num_inference_steps=_num_steps(),
                    generator=generator,
                    min_guidance_scale=2.0,
                    max_guidance_scale=2.0,
                    decode_chunk_size=8,
                    output_type="pt",
                    callback_on_step_end=step_callback,
                )

            timings["inference_ms"] = int((time.monotonic() - t_inf) * 1000)

            if progress_callback:
                progress_callback(0.90, "postprocessing")

            # ===== ENCODE OUTPUT =====
            logger.info("Encoding output video")

            frames_tensor = output.frames[0]  # (num_frames, C, H, W)
            output_frames = []
            for i in range(frames_tensor.shape[0]):
                frame = frames_tensor[i].cpu().permute(1, 2, 0).numpy()
                frame = (np.clip(frame, 0, 1) * 255).astype(np.uint8)
                output_frames.append(frame)

            if not output_frames:
                raise RuntimeError("MimicMotion produced no output frames")

            logger.info("Generated %d output frames", len(output_frames))

            output_path = os.path.join(workspace, "output.mp4")
            fps = settings.output_fps or _output_fps()
            _frames_to_mp4(output_frames, fps, output_path)

            # ===== INTEGRITY CHECKS =====
            if not os.path.exists(output_path):
                raise RuntimeError("Output video file not created")

            output_size = os.path.getsize(output_path)
            if output_size == 0:
                raise RuntimeError("Output video is empty (0 bytes)")

            with open(output_path, "rb") as f:
                output_bytes = f.read()

            if output_bytes == inputs.source_video_bytes:
                raise RuntimeError(
                    "INTEGRITY FAILURE: Generated output identical to source"
                )

            timings["total_ms"] = int((time.monotonic() - t0) * 1000)

            logger.info(
                "MimicMotion generation complete: %d frames, %d bytes, %dms",
                len(output_frames), output_size, timings["total_ms"],
            )

            return MotionTransferResult(
                output_video_bytes=output_bytes,
                content_type="video/mp4",
                backend_name="mimic_motion",
                timings=timings,
                metadata={
                    "mode": settings.mode,
                    "model": "MimicMotion-v1.1",
                    "num_inference_steps": _num_steps(),
                    "output_frames": len(output_frames),
                    "output_size_bytes": output_size,
                    "resolution": resolution,
                    "seed": settings.seed or 42,
                },
            )

        finally:
            try:
                shutil.rmtree(workspace, ignore_errors=True)
            except Exception:
                logger.warning("Failed to clean workspace %s", workspace)
