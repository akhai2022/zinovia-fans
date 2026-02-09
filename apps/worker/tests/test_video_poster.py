"""Unit tests for video poster task: key format and idempotency."""

from __future__ import annotations

import uuid

import pytest

from worker.tasks.media import (
    POSTER_VARIANT,
    _build_poster_ffmpeg_cmd,
    _poster_object_key,
)


def test_poster_object_key_format() -> None:
    """Poster key is deterministic and under media/; original video unchanged."""
    asset_id = uuid.uuid4()
    key = _poster_object_key(asset_id)
    assert key == f"media/{asset_id}/poster.webp"
    assert key.endswith(".webp")
    assert "poster" in key


def test_poster_variant_constant() -> None:
    """Poster variant is 'poster' for media_derived_assets.variant."""
    assert POSTER_VARIANT == "poster"


def test_build_poster_ffmpeg_cmd_uses_time_and_max_width() -> None:
    """Command builder uses configured time_sec and max_width; no ffmpeg run in test."""
    cmd = _build_poster_ffmpeg_cmd(
        time_sec=2.5,
        max_width=640,
        video_path="/tmp/in.mp4",
        out_path="/tmp/out.webp",
    )
    assert cmd[0] == "ffmpeg"
    assert "-ss" in cmd
    assert cmd[cmd.index("-ss") + 1] == "2.5"
    assert "-vf" in cmd
    assert "scale=640:-2" in cmd
    assert cmd[-1] == "/tmp/out.webp"
    assert "-i" in cmd
    assert cmd[cmd.index("-i") + 1] == "/tmp/in.mp4"


def test_poster_idempotent_skips_when_derived_exists() -> None:
    """When derived (poster) already exists, task returns None (no duplicate)."""
    import asyncio
    from unittest.mock import patch
    from worker.tasks.media import generate_video_poster

    async def mock_derived_exists(*args, **kwargs):
        return True

    asset_id = str(uuid.uuid4())
    with patch("worker.tasks.media._get_derived_exists", side_effect=mock_derived_exists):
        result = generate_video_poster(asset_id)
    assert result is None
