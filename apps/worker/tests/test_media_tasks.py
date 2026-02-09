"""Unit tests for media task helpers: derived key is separate from original."""

from __future__ import annotations

from worker.tasks.media import _derived_object_key


def test_derived_object_key_distinct_from_original() -> None:
    """Derived assets use a different object_key; original is never overwritten."""
    parent_key = "uploads/creator/abc123.png"
    for variant in ("thumb", "grid", "full"):
        derived = _derived_object_key(parent_key, variant)
        assert derived != parent_key
        assert derived.startswith("derived/")
        assert variant in derived
        assert derived.endswith(".jpg")
