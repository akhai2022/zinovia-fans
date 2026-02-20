from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.creators.constants import HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH


class CreatorProfilePublic(BaseModel):
    """Public view of a creator profile with aggregated counts."""

    user_id: UUID
    handle: str
    display_name: str
    bio: str | None
    avatar_media_id: UUID | None
    banner_media_id: UUID | None
    discoverable: bool
    nsfw: bool
    verified: bool = False
    is_online: bool = False
    followers_count: int
    posts_count: int = 0
    is_following: bool = False
    is_subscriber: bool = False
    subscription_price: Decimal | None = Field(
        None, description="Monthly subscription price in major currency units (e.g. 4.99)"
    )
    subscription_currency: str | None = Field(
        None, description="ISO 4217 currency code (e.g. eur)"
    )
    phone: str | None = None
    country: str | None = None
    onboarding_state: str | None = None
    created_at: datetime
    updated_at: datetime


class CreatorProfileUpdate(BaseModel):
    """Fields a creator can update on their profile."""

    handle: str | None = Field(None, min_length=HANDLE_MIN_LENGTH, max_length=HANDLE_MAX_LENGTH)
    display_name: str | None = Field(None, min_length=1, max_length=120)
    bio: str | None = None
    discoverable: bool | None = None
    nsfw: bool | None = None
    avatar_media_id: UUID | None = None
    banner_media_id: UUID | None = None
    phone: str | None = Field(None, min_length=6, max_length=20, description="Phone number with country code (e.g. +33612345678)")
    country: str | None = Field(None, min_length=2, max_length=2, description="ISO 3166-1 alpha-2 country code (e.g. FR, US)")


class CreatorFollowedItem(BaseModel):
    """Creator summary in /me/following list."""

    user_id: UUID
    handle: str
    display_name: str
    avatar_media_id: UUID | None
    verified: bool = False
    is_online: bool = False
    created_at: datetime


class CreatorFollowingPage(BaseModel):
    """Paginated list of creators the current user follows."""

    items: list[CreatorFollowedItem]
    total: int
    page: int
    page_size: int


class CreatorDiscoverItem(BaseModel):
    """Creator summary for discover/browse list."""

    creator_id: UUID
    handle: str
    display_name: str
    avatar_media_id: UUID | None
    verified: bool = False
    is_online: bool = False
    followers_count: int
    posts_count: int


class CreatorDiscoverPage(BaseModel):
    """Paginated list of discoverable creators."""

    items: list[CreatorDiscoverItem]
    total: int
    page: int
    page_size: int
