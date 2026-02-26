"""Messaging service: conversations, messages, media access."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.core.settings import get_settings
from app.modules.auth.constants import ADMIN_ROLE, SUPER_ADMIN_ROLE
from app.modules.billing.service import is_active_subscriber
from app.modules.creators.constants import CREATOR_ROLE
from app.modules.creators.service import get_creator_by_handle_any
from app.modules.messaging.constants import (
    MESSAGE_TYPE_MEDIA,
    MESSAGE_TYPE_TEXT,
    SENDER_ROLE_CREATOR,
    SENDER_ROLE_FAN,
)
from app.modules.messaging.models import Conversation, Message, MessageMedia
from app.modules.media.models import MediaObject
from app.modules.payments.models import PpvPurchase

logger = logging.getLogger(__name__)


async def get_or_create_conversation(
    session: AsyncSession,
    *,
    creator_handle: str | None = None,
    creator_id: UUID | None = None,
    fan_id: UUID | None = None,
    current_user_id: UUID,
    current_user_role: str,
) -> Conversation:
    """Get or create conversation. Fan initiates with creator_handle/creator_id; creator with fan_id."""
    if creator_handle:
        user, profile, _, _ = await get_creator_by_handle_any(
            session, creator_handle
        )
        creator_id = user.id
    if not creator_id:
        raise AppError(status_code=400, detail="creator_handle_or_creator_id_required")

    if current_user_role in (CREATOR_ROLE, ADMIN_ROLE, SUPER_ADMIN_ROLE):
        if not fan_id:
            raise AppError(status_code=400, detail="fan_id_required_when_creator_initiates")
        creator_user_id = current_user_id
        fan_user_id = fan_id
        if fan_user_id == creator_user_id:
            raise AppError(status_code=400, detail="cannot_message_self")
    else:
        creator_user_id = creator_id
        fan_user_id = current_user_id
        if creator_user_id == fan_user_id:
            raise AppError(status_code=400, detail="cannot_message_self")

    # Fans must have an active subscription to message a creator
    if fan_user_id == current_user_id:
        if not await is_active_subscriber(session, fan_user_id, creator_user_id):
            raise AppError(status_code=403, detail="subscription_required")

    result = await session.execute(
        select(Conversation).where(
            and_(
                Conversation.creator_user_id == creator_user_id,
                Conversation.fan_user_id == fan_user_id,
            )
        )
    )
    conv = result.scalar_one_or_none()
    if conv:
        return conv
    conv = Conversation(
        creator_user_id=creator_user_id,
        fan_user_id=fan_user_id,
    )
    session.add(conv)
    try:
        await session.commit()
        await session.refresh(conv)
        return conv
    except IntegrityError:
        await session.rollback()
        result = await session.execute(
            select(Conversation).where(
                and_(
                    Conversation.creator_user_id == creator_user_id,
                    Conversation.fan_user_id == fan_user_id,
                )
            )
        )
        conv = result.scalar_one_or_none()
        if not conv:
            raise AppError(status_code=500, detail="internal_server_error")
        return conv


async def _is_participant(
    session: AsyncSession, conversation_id: UUID, user_id: UUID
) -> bool:
    result = await session.execute(
        select(Conversation.id).where(
            Conversation.id == conversation_id,
            or_(
                Conversation.creator_user_id == user_id,
                Conversation.fan_user_id == user_id,
            ),
        )
    )
    return result.scalar_one_or_none() is not None


async def list_conversations(
    session: AsyncSession, user_id: UUID
) -> list[tuple[Conversation, str | None, datetime | None]]:
    """List conversations for user with last message preview and timestamp."""
    result = await session.execute(
        select(Conversation)
        .where(
            or_(
                Conversation.creator_user_id == user_id,
                Conversation.fan_user_id == user_id,
            )
        )
        .order_by(desc(Conversation.updated_at))
    )
    convs = list(result.scalars().unique().all())
    out = []
    for conv in convs:
        last_msg_result = await session.execute(
            select(Message.text, Message.created_at)
            .where(Message.conversation_id == conv.id)
            .order_by(desc(Message.created_at))
            .limit(1)
        )
        row = last_msg_result.one_or_none()
        preview = None
        at = None
        if row:
            preview = (row[0] or "[Media]")[:100] if row[0] else "[Media]"
            at = row[1]
        out.append((conv, preview, at))
    return out


async def get_messages_page(
    session: AsyncSession,
    conversation_id: UUID,
    user_id: UUID,
    *,
    cursor: str | None = None,
    page_size: int = 50,
) -> tuple[list[Message], str | None]:
    """Paginated messages. cursor is message id (uuid) for next page."""
    if not await _is_participant(session, conversation_id, user_id):
        raise AppError(status_code=403, detail="not_participant")

    q = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(desc(Message.created_at))
    )
    if cursor:
        try:
            cursor_uuid = UUID(cursor)
        except ValueError:
            raise AppError(status_code=400, detail="invalid_cursor")
        cursor_msg = await session.get(Message, cursor_uuid)
        if not cursor_msg or cursor_msg.conversation_id != conversation_id:
            raise AppError(status_code=400, detail="invalid_cursor")
        q = q.where(Message.created_at < cursor_msg.created_at)
    q = q.limit(page_size + 1)
    result = await session.execute(q.options(selectinload(Message.media)))
    messages = list(result.scalars().unique().all())
    next_cursor = None
    if len(messages) > page_size:
        messages = messages[:page_size]
        next_cursor = str(messages[-1].id)
    messages.reverse()  # chronological for display
    return messages, next_cursor


async def create_message(
    session: AsyncSession,
    conversation_id: UUID,
    user_id: UUID,
    user_role: str,
    *,
    type: str,
    text: str | None = None,
    media_ids: list[UUID] | None = None,
    lock_price_cents: int | None = None,
    lock_currency: str = "usd",
) -> Message:
    """Create a message. Rate limited. Creator-only can lock media."""
    settings = get_settings()
    await _check_message_rate_limit(session, user_id, settings.rate_limit_messages_per_min)

    if not await _is_participant(session, conversation_id, user_id):
        raise AppError(status_code=403, detail="not_participant")

    result = await session.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise AppError(status_code=404, detail="conversation_not_found")

    sender_role = SENDER_ROLE_CREATOR if user_role in (CREATOR_ROLE, ADMIN_ROLE, SUPER_ADMIN_ROLE) else SENDER_ROLE_FAN

    # Fans must have an active subscription to send messages
    if sender_role == SENDER_ROLE_FAN:
        if not await is_active_subscriber(session, conv.fan_user_id, conv.creator_user_id):
            raise AppError(status_code=403, detail="subscription_required")

    if type == MESSAGE_TYPE_TEXT:
        if not text or not text.strip():
            raise AppError(status_code=400, detail="text_required_for_text_message")
        if len(text) > settings.message_max_length:
            raise AppError(status_code=400, detail="text_too_long")
        msg = Message(
            conversation_id=conversation_id,
            sender_id=user_id,
            sender_role=sender_role,
            message_type=MESSAGE_TYPE_TEXT,
            text=text.strip(),
        )
        session.add(msg)
        await session.flush()
    elif type == MESSAGE_TYPE_MEDIA:
        if not media_ids:
            raise AppError(status_code=400, detail="media_ids_required_for_media_message")
        if lock_price_cents is not None and lock_price_cents > 0:
            if not settings.enable_ppvm:
                raise AppError(status_code=503, detail="ppv_disabled")
            if sender_role != SENDER_ROLE_CREATOR or conv.creator_user_id != user_id:
                raise AppError(status_code=403, detail="ppv_creator_only")
            if lock_price_cents < settings.min_ppv_cents or lock_price_cents > settings.max_ppv_cents:
                raise AppError(status_code=400, detail="ppv_price_invalid")
            if lock_currency.lower() != settings.default_currency.lower():
                raise AppError(status_code=400, detail="ppv_price_invalid")
        for mid in media_ids:
            media_row = await session.execute(
                select(MediaObject).where(
                    MediaObject.id == mid,
                    MediaObject.owner_user_id == user_id,
                )
            )
            if not media_row.scalar_one_or_none():
                raise AppError(status_code=400, detail=f"media_not_found_or_not_owner:{mid}")

        msg = Message(
            conversation_id=conversation_id,
            sender_id=user_id,
            sender_role=sender_role,
            message_type=MESSAGE_TYPE_MEDIA,
            text=None,
        )
        session.add(msg)
        await session.flush()
        for mid in media_ids:
            mm = MessageMedia(
                message_id=msg.id,
                media_asset_id=mid,
                is_locked=lock_price_cents is not None and lock_price_cents > 0,
                price_cents=lock_price_cents,
                currency=lock_currency,
            )
            session.add(mm)
    else:
        raise AppError(status_code=400, detail="invalid_message_type")

    conv.updated_at = datetime.now(timezone.utc)
    await session.commit()
    loaded = (
        await session.execute(
            select(Message)
            .where(Message.id == msg.id)
            .options(selectinload(Message.media))
        )
    ).scalar_one()
    return loaded


async def _check_message_rate_limit(
    session: AsyncSession,
    user_id: UUID,
    per_minute_limit: int,
) -> None:
    """DB-backed per-user DM send limit to avoid Redis dependency."""
    if per_minute_limit <= 0:
        return
    since = datetime.now(timezone.utc) - timedelta(minutes=1)
    sent_count = (
        await session.execute(
            select(func.count(Message.id)).where(
                Message.sender_id == user_id,
                Message.created_at >= since,
            )
        )
    ).scalar_one() or 0
    if sent_count >= per_minute_limit:
        raise AppError(status_code=429, detail="rate_limit_exceeded")


async def can_access_dm_media(
    session: AsyncSession,
    message_id: UUID | None,
    message_media_id: UUID,
    user_id: UUID,
) -> bool:
    """True if user can download this message media (participant + unlocked or purchased)."""
    result = await session.execute(
        select(MessageMedia, Message)
        .join(Message, Message.id == MessageMedia.message_id)
        .where(MessageMedia.id == message_media_id)
    )
    row = result.one_or_none()
    if not row:
        return False
    mm, msg = row
    if message_id is not None and msg.id != message_id:
        return False
    if not await _is_participant(session, msg.conversation_id, user_id):
        return False
    if not mm.is_locked:
        return True
    conv = (
        await session.execute(select(Conversation).where(Conversation.id == msg.conversation_id))
    ).scalar_one_or_none()
    if conv and user_id == conv.creator_user_id:
        return True
    purchase_result = await session.execute(
        select(PpvPurchase.id).where(
            PpvPurchase.message_media_id == message_media_id,
            PpvPurchase.purchaser_id == user_id,
            PpvPurchase.status == "SUCCEEDED",
        )
    )
    return purchase_result.scalar_one_or_none() is not None


async def get_dm_message_media_asset_id(
    session: AsyncSession, message_media_id: UUID
) -> UUID | None:
    row = (
        await session.execute(
            select(MessageMedia.media_asset_id).where(MessageMedia.id == message_media_id)
        )
    ).scalar_one_or_none()
    return row
