"""Messaging router: DMs (conversations, messages, media download)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import Profile, User
from app.modules.creators.constants import CREATOR_ROLE
from app.modules.media.models import MediaObject
from app.modules.media.schemas import SignedUrlResponse
from app.modules.media.service import (
    generate_signed_download,
    resolve_download_object_key,
)
from app.modules.media.storage import get_storage_client
from app.modules.messaging.schemas import (
    ConversationCreate,
    ConversationListOut,
    ConversationOut,
    MessageCreate,
    MessageMediaOut,
    MessageOut,
    MessagePageOut,
)
from app.modules.messaging.service import (
    can_access_dm_media,
    create_message,
    get_dm_message_media_asset_id,
    get_messages_page,
    get_or_create_conversation,
    list_conversations,
)
from app.modules.messaging.constants import MESSAGE_TYPE_MEDIA, MESSAGE_TYPE_TEXT
from app.modules.messaging.models import Message, MessageMedia

router = APIRouter(prefix="/dm", tags=["messaging"])


async def _get_other_party(
    session: AsyncSession, conv, user_id: UUID
) -> dict:
    other_id = conv.fan_user_id if conv.creator_user_id == user_id else conv.creator_user_id
    result = await session.execute(
        select(Profile, User).join(User, User.id == Profile.user_id).where(User.id == other_id)
    )
    row = result.one_or_none()
    if not row:
        return {"handle": "", "display_name": "Unknown", "avatar_asset_id": None}
    profile, user = row
    return {
        "handle": profile.handle or "",
        "display_name": profile.display_name or user.email,
        "avatar_asset_id": str(profile.avatar_asset_id) if profile.avatar_asset_id else None,
    }


@router.post("/conversations", operation_id="dm_create_conversation")
async def create_conversation(
    payload: ConversationCreate,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
):
    conv = await get_or_create_conversation(
        session,
        creator_handle=payload.creator_handle,
        creator_id=payload.creator_id,
        fan_id=payload.fan_id,
        current_user_id=user.id,
        current_user_role=user.role,
    )
    return {"conversation_id": str(conv.id)}


@router.get("/conversations", response_model=ConversationListOut)
async def get_conversations(
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
):
    items_raw = await list_conversations(session, user.id)
    items = []
    for conv, preview, at in items_raw:
        other = await _get_other_party(session, conv, user.id)
        items.append(
            ConversationOut(
                id=conv.id,
                creator_user_id=conv.creator_user_id,
                fan_user_id=conv.fan_user_id,
                last_message_preview=preview,
                last_message_at=at,
                unread_count=0,  # TODO: implement unread tracking
                other_party=other,
            )
        )
    return ConversationListOut(items=items, total=len(items))


@router.get("/conversations/{conversation_id}/messages", response_model=MessagePageOut)
async def get_conversation_messages(
    conversation_id: UUID,
    cursor: str | None = Query(None),
    page_size: int = Query(50, ge=1, le=100),
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
):
    messages, next_cursor = await get_messages_page(
        session, conversation_id, user.id, cursor=cursor, page_size=page_size
    )
    # For each message with media, check if user has unlocked each locked media
    out_items = []
    for msg in messages:
        media_out = []
        for mm in msg.media:
            unlocked = await can_access_dm_media(session, msg.id, mm.id, user.id)
            media_out.append(
                MessageMediaOut(
                    id=mm.id,
                    media_asset_id=mm.media_asset_id,
                    is_locked=mm.is_locked,
                    price_cents=mm.price_cents,
                    currency=mm.currency,
                    unlocked=unlocked,
                    viewer_has_unlocked=unlocked,
                )
            )
        out_items.append(
            MessageOut(
                id=msg.id,
                conversation_id=msg.conversation_id,
                sender_id=msg.sender_id,
                sender_role=msg.sender_role,
                message_type=msg.message_type,
                text=msg.text,
                media=media_out,
                created_at=msg.created_at,
            )
        )
    return MessagePageOut(items=out_items, next_cursor=next_cursor)


@router.post("/conversations/{conversation_id}/messages", response_model=MessageOut)
async def post_message(
    conversation_id: UUID,
    payload: MessageCreate,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
):
    lock_cents = None
    lock_currency = "usd"
    if payload.lock:
        lock_cents = payload.lock.price_cents
        lock_currency = payload.lock.currency
    msg = await create_message(
        session,
        conversation_id=conversation_id,
        user_id=user.id,
        user_role=user.role,
        type=payload.type,
        text=payload.text,
        media_ids=payload.media_ids,
        lock_price_cents=lock_cents,
        lock_currency=lock_currency,
    )
    media_out = []
    for mm in msg.media:
        unlocked = await can_access_dm_media(session, msg.id, mm.id, user.id)
        media_out.append(
            MessageMediaOut(
                id=mm.id,
                media_asset_id=mm.media_asset_id,
                is_locked=mm.is_locked,
                price_cents=mm.price_cents,
                currency=mm.currency,
                unlocked=unlocked,
                viewer_has_unlocked=unlocked,
            )
        )
    return MessageOut(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        sender_role=msg.sender_role,
        message_type=msg.message_type,
        text=msg.text,
        media=media_out,
        created_at=msg.created_at,
    )


@router.get(
    "/messages/{message_id}/media/{media_id}/download-url",
    response_model=SignedUrlResponse,
    operation_id="dm_media_download_url",
)
async def get_dm_media_download_url(
    message_id: UUID,
    media_id: UUID,
    variant: str | None = None,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
):
    allowed = await can_access_dm_media(session, message_id, media_id, user.id)
    if not allowed:
        raise AppError(status_code=403, detail="media_not_accessible")
    result = await session.execute(select(MediaObject).where(MediaObject.id == media_id))
    media = result.scalar_one_or_none()
    if not media:
        raise AppError(status_code=404, detail="media_not_found")
    object_key = await resolve_download_object_key(
        session, media_id, media.object_key, variant
    )
    if object_key is None:
        raise AppError(status_code=404, detail="variant_not_found")
    storage = get_storage_client()
    download_url = generate_signed_download(storage, object_key)
    return SignedUrlResponse(download_url=download_url)


@router.get(
    "/message-media/{message_media_id}/download-url",
    response_model=SignedUrlResponse,
    operation_id="dm_message_media_download_url",
)
async def get_dm_message_media_download_url(
    message_media_id: UUID,
    variant: str | None = None,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
):
    media_asset_id = await get_dm_message_media_asset_id(session, message_media_id)
    if not media_asset_id:
        raise AppError(status_code=404, detail="media_not_found")
    allowed = await can_access_dm_media(
        session,
        message_id=None,
        message_media_id=message_media_id,
        user_id=user.id,
    )
    if not allowed:
        raise AppError(status_code=403, detail="media_not_accessible")
    result = await session.execute(select(MediaObject).where(MediaObject.id == media_asset_id))
    media = result.scalar_one_or_none()
    if not media:
        raise AppError(status_code=404, detail="media_not_found")
    object_key = await resolve_download_object_key(
        session, media_asset_id, media.object_key, variant
    )
    if object_key is None:
        raise AppError(status_code=404, detail="variant_not_found")
    storage = get_storage_client()
    download_url = generate_signed_download(storage, object_key)
    return SignedUrlResponse(download_url=download_url)
