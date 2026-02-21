"""Media tasks: generate derived image variants (thumb, grid, full) with optional watermark.

Enhanced features:
- Blurhash placeholder generation
- Dominant color extraction
- Attention-aware smart crops (face detection → saliency → center)
- Blurred teaser variant for locked posts
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from io import BytesIO

import blurhash as blurhash_lib
import cv2
import numpy as np
from PIL import Image, ImageFilter
from celery import shared_task
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.settings import get_settings
from app.modules.media.models import MediaDerivedAsset, MediaObject
from worker.storage_io import get_media_bucket, get_object_bytes, put_object_bytes
from worker.watermark import apply_centered_watermark, apply_footer_watermark, should_watermark_variant

logger = logging.getLogger(__name__)

# Variant max dimension (no upscaling)
VARIANT_SPECS: dict[str, int] = {
    "thumb": 200,
    "grid": 600,
    "full": 1200,
}

TEASER_BLUR_RADIUS = 30
SMART_CROP_GRID = 4  # NxN grid for saliency fallback

# Aspect-ratio crop specs: variant_name → (ratio_w, ratio_h, max_dim)
ASPECT_RATIO_SPECS: dict[str, tuple[int, int, int]] = {
    "crop_1x1": (1, 1, 600),
    "crop_4x5": (4, 5, 600),
    "crop_16x9": (16, 9, 600),
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


# ---------------------------------------------------------------------------
# Blurhash + dominant color
# ---------------------------------------------------------------------------


def _compute_blurhash(img: Image.Image) -> str:
    """Compute a compact blurhash string from a PIL image (resized to ≤64px for speed)."""
    small = img.copy()
    small.thumbnail((64, 64), Image.Resampling.LANCZOS)
    return blurhash_lib.encode(small, x_components=4, y_components=3)


def _compute_dominant_color(img: Image.Image) -> str:
    """Return hex dominant color (#RRGGBB) by resizing to 1×1."""
    pixel = img.resize((1, 1), Image.Resampling.LANCZOS).getpixel((0, 0))
    if isinstance(pixel, int):
        return f"#{pixel:02x}{pixel:02x}{pixel:02x}"
    r, g, b = pixel[0], pixel[1], pixel[2]
    return f"#{r:02x}{g:02x}{b:02x}"


# ---------------------------------------------------------------------------
# Attention-aware smart crop
# ---------------------------------------------------------------------------

_FACE_CASCADE: cv2.CascadeClassifier | None = None


def _get_face_cascade() -> cv2.CascadeClassifier:
    """Lazy-load Haar cascade for frontal face detection."""
    global _FACE_CASCADE
    if _FACE_CASCADE is None:
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        _FACE_CASCADE = cv2.CascadeClassifier(cascade_path)
    return _FACE_CASCADE


def _compute_smart_crop(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Crop img to target_w×target_h using attention-aware strategy.

    Priority: face center → saliency hotspot → geometric center.
    """
    w, h = img.size
    if w <= target_w and h <= target_h:
        return img.copy()

    # Determine the crop region center
    cx, cy = w / 2, h / 2

    # Try face detection
    arr = np.array(img)
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    cascade = _get_face_cascade()
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

    if len(faces) > 0:
        # Center on the largest face
        largest = max(faces, key=lambda f: f[2] * f[3])
        fx, fy, fw, fh = largest
        cx = fx + fw / 2
        cy = fy + fh / 2
    else:
        # Saliency fallback: find region with highest intensity variance
        grid_n = SMART_CROP_GRID
        cell_w, cell_h = w // grid_n, h // grid_n
        if cell_w > 0 and cell_h > 0:
            best_var = -1.0
            for gi in range(grid_n):
                for gj in range(grid_n):
                    x0, y0 = gj * cell_w, gi * cell_h
                    cell = gray[y0 : y0 + cell_h, x0 : x0 + cell_w]
                    v = float(cell.var())
                    if v > best_var:
                        best_var = v
                        cx = x0 + cell_w / 2
                        cy = y0 + cell_h / 2

    # Compute crop box centered on (cx, cy), clamped to image bounds
    left = max(0, int(cx - target_w / 2))
    top = max(0, int(cy - target_h / 2))
    if left + target_w > w:
        left = w - target_w
    if top + target_h > h:
        top = h - target_h
    left = max(0, left)
    top = max(0, top)

    return img.crop((left, top, left + target_w, top + target_h))


# ---------------------------------------------------------------------------
# Teaser variant (heavy Gaussian blur for locked posts)
# ---------------------------------------------------------------------------


def _generate_aspect_crop(
    img: Image.Image, ratio_w: int, ratio_h: int, max_dim: int
) -> Image.Image:
    """Crop image to a specific aspect ratio using smart crop, then resize.

    The crop region is the largest rectangle with the given aspect ratio that
    fits within the image, centered on the smart-crop attention point.
    """
    w, h = img.size
    target_ratio = ratio_w / ratio_h

    # Determine crop dimensions that fill the image at the target ratio
    if w / h > target_ratio:
        # Image is wider than target ratio → constrain by height
        crop_h = h
        crop_w = int(h * target_ratio)
    else:
        # Image is taller than target ratio → constrain by width
        crop_w = w
        crop_h = int(w / target_ratio)

    crop_w = min(crop_w, w)
    crop_h = min(crop_h, h)

    # Use existing smart crop (face detection → saliency → center)
    cropped = _compute_smart_crop(img, crop_w, crop_h)

    # Resize to fit within max_dim
    return _resize_no_upscale(cropped, max_dim)


def _generate_teaser_image(img: Image.Image) -> Image.Image:
    """Apply heavy Gaussian blur + noise for locked-post teasers (anti-deconvolution)."""
    blurred = img.filter(ImageFilter.GaussianBlur(radius=TEASER_BLUR_RADIUS))
    arr = np.array(blurred, dtype=np.int16)
    noise = np.random.normal(0, 8, arr.shape).astype(np.int16)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------


def _make_session_factory() -> async_sessionmaker[AsyncSession]:
    """Create a fresh async session factory per task invocation.

    Avoids the 'Future attached to a different loop' error that occurs when
    a module-level engine is reused across separate asyncio.run() calls in
    Celery forked worker processes.
    """
    engine = create_async_engine(str(get_settings().database_url), pool_pre_ping=True)
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def _update_asset_placeholders(
    parent_asset_id: uuid.UUID, bh: str, color: str
) -> None:
    """Store computed blurhash + dominant_color on the media_assets row."""
    async with _make_session_factory()() as session:
        await session.execute(
            update(MediaObject)
            .where(MediaObject.id == parent_asset_id)
            .values(blurhash=bh, dominant_color=color)
        )
        await session.commit()


async def _insert_derived(parent_asset_id: uuid.UUID, variant: str, object_key: str) -> None:
    async with _make_session_factory()() as session:
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
    async with _make_session_factory()() as session:
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
    bucket = get_media_bucket()
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

    # Smart crop for thumb variant: attention-aware square crop before resize
    if variant == "thumb":
        w, h = img.size
        crop_dim = min(w, h)
        if w != h and crop_dim >= max_dim:
            try:
                img = _compute_smart_crop(img, crop_dim, crop_dim)
            except Exception:
                logger.warning("Smart crop failed, falling back to center crop", extra={"variant": variant})

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
    Generate thumb, grid, full, teaser variants; compute blurhash + dominant color.
    Optionally apply footer watermark. Uses attention-aware smart crops.
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

    # --- Blurhash + dominant color ---
    try:
        bucket = get_media_bucket()
        raw = get_object_bytes(bucket, object_key)
        img = Image.open(BytesIO(raw)).convert("RGB")

        bh = _compute_blurhash(img)
        color = _compute_dominant_color(img)
        asyncio.run(_update_asset_placeholders(parent_id, bh, color))
        result["blurhash"] = bh
        result["dominant_color"] = color
        logger.info("Blurhash + color computed", extra={"asset_id": asset_id, "blurhash": bh, "color": color})
    except Exception:
        logger.exception("Failed to compute blurhash/color", extra={"asset_id": asset_id})

    # --- Aspect-ratio crops (feature-gated) ---
    settings = get_settings()
    if settings.enable_smart_previews:
        try:
            bucket = get_media_bucket()
            raw = get_object_bytes(bucket, object_key)
            img = Image.open(BytesIO(raw)).convert("RGB")

            for crop_variant, (rw, rh, max_dim) in ASPECT_RATIO_SPECS.items():
                try:
                    if asyncio.run(_get_derived_exists(parent_id, crop_variant)):
                        logger.info("Aspect crop exists, skipping", extra={"asset_id": asset_id, "variant": crop_variant})
                        continue

                    cropped = _generate_aspect_crop(img, rw, rh, max_dim)
                    cropped = _strip_exif(cropped)
                    buf = BytesIO()
                    cropped.save(buf, format="JPEG", quality=85)
                    buf.seek(0)
                    crop_key = _derived_object_key(object_key, crop_variant)
                    put_object_bytes(bucket, crop_key, buf.getvalue(), "image/jpeg")
                    asyncio.run(_insert_derived(parent_id, crop_variant, crop_key))
                    result[crop_variant] = crop_key
                    logger.info("Aspect crop generated", extra={"asset_id": asset_id, "variant": crop_variant})
                except Exception:
                    logger.exception("Failed aspect crop", extra={"asset_id": asset_id, "variant": crop_variant})
        except Exception:
            logger.exception("Failed to load image for aspect crops", extra={"asset_id": asset_id})

    # --- Teaser variant (blurred preview for locked posts) ---
    try:
        if not asyncio.run(_get_derived_exists(parent_id, "teaser")):
            bucket = get_media_bucket()
            raw = get_object_bytes(bucket, object_key)
            img = Image.open(BytesIO(raw)).convert("RGB")
            teaser_img = _resize_no_upscale(img, VARIANT_SPECS["grid"])
            teaser_img = _generate_teaser_image(teaser_img)
            teaser_img = _strip_exif(teaser_img)

            buf = BytesIO()
            teaser_img.save(buf, format="JPEG", quality=60)
            buf.seek(0)
            teaser_key = _derived_object_key(object_key, "teaser")
            put_object_bytes(bucket, teaser_key, buf.getvalue(), "image/jpeg")
            asyncio.run(_insert_derived(parent_id, "teaser", teaser_key))
            result["teaser"] = teaser_key
            logger.info("Teaser generated", extra={"asset_id": asset_id, "key": teaser_key})
        else:
            logger.info("Teaser already exists, skipping", extra={"asset_id": asset_id})
    except Exception:
        logger.exception("Failed to generate teaser", extra={"asset_id": asset_id})

    # --- Watermarked preview variant (for non-entitled users) ---
    if settings.media_wm_preview_enabled:
        try:
            if not asyncio.run(_get_derived_exists(parent_id, "wm_preview")):
                bucket = get_media_bucket()
                raw = get_object_bytes(bucket, object_key)
                img = Image.open(BytesIO(raw)).convert("RGB")
                wm_img = _resize_no_upscale(img, settings.media_wm_preview_max_dim)
                wm_img = _strip_exif(wm_img)

                wm_text = settings.media_wm_preview_text
                if settings.media_wm_preview_include_handle and owner_handle:
                    wm_text = f"{wm_text} @{owner_handle}"
                wm_img = apply_centered_watermark(
                    wm_img,
                    wm_text,
                    font_size_pct=settings.media_wm_preview_font_size_pct,
                    min_font_size=settings.media_wm_preview_min_font_size,
                    max_font_size=settings.media_wm_preview_max_font_size,
                    opacity=settings.media_wm_preview_opacity,
                    stroke_px=settings.media_wm_preview_stroke_px,
                    bg_rect=settings.media_wm_preview_bg_rect,
                )

                buf = BytesIO()
                wm_img.save(buf, format="JPEG", quality=75)
                buf.seek(0)
                wm_key = _derived_object_key(object_key, "wm_preview")
                put_object_bytes(bucket, wm_key, buf.getvalue(), "image/jpeg")
                asyncio.run(_insert_derived(parent_id, "wm_preview", wm_key))
                result["wm_preview"] = wm_key
                logger.info("wm_preview generated", extra={"asset_id": asset_id, "key": wm_key})
            else:
                logger.info("wm_preview already exists, skipping", extra={"asset_id": asset_id})
        except Exception:
            logger.exception("Failed to generate wm_preview", extra={"asset_id": asset_id})

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

    bucket = get_media_bucket()
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
        async with _make_session_factory()() as session:
            r = await session.execute(
                select(MediaObject.object_key).where(MediaObject.id == parent_asset_id).limit(1)
            )
            row = r.scalar_one_or_none()
            if not row:
                raise ValueError(f"Media asset not found: {parent_asset_id}")
            return row
    return asyncio.run(_fetch())
