"""CPU-side preprocessing for motion transfer inputs.

Extracts metadata from source video, validates constraints, extracts audio,
and produces a preview frame — all on CPU before GPU generation.
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import tempfile
import time
from io import BytesIO

from PIL import Image

logger = logging.getLogger(__name__)


def probe_video(video_bytes: bytes) -> dict:
    """Extract video metadata using ffprobe. Returns dict with keys:
    duration_sec, fps, width, height, has_audio, codec.
    """
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        f.write(video_bytes)
        tmp_path = f.name

    try:
        cmd = [
            "ffprobe", "-v", "quiet",
            "-print_format", "json",
            "-show_format", "-show_streams",
            tmp_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            raise RuntimeError(f"ffprobe failed: {result.stderr[:300]}")

        data = json.loads(result.stdout)
        streams = data.get("streams", [])
        fmt = data.get("format", {})

        video_stream = next((s for s in streams if s["codec_type"] == "video"), None)
        audio_stream = next((s for s in streams if s["codec_type"] == "audio"), None)

        if not video_stream:
            raise ValueError("No video stream found in source file")

        # Parse FPS from r_frame_rate (e.g., "24/1" or "30000/1001")
        fps_parts = video_stream.get("r_frame_rate", "24/1").split("/")
        fps = float(fps_parts[0]) / float(fps_parts[1]) if len(fps_parts) == 2 else 24.0

        return {
            "duration_sec": float(fmt.get("duration", 0)),
            "fps": round(fps, 2),
            "width": int(video_stream.get("width", 0)),
            "height": int(video_stream.get("height", 0)),
            "has_audio": audio_stream is not None,
            "codec": video_stream.get("codec_name", "unknown"),
        }
    finally:
        os.unlink(tmp_path)


def extract_preview_frame(video_bytes: bytes, time_sec: float = 0.5) -> bytes:
    """Extract a single frame from the video at time_sec as JPEG bytes."""
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        f.write(video_bytes)
        src_path = f.name

    out_path = src_path + "_preview.jpg"

    try:
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(time_sec),
            "-i", src_path,
            "-frames:v", "1",
            "-q:v", "2",
            out_path,
        ]
        subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if os.path.exists(out_path):
            with open(out_path, "rb") as f:
                return f.read()

        # Fallback: try at 0 sec
        cmd[2] = "0"
        subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if os.path.exists(out_path):
            with open(out_path, "rb") as f:
                return f.read()

        raise RuntimeError("Failed to extract preview frame")
    finally:
        for p in (src_path, out_path):
            if os.path.exists(p):
                os.unlink(p)


def extract_audio(video_bytes: bytes) -> bytes | None:
    """Extract audio track from video as WAV bytes. Returns None if no audio."""
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        f.write(video_bytes)
        src_path = f.name

    out_path = src_path + "_audio.wav"

    try:
        cmd = [
            "ffmpeg", "-y",
            "-i", src_path,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            out_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0 or not os.path.exists(out_path):
            return None

        with open(out_path, "rb") as f:
            audio_bytes = f.read()

        return audio_bytes if len(audio_bytes) > 44 else None  # WAV header is 44 bytes
    finally:
        for p in (src_path, out_path):
            if os.path.exists(p):
                os.unlink(p)


def validate_source_video(meta: dict, max_duration_sec: float = 30.0) -> list[str]:
    """Validate source video metadata. Returns list of error messages."""
    errors = []
    if meta["duration_sec"] > max_duration_sec:
        errors.append(
            f"Source video too long: {meta['duration_sec']:.1f}s "
            f"(max {max_duration_sec}s)"
        )
    if meta["width"] < 64 or meta["height"] < 64:
        errors.append(
            f"Source video too small: {meta['width']}x{meta['height']} (min 64x64)"
        )
    if meta["width"] > 4096 or meta["height"] > 4096:
        errors.append(
            f"Source video too large: {meta['width']}x{meta['height']} (max 4096x4096)"
        )
    return errors
