from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.modules.auth.models import Profile
from app.modules.billing.service import is_active_subscriber
from app.modules.creators.models import Follow
from app.modules.media.models import MediaDerivedAsset, MediaObject
from app.modules.media.storage import StorageClient
from app.modules.posts.models import Post, PostMedia
from app.modules.posts.service import _can_see_post
from app.modules.posts.constants import POST_STATUS_PUBLISHED, VISIBILITY_PUBLIC

CONTENT_TYPE_VIDEO_MP4 = "video/mp4"

VALID_DOWNLOAD_VARIANTS = frozenset({"thumb", "grid", "full", "poster"})

# Variants that must not fall back to original (e.g. poster for video: no poster => no URL)
VARIANT_NO_FALLBACK = frozenset({"poster"})
TEASER_VARIANTS = frozenset({"thumb", "grid"})


def validate_media_upload(content_type: str, size_bytes: int) -> None:
    """Raise AppError if content_type or size is not allowed. Does not decode or stream."""
    if not content_type:
        raise AppError(status_code=400, detail="content_type_required")
    ct_lower = content_type.lower().strip()
    settings = get_settings()
    if ct_lower.startswith("image/"):
        if size_bytes > settings.media_max_image_bytes:
            raise AppError(status_code=413, detail="image_exceeds_max_size")
        return
    if ct_lower == CONTENT_TYPE_VIDEO_MP4:
        if not settings.media_allow_video:
            raise AppError(status_code=400, detail="video_upload_disabled")
        if size_bytes > settings.media_max_video_bytes:
            raise AppError(status_code=413, detail="video_exceeds_max_size")
        return
    raise AppError(status_code=400, detail="unsupported_media_type")


async def resolve_download_object_key(
    session: AsyncSession,
    media_id: UUID,
    original_object_key: str,
    variant: str | None,
) -> str | None:
    """Return object_key for download, or None when variant requested but no derived (e.g. poster)."""
    if not variant or variant not in VALID_DOWNLOAD_VARIANTS:
        return original_object_key
    result = await session.execute(
        select(MediaDerivedAsset.object_key).where(
            MediaDerivedAsset.parent_asset_id == media_id,
            MediaDerivedAsset.variant == variant,
        ).limit(1)
    )
    row = result.scalar_one_or_none()
    if row is not None:
        return row
    if variant in VARIANT_NO_FALLBACK:
        return None
    return original_object_key


async def can_anonymous_access_media(
    session: AsyncSession,
    media_id: UUID,
    variant: str | None = None,
) -> bool:
    """True if media is publicly viewable: used in a PUBLIC post or is a creator avatar/banner."""
    # Used in any post with visibility PUBLIC
    post_public = await session.execute(
        select(Post.id)
        .join(PostMedia, PostMedia.post_id == Post.id)
        .where(
            PostMedia.media_asset_id == media_id,
            Post.visibility == VISIBILITY_PUBLIC,
        )
        .limit(1)
    )
    if post_public.scalar_one_or_none() is not None:
        return True
    # Locked teaser behavior: permit signed thumb/grid for non-public published posts.
    if variant in TEASER_VARIANTS:
        now = datetime.now(timezone.utc)
        teaser_post = await session.execute(
            select(Post.id)
            .join(PostMedia, PostMedia.post_id == Post.id)
            .where(
                PostMedia.media_asset_id == media_id,
                Post.visibility != VISIBILITY_PUBLIC,
                Post.status == POST_STATUS_PUBLISHED,
                ((Post.publish_at.is_(None)) | (Post.publish_at <= now)),
            )
            .limit(1)
        )
        if teaser_post.scalar_one_or_none() is not None:
            return True
    # Creator profile avatar or banner
    profile_asset = await session.execute(
        select(Profile.id).where(
            (Profile.avatar_asset_id == media_id) | (Profile.banner_asset_id == media_id),
        ).limit(1)
    )
    return profile_asset.scalar_one_or_none() is not None


async def can_user_access_media(
    session: AsyncSession,
    media_id: UUID,
    user_id: UUID,
    variant: str | None = None,
) -> bool:
    """True if user is media owner or can see a post that references this asset (visibility rules)."""
    result = await session.execute(select(MediaObject).where(MediaObject.id == media_id))
    media = result.scalar_one_or_none()
    if not media:
        return False
    if media.owner_user_id == user_id:
        return True
    # Check if any post that uses this asset is visible to the viewer
    posts_result = await session.execute(
        select(Post)
        .join(PostMedia, PostMedia.post_id == Post.id)
        .where(PostMedia.media_asset_id == media_id)
    )
    posts = list(posts_result.scalars().unique().all())
    for post in posts:
        is_follower_result = await session.execute(
            select(Follow.id).where(
                Follow.fan_user_id == user_id,
                Follow.creator_user_id == post.creator_user_id,
            ).limit(1)
        )
        is_follower = is_follower_result.scalar_one_or_none() is not None
        is_subscriber = await is_active_subscriber(session, user_id, post.creator_user_id)
        if await _can_see_post(
            session,
            post,
            viewer_user_id=user_id,
            is_follower=is_follower,
            is_subscriber=is_subscriber,
        ):
            return True
        # Locked teaser behavior: allow only non-full variants for inaccessible posts.
        if variant in TEASER_VARIANTS:
            now = datetime.now(timezone.utc)
            if (
                post.visibility != VISIBILITY_PUBLIC
                and post.status == POST_STATUS_PUBLISHED
                and (post.publish_at is None or post.publish_at <= now)
            ):
                return True
    return False


async def create_media_object(
    session: AsyncSession,
    owner_user_id: UUID,
    object_key: str,
    content_type: str,
    size_bytes: int,
) -> MediaObject:
    media = MediaObject(
        owner_user_id=owner_user_id,
        object_key=object_key,
        content_type=content_type,
        size_bytes=size_bytes,
    )
    session.add(media)
    await session.commit()
    await session.refresh(media)
    return media


def generate_signed_upload(storage: StorageClient, object_key: str, content_type: str) -> str:
    return storage.create_signed_upload_url(object_key, content_type)


def generate_signed_download(storage: StorageClient, object_key: str) -> str:
    return storage.create_signed_download_url(object_key)
