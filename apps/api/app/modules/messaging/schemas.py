"""Messaging schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ConversationCreate(BaseModel):
    creator_handle: str | None = None
    creator_id: UUID | None = None
    fan_id: UUID | None = None  # When creator initiates


class ConversationOut(BaseModel):
    id: UUID
    creator_user_id: UUID
    fan_user_id: UUID
    last_message_preview: str | None = None
    last_message_at: datetime | None = None
    unread_count: int = 0
    other_party: dict  # handle, display_name, avatar_asset_id


class ConversationListOut(BaseModel):
    items: list[ConversationOut]
    total: int


class MessageMediaOut(BaseModel):
    id: UUID
    media_asset_id: UUID
    is_locked: bool
    price_cents: int | None = None
    currency: str = "usd"
    unlocked: bool = False  # Backward-compatible alias of viewer_has_unlocked
    viewer_has_unlocked: bool = False


class MessageOut(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    sender_role: str
    message_type: str
    text: str | None = None
    media: list[MessageMediaOut] = Field(default_factory=list)
    created_at: datetime


class MessagePageOut(BaseModel):
    items: list[MessageOut]
    next_cursor: str | None = None


class MessageCreateText(BaseModel):
    type: str = "TEXT"
    text: str = Field(..., max_length=2000)


class MessageCreateMediaLock(BaseModel):
    price_cents: int = Field(..., ge=1)
    currency: str = "usd"


class MessageCreate(BaseModel):
    """TEXT: type=TEXT, text required. MEDIA: type=MEDIA, media_ids required; lock optional (creator only)."""

    type: str = Field(..., pattern="^(TEXT|MEDIA)$")
    text: str | None = Field(None, max_length=2000)
    media_ids: list[UUID] | None = Field(None, min_length=1, max_length=10)
    lock: MessageCreateMediaLock | None = None
