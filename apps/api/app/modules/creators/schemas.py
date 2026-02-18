from __future__ import annotations

from datetime import datetime
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
    followers_count: int
    posts_count: int = 0
    is_following: bool = False
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


class CreatorFollowedItem(BaseModel):
    """Creator summary in /me/following list."""

    user_id: UUID
    handle: str
    display_name: str
    avatar_media_id: UUID | None
    verified: bool = False
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
    followers_count: int
    posts_count: int


class CreatorDiscoverPage(BaseModel):
    """Paginated list of discoverable creators."""

    items: list[CreatorDiscoverItem]
    total: int
    page: int
    page_size: int
