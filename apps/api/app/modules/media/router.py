from __future__ import annotations

from fastapi import APIRouter, Depends
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user, get_optional_user
from app.modules.media.models import MediaObject
from app.modules.media.schemas import MediaCreate, SignedUrlResponse, UploadUrlResponse
from app.modules.media.service import (
    can_anonymous_access_media,
    can_user_access_media,
    create_media_object,
    generate_signed_download,
    generate_signed_upload,
    resolve_download_object_key,
    validate_media_upload,
)
from app.modules.media.storage import get_storage_client
from app.modules.auth.models import User

router = APIRouter()


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
    return UploadUrlResponse(asset_id=media.id, upload_url=upload_url)


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
        allowed = await can_user_access_media(session, media_uuid, user.id)
    else:
        allowed = await can_anonymous_access_media(session, media_uuid)
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
