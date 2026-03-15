"""Abstract interface for motion transfer generation backends.

Every concrete backend (WanAnimate, XDyna, MimicMotion, etc.) must implement
this interface so the worker pipeline stays backend-agnostic.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any


@dataclass
class MotionTransferInputs:
    """Normalized inputs passed to every generation backend."""

    source_video_bytes: bytes
    source_content_type: str  # video/mp4 or image/*
    target_bytes: bytes
    target_content_type: str
    garment_bytes: bytes | None = None
    garment_content_type: str | None = None

    # Extracted metadata (filled by preprocess)
    source_fps: float = 24.0
    source_duration_sec: float = 0.0
    source_width: int = 0
    source_height: int = 0
    source_has_audio: bool = False
    source_audio_path: str | None = None  # temp path to extracted wav


@dataclass
class MotionTransferSettings:
    """User-controlled settings, normalized from the API request."""

    mode: str = "animate"  # "animate" | "replace"
    preserve_background: bool = False
    preserve_audio: bool = True
    lip_sync_boost: bool = False
    realism: float = 0.7
    identity_strength: float = 0.8
    motion_fidelity: float = 0.9
    garment_fidelity: float = 0.7
    output_resolution: int = 512
    output_fps: int = 24
    seed: int | None = None
    retarget_pose: bool = False
    use_relighting_lora: bool = False


@dataclass
class MotionTransferResult:
    """Output from a generation backend."""

    output_video_bytes: bytes
    content_type: str = "video/mp4"
    backend_name: str = ""
    timings: dict[str, int] = field(default_factory=dict)  # stage → ms
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class BackendCapabilities:
    """Advertised capabilities of a generation backend."""

    name: str
    max_duration_sec: float = 10.0
    max_resolution: int = 1024
    supports_garment: bool = False
    supports_lip_sync: bool = False
    supports_background_preservation: bool = False
    requires_gpu: bool = True


class MotionTransferBackend(abc.ABC):
    """Interface every motion transfer backend must implement."""

    @abc.abstractmethod
    def get_capabilities(self) -> BackendCapabilities:
        ...

    @abc.abstractmethod
    def validate_inputs(
        self, inputs: MotionTransferInputs, settings: MotionTransferSettings
    ) -> list[str]:
        """Return list of validation errors, empty if valid."""
        ...

    @abc.abstractmethod
    def prepare(
        self, inputs: MotionTransferInputs, settings: MotionTransferSettings
    ) -> dict:
        """Backend-specific preparation (download models, etc). Returns prep context."""
        ...

    @abc.abstractmethod
    def generate(
        self,
        inputs: MotionTransferInputs,
        settings: MotionTransferSettings,
        prep_context: dict,
        progress_callback: Any | None = None,
    ) -> MotionTransferResult:
        """Run the actual generation. May take minutes on GPU."""
        ...
