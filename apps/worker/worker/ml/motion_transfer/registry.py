"""Registry for motion transfer generation backends.

Production backends:
  wan_animate_14b  — Self-hosted GPU (Wan2.2-Animate via diffusers, requires CUDA GPU)
  replicate_hosted — Hosted API (Replicate, runs on CPU workers, GPU on Replicate's side)

Demo/test backends:
  demo_composite   — CPU OpenCV composite (NOT for production, dev/testing only)

Select via MOTION_TRANSFER_BACKEND env var. Default: replicate_hosted
(since current ECS workers are CPU-only; switch to wan_animate_14b when GPU workers are provisioned).
"""

from __future__ import annotations

import logging
import os

from worker.ml.motion_transfer.base import MotionTransferBackend

logger = logging.getLogger(__name__)

_BACKENDS: dict[str, type[MotionTransferBackend]] = {}
# Default: wan_animate_14b — runs on GPU ECS workers (EC2 g4dn Spot)
_DEFAULT_BACKEND = "wan_animate_14b"


def _register_defaults() -> None:
    from worker.ml.motion_transfer.wan_animate_backend import WanAnimateBackend
    from worker.ml.motion_transfer.replicate_backend import ReplicateMotionTransferBackend
    from worker.ml.motion_transfer.stub_backend import StubMotionTransferBackend

    _BACKENDS["wan_animate_14b"] = WanAnimateBackend
    _BACKENDS["replicate_hosted"] = ReplicateMotionTransferBackend
    _BACKENDS["demo_composite"] = StubMotionTransferBackend


def get_backend(name: str | None = None) -> MotionTransferBackend:
    """Instantiate and return a motion transfer backend by name."""
    if not _BACKENDS:
        _register_defaults()

    backend_name = name or os.environ.get("MOTION_TRANSFER_BACKEND", _DEFAULT_BACKEND)

    cls = _BACKENDS.get(backend_name)
    if cls is None:
        logger.error(
            "Unknown motion transfer backend %r. Available: %s",
            backend_name,
            list(_BACKENDS.keys()),
        )
        raise ValueError(
            f"Unknown motion transfer backend: {backend_name}. "
            f"Available: {list(_BACKENDS.keys())}."
        )

    instance = cls()
    logger.info("Using motion transfer backend: %s", instance.get_capabilities().name)
    return instance


def register_backend(name: str, cls: type[MotionTransferBackend]) -> None:
    """Register a new backend implementation."""
    _BACKENDS[name] = cls
