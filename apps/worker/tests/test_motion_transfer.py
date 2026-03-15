"""Unit tests for the motion transfer worker pipeline.

Tests preprocessing utilities and backend abstraction without needing
a real database or GPU.
"""

from __future__ import annotations

import json
import os
import subprocess
import tempfile

import pytest

from worker.ml.motion_transfer.base import (
    BackendCapabilities,
    MotionTransferInputs,
    MotionTransferResult,
    MotionTransferSettings,
)
from worker.ml.motion_transfer.registry import get_backend
from worker.ml.motion_transfer.stub_backend import StubMotionTransferBackend


# --- Backend abstraction tests ---

class TestStubBackend:
    def test_capabilities(self):
        backend = StubMotionTransferBackend()
        caps = backend.get_capabilities()
        assert isinstance(caps, BackendCapabilities)
        assert caps.name == "stub_passthrough"
        assert caps.requires_gpu is False

    def test_validate_inputs_empty_source(self):
        backend = StubMotionTransferBackend()
        inputs = MotionTransferInputs(
            source_video_bytes=b"",
            source_content_type="video/mp4",
            target_bytes=b"fake_target",
            target_content_type="image/jpeg",
        )
        settings = MotionTransferSettings()
        errors = backend.validate_inputs(inputs, settings)
        assert any("empty" in e for e in errors)

    def test_validate_inputs_empty_target(self):
        backend = StubMotionTransferBackend()
        inputs = MotionTransferInputs(
            source_video_bytes=b"fake_video",
            source_content_type="video/mp4",
            target_bytes=b"",
            target_content_type="image/jpeg",
        )
        settings = MotionTransferSettings()
        errors = backend.validate_inputs(inputs, settings)
        assert any("empty" in e for e in errors)

    def test_validate_inputs_duration_exceeded(self):
        backend = StubMotionTransferBackend()
        inputs = MotionTransferInputs(
            source_video_bytes=b"fake_video",
            source_content_type="video/mp4",
            target_bytes=b"fake_target",
            target_content_type="image/jpeg",
            source_duration_sec=60.0,
        )
        settings = MotionTransferSettings()
        errors = backend.validate_inputs(inputs, settings)
        assert any("30s" in e for e in errors)

    def test_validate_inputs_valid(self):
        backend = StubMotionTransferBackend()
        inputs = MotionTransferInputs(
            source_video_bytes=b"fake_video",
            source_content_type="video/mp4",
            target_bytes=b"fake_target",
            target_content_type="image/jpeg",
            source_duration_sec=5.0,
        )
        settings = MotionTransferSettings()
        errors = backend.validate_inputs(inputs, settings)
        assert errors == []

    def test_prepare(self):
        backend = StubMotionTransferBackend()
        inputs = MotionTransferInputs(
            source_video_bytes=b"fake",
            source_content_type="video/mp4",
            target_bytes=b"fake",
            target_content_type="image/jpeg",
        )
        settings = MotionTransferSettings()
        ctx = backend.prepare(inputs, settings)
        assert ctx == {"ready": True}


class TestBackendRegistry:
    def test_get_default_backend(self):
        backend = get_backend()
        assert isinstance(backend, StubMotionTransferBackend)

    def test_get_stub_by_name(self):
        backend = get_backend("stub_passthrough")
        assert isinstance(backend, StubMotionTransferBackend)

    def test_get_unknown_falls_back(self):
        backend = get_backend("nonexistent_backend")
        assert isinstance(backend, StubMotionTransferBackend)


# --- Preprocessing tests ---

class TestPreprocess:
    @pytest.fixture
    def sample_video_bytes(self) -> bytes:
        """Create a minimal valid MP4 using ffmpeg."""
        try:
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
                out_path = f.name
            cmd = [
                "ffmpeg", "-y",
                "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=24",
                "-c:v", "libx264", "-preset", "ultrafast",
                "-pix_fmt", "yuv420p",
                out_path,
            ]
            result = subprocess.run(cmd, capture_output=True, timeout=30)
            if result.returncode != 0:
                pytest.skip("ffmpeg not available")
            with open(out_path, "rb") as f:
                return f.read()
        finally:
            if os.path.exists(out_path):
                os.unlink(out_path)

    def test_probe_video(self, sample_video_bytes: bytes):
        from worker.ml.motion_transfer.preprocess import probe_video

        meta = probe_video(sample_video_bytes)
        assert meta["duration_sec"] > 0
        assert meta["fps"] > 0
        assert meta["width"] == 320
        assert meta["height"] == 240
        assert meta["codec"] == "h264"

    def test_validate_source_video_ok(self, sample_video_bytes: bytes):
        from worker.ml.motion_transfer.preprocess import probe_video, validate_source_video

        meta = probe_video(sample_video_bytes)
        errors = validate_source_video(meta)
        assert errors == []

    def test_validate_source_video_too_long(self):
        from worker.ml.motion_transfer.preprocess import validate_source_video

        meta = {
            "duration_sec": 60.0,
            "fps": 24,
            "width": 640,
            "height": 480,
            "has_audio": False,
            "codec": "h264",
        }
        errors = validate_source_video(meta, max_duration_sec=30.0)
        assert len(errors) == 1
        assert "too long" in errors[0].lower()

    def test_validate_source_video_too_small(self):
        from worker.ml.motion_transfer.preprocess import validate_source_video

        meta = {
            "duration_sec": 5.0,
            "fps": 24,
            "width": 32,
            "height": 32,
            "has_audio": False,
            "codec": "h264",
        }
        errors = validate_source_video(meta)
        assert len(errors) == 1
        assert "too small" in errors[0].lower()

    def test_extract_preview_frame(self, sample_video_bytes: bytes):
        from worker.ml.motion_transfer.preprocess import extract_preview_frame

        frame_bytes = extract_preview_frame(sample_video_bytes)
        assert len(frame_bytes) > 100
        # Should be valid JPEG
        assert frame_bytes[:2] == b"\xff\xd8"


# --- Settings normalization ---

class TestSettings:
    def test_default_settings(self):
        s = MotionTransferSettings()
        assert s.output_resolution == 512
        assert s.output_fps == 24
        assert s.realism == 0.7
        assert s.seed is None

    def test_custom_settings(self):
        s = MotionTransferSettings(
            realism=0.5,
            identity_strength=0.6,
            output_resolution=1024,
            output_fps=30,
            seed=42,
        )
        assert s.realism == 0.5
        assert s.output_resolution == 1024
        assert s.seed == 42
