from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.core.errors import AppError
from app.core.settings import get_settings
from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user, get_optional_user
from app.modules.auth.models import Profile, User
from app.modules.creators.constants import CREATOR_ROLE
from app.modules.media.models import MediaObject
from app.modules.media.schemas import (
    BatchMediaCreate,
    BatchUploadUrlResponse,
    MediaCreate,
    MediaMineItem,
    MediaMinePage,
    SignedUrlResponse,
    UploadUrlResponse,
)
from app.modules.media.service import (
    can_anonymous_access_media,
    can_user_access_media,
    create_media_object,
    delete_media,
    generate_signed_download,
    generate_signed_upload,
    resolve_download_object_key,
    validate_media_upload,
)
from app.modules.media.storage import get_storage_client
from app.modules.audit.service import log_audit_event, ACTION_MEDIA_DELETED, ACTION_MEDIA_UPLOADED

logger = logging.getLogger(__name__)

router = APIRouter()


def _is_image_content_type(content_type: str) -> bool:
    return bool(content_type and content_type.lower().strip().startswith("image/"))


@router.post("/upload-url", response_model=UploadUrlResponse, operation_id="media_upload_url")
async def create_upload_url(
    payload: MediaCreate,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> UploadUrlResponse:
    validate_media_upload(payload.content_type, payload.size_bytes)
    media = await create_media_object(
        session,
        owner_user_id=user.id,
        object_key=payload.object_key,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
    )
    storage = get_storage_client()
    upload_url = generate_signed_upload(storage, media.object_key, media.content_type)

    # Enqueue derived variants for images (thumb, grid, full)
    if _is_image_content_type(payload.content_type):
        owner_handle = None
        try:
            r = await session.execute(
                select(Profile.handle).where(Profile.user_id == user.id).limit(1)
            )
            owner_handle = r.scalar_one_or_none()
        except Exception:
            pass
        try:
            from app.celery_client import enqueue_generate_derived_variants
            enqueue_generate_derived_variants(
                str(media.id),
                media.object_key,
                media.content_type,
                owner_handle=owner_handle,
            )
        except Exception as e:
            logger.warning("Failed to enqueue generate_derived_variants: %s", e)

    await log_audit_event(
        session,
        action=ACTION_MEDIA_UPLOADED,
        actor_id=user.id,
        resource_type="media",
        resource_id=str(media.id),
        metadata={"content_type": payload.content_type, "size_bytes": payload.size_bytes},
    )
    return UploadUrlResponse(asset_id=media.id, upload_url=upload_url)


@router.post(
    "/batch-upload-urls",
    response_model=BatchUploadUrlResponse,
    operation_id="media_batch_upload_urls",
)
async def create_batch_upload_urls(
    payload: BatchMediaCreate,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> BatchUploadUrlResponse:
    """Create upload URLs for up to 10 files at once."""
    storage = get_storage_client()
    owner_handle = None
    has_images = any(_is_image_content_type(item.content_type) for item in payload.items)
    if has_images:
        try:
            r = await session.execute(
                select(Profile.handle).where(Profile.user_id == user.id).limit(1)
            )
            owner_handle = r.scalar_one_or_none()
        except Exception:
            pass

    results = []
    for item in payload.items:
        validate_media_upload(item.content_type, item.size_bytes)
        media = await create_media_object(
            session,
            owner_user_id=user.id,
            object_key=item.object_key,
            content_type=item.content_type,
            size_bytes=item.size_bytes,
        )
        upload_url = generate_signed_upload(storage, media.object_key, media.content_type)

        if _is_image_content_type(item.content_type):
            try:
                from app.celery_client import enqueue_generate_derived_variants
                enqueue_generate_derived_variants(
                    str(media.id),
                    media.object_key,
                    media.content_type,
                    owner_handle=owner_handle,
                )
            except Exception as e:
                logger.warning("Failed to enqueue generate_derived_variants: %s", e)

        await log_audit_event(
            session,
            action=ACTION_MEDIA_UPLOADED,
            actor_id=user.id,
            resource_type="media",
            resource_id=str(media.id),
            metadata={"content_type": item.content_type, "size_bytes": item.size_bytes},
        )
        results.append(UploadUrlResponse(asset_id=media.id, upload_url=upload_url))

    return BatchUploadUrlResponse(items=results)


@router.get(
    "/{media_id}/download-url",
    response_model=SignedUrlResponse,
    operation_id="media_download_url",
)
async def create_download_url(
    media_id: str,
    variant: str | None = None,
    session: AsyncSession = Depends(get_async_session),
    user: User | None = Depends(get_optional_user),
) -> SignedUrlResponse:
    try:
        media_uuid = UUID(media_id)
    except ValueError as exc:
        raise AppError(status_code=404, detail="media_not_found") from exc
    if user is not None:
        allowed = await can_user_access_media(session, media_uuid, user.id, variant=variant)
    else:
        allowed = await can_anonymous_access_media(session, media_uuid, variant=variant)
    if not allowed:
        raise AppError(status_code=404, detail="media_not_found")
    result = await session.execute(select(MediaObject).where(MediaObject.id == media_uuid))
    media = result.scalar_one()
    object_key = await resolve_download_object_key(
        session, media_uuid, media.object_key, variant
    )
    if object_key is None:
        raise AppError(status_code=404, detail="variant_not_found")
    storage = get_storage_client()
    download_url = generate_signed_download(storage, object_key)
    return SignedUrlResponse(download_url=download_url)


@router.get("/mine", response_model=MediaMinePage, operation_id="media_mine")
async def media_mine(
    cursor: str | None = None,
    type: str | None = None,
    page_size: int = 24,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> MediaMinePage:
    if not get_settings().enable_vault:
        raise AppError(status_code=404, detail="feature_disabled")
    if user.role != CREATOR_ROLE:
        raise AppError(status_code=403, detail="creator_only")
    q = select(MediaObject).where(MediaObject.owner_user_id == user.id)
    if type == "image":
        q = q.where(MediaObject.content_type.like("image/%"))
    elif type == "video":
        q = q.where(MediaObject.content_type.like("video/%"))
    elif type not in (None, ""):
        raise AppError(status_code=400, detail="invalid_type_filter")
    q = q.order_by(MediaObject.created_at.desc(), MediaObject.id.desc())
    if cursor:
        try:
            _, cursor_media_id_s = cursor.split("|", 1)
            cursor_media_id = UUID(cursor_media_id_s)
        except Exception as exc:
            raise AppError(status_code=400, detail="invalid_cursor") from exc
        cursor_row = (
            await session.execute(select(MediaObject).where(MediaObject.id == cursor_media_id))
        ).scalar_one_or_none()
        if cursor_row is None:
            raise AppError(status_code=400, detail="invalid_cursor")
        q = q.where(
            (MediaObject.created_at < cursor_row.created_at)
            | ((MediaObject.created_at == cursor_row.created_at) & (MediaObject.id < cursor_row.id))
        )
    rows = list((await session.execute(q.limit(page_size + 1))).scalars().all())
    next_cursor = None
    if len(rows) > page_size:
        rows = rows[:page_size]
        next_cursor = f"{rows[-1].created_at.isoformat()}|{rows[-1].id}"
    return MediaMinePage(
        items=[
            MediaMineItem(
                id=row.id,
                content_type=row.content_type,
                created_at=row.created_at,
            )
            for row in rows
        ],
        next_cursor=next_cursor,
    )


@router.delete(
    "/{media_id}",
    status_code=204,
    operation_id="media_delete",
    summary="Delete a media file",
    description="Permanently deletes a media file and its S3 objects. Fails if the file is used in a post, profile, or collection.",
)
async def delete_media_endpoint(
    media_id: str,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> None:
    try:
        media_uuid = UUID(media_id)
    except ValueError as exc:
        raise AppError(status_code=404, detail="media_not_found") from exc
    if user.role != CREATOR_ROLE:
        raise AppError(status_code=403, detail="creator_only")
    await delete_media(session, media_uuid, user.id)
    await log_audit_event(
        session,
        action=ACTION_MEDIA_DELETED,
        actor_id=user.id,
        resource_type="media",
        resource_id=media_id,
    )
