"""Media tasks: generate derived image variants (thumb, grid, full) with optional watermark."""

from __future__ import annotations

import asyncio
import logging
import uuid
from io import BytesIO

from PIL import Image
from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.db.session import async_session_factory
from app.modules.media.models import MediaDerivedAsset, MediaObject
from worker.storage_io import get_object_bytes, put_object_bytes
from worker.watermark import apply_footer_watermark, should_watermark_variant

logger = logging.getLogger(__name__)

# Variant max dimension (no upscaling)
VARIANT_SPECS: dict[str, int] = {
    "thumb": 200,
    "grid": 600,
    "full": 1200,
}


def _derived_object_key(parent_key: str, variant: str) -> str:
    """e.g. uploads/foo.png -> derived/uploads/foo_thumb.jpg"""
    base, _ = parent_key.rsplit(".", 1) if "." in parent_key else (parent_key, "")
    return f"derived/{base}_{variant}.jpg"


def _resize_no_upscale(img: Image.Image, max_size: int) -> Image.Image:
    w, h = img.size
    if w <= max_size and h <= max_size:
        return img.copy()
    if w >= h:
        new_w = max_size
        new_h = max(1, int(h * max_size / w))
    else:
        new_h = max_size
        new_w = max(1, int(w * max_size / h))
    return img.resize((new_w, new_h), Image.Resampling.LANCZOS)


def _strip_exif(img: Image.Image) -> Image.Image:
    """Return a copy without EXIF/metadata; save as JPEG later does not embed original EXIF."""
    out = img.copy()
    out.info.clear()
    return out


async def _insert_derived(parent_asset_id: uuid.UUID, variant: str, object_key: str) -> None:
    async with async_session_factory() as session:
        session.add(
            MediaDerivedAsset(
                id=uuid.uuid4(),
                parent_asset_id=parent_asset_id,
                variant=variant,
                object_key=object_key,
            )
        )
        await session.commit()


async def _derived_exists(session: AsyncSession, parent_asset_id: uuid.UUID, variant: str) -> bool:
    r = await session.execute(
        select(MediaDerivedAsset.id).where(
            MediaDerivedAsset.parent_asset_id == parent_asset_id,
            MediaDerivedAsset.variant == variant,
        ).limit(1)
    )
    return r.scalar_one_or_none() is not None


async def _get_derived_exists(parent_asset_id: uuid.UUID, variant: str) -> bool:
    async with async_session_factory() as session:
        return await _derived_exists(session, parent_asset_id, variant)


def _generate_one_variant(
    parent_asset_id: uuid.UUID,
    parent_object_key: str,
    content_type: str,
    variant: str,
    owner_handle: str | None,
) -> str | None:
    """Generate a single variant; upload and return object_key. Returns None if skipped (e.g. idempotent)."""
    settings = get_settings()
    bucket = settings.minio_bucket
    max_dim = VARIANT_SPECS.get(variant)
    if not max_dim:
        return None

    # Idempotent: skip if already exists
    if asyncio.run(_get_derived_exists(parent_asset_id, variant)):
        logger.info("Derived already exists, skipping", extra={"parent_asset_id": str(parent_asset_id), "variant": variant})
        return None

    raw = get_object_bytes(bucket, parent_object_key)
    img = Image.open(BytesIO(raw))
    img = img.convert("RGB")

    img = _resize_no_upscale(img, max_dim)
    img = _strip_exif(img)

    watermark_list = settings.media_watermark_variant_list()
    if should_watermark_variant(variant, settings.media_watermark_enabled, watermark_list):
        text = settings.media_watermark_text
        if settings.media_watermark_include_handle and owner_handle:
            text = f"{text} @{owner_handle}"
        img = apply_footer_watermark(
            img,
            text,
            height_pct=settings.media_watermark_height_pct,
            opacity=settings.media_watermark_opacity,
            bg=settings.media_watermark_bg,
            padding_pct=settings.media_watermark_padding_pct,
            align=settings.media_watermark_text_align,
        )

    buf = BytesIO()
    img.save(buf, format="JPEG", quality=85)
    buf.seek(0)
    derived_key = _derived_object_key(parent_object_key, variant)
    put_object_bytes(bucket, derived_key, buf.getvalue(), "image/jpeg")

    asyncio.run(_insert_derived(parent_asset_id, variant, derived_key))
    return derived_key


@shared_task(name="media.generate_thumbnail")
def generate_thumbnail(object_key: str) -> str:
    """Legacy task name; delegates to generate_derived_variants for asset_id."""
    logger.info(
        "generate_thumbnail (legacy): use generate_derived_variants with asset_id",
        extra={"object_key": object_key},
    )
    return object_key


@shared_task(name="media.generate_derived_variants")
def generate_derived_variants(
    asset_id: str,
    object_key: str,
    content_type: str,
    owner_handle: str | None = None,
) -> dict[str, str]:
    """
    Generate thumb, grid, full variants; optionally apply footer watermark.
    Idempotent: skips variant if media_derived_assets already has (asset_id, variant).
    Original object_key is never modified.
    """
    try:
        parent_id = uuid.UUID(asset_id)
    except ValueError:
        logger.warning("Invalid asset_id", extra={"asset_id": asset_id})
        return {}

    if not content_type or not content_type.lower().startswith("image/"):
        logger.info("Skip non-image", extra={"asset_id": asset_id})
        return {}

    result: dict[str, str] = {}
    for variant in VARIANT_SPECS:
        try:
            derived_key = _generate_one_variant(
                parent_id,
                object_key,
                content_type,
                variant,
                owner_handle,
            )
            if derived_key:
                result[variant] = derived_key
        except Exception as e:
            logger.exception("Failed to generate variant", extra={"asset_id": asset_id, "variant": variant})
            raise e
    return result


# ---------------------------------------------------------------------------
# Video poster (MP4 frame at time_sec → webp)
# ---------------------------------------------------------------------------

POSTER_VARIANT = "poster"
POSTER_CONTENT_TYPE = "image/webp"


def _build_poster_ffmpeg_cmd(
    time_sec: float,
    max_width: int,
    video_path: str,
    out_path: str,
) -> list[str]:
    """Build ffmpeg command for extracting one frame at time_sec, scaled to max_width. Used by task and tests."""
    return [
        "ffmpeg",
        "-y",
        "-ss",
        str(time_sec),
        "-i",
        video_path,
        "-vframes",
        "1",
        "-vf",
        f"scale={max_width}:-2",
        "-c:v",
        "libwebp",
        "-q:v",
        "80",
        out_path,
    ]


def _poster_object_key(parent_asset_id: uuid.UUID) -> str:
    """Deterministic key for video poster; originals unchanged."""
    return f"media/{parent_asset_id}/poster.webp"


@shared_task(name="media.generate_video_poster")
def generate_video_poster(asset_id: str) -> str | None:
    """
    Extract a frame from MP4 at configured time, resize, upload as poster.
    Idempotent: skips if media_derived_assets already has (asset_id, poster).
    """
    import subprocess
    import tempfile

    try:
        parent_id = uuid.UUID(asset_id)
    except ValueError:
        logger.warning("Invalid asset_id", extra={"asset_id": asset_id})
        return None

    if asyncio.run(_get_derived_exists(parent_id, POSTER_VARIANT)):
        logger.info("Poster already exists", extra={"asset_id": asset_id})
        return None

    settings = get_settings()
    if not settings.media_video_poster_enabled:
        logger.info("Video poster disabled", extra={"asset_id": asset_id})
        return None

    bucket = settings.minio_bucket
    try:
        raw = get_object_bytes(bucket, _get_video_object_key(parent_id))
    except Exception as e:
        logger.exception("Failed to download video", extra={"asset_id": asset_id})
        raise

    time_sec = settings.media_video_poster_time_sec
    max_width = settings.media_video_poster_max_width

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as vf:
        vf.write(raw)
        video_path = vf.name
    try:
        out_path = video_path + ".webp"
        cmd = _build_poster_ffmpeg_cmd(time_sec, max_width, video_path, out_path)
        subprocess.run(cmd, check=True, capture_output=True)
        with open(out_path, "rb") as f:
            poster_bytes = f.read()
    finally:
        import os as _os

        _os.unlink(video_path)
        if _os.path.exists(out_path):
            _os.unlink(out_path)

    object_key = _poster_object_key(parent_id)
    put_object_bytes(bucket, object_key, poster_bytes, POSTER_CONTENT_TYPE)
    asyncio.run(_insert_derived(parent_id, POSTER_VARIANT, object_key))
    logger.info("Poster generated", extra={"asset_id": asset_id, "object_key": object_key})
    return object_key


def _get_video_object_key(parent_asset_id: uuid.UUID) -> str:
    """Fetch original object_key for the video asset from DB."""
    async def _fetch() -> str:
        async with async_session_factory() as session:
            r = await session.execute(
                select(MediaObject.object_key).where(MediaObject.id == parent_asset_id).limit(1)
            )
            row = r.scalar_one_or_none()
            if not row:
                raise ValueError(f"Media asset not found: {parent_asset_id}")
            return row
    return asyncio.run(_fetch())
