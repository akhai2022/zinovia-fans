from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.posts.constants import (
    POST_TYPE_IMAGE,
    POST_TYPE_TEXT,
    POST_TYPE_VIDEO,
    VISIBILITY_FOLLOWERS,
    VISIBILITY_PUBLIC,
    VISIBILITY_SUBSCRIBERS,
)


class CreatorSummary(BaseModel):
    """Minimal creator info for feed/post context."""

    user_id: UUID
    handle: str
    display_name: str
    avatar_asset_id: UUID | None


class PostMediaItem(BaseModel):
    """Single media attachment (asset_id for client to call /media/{id}/download)."""

    media_object_id: UUID
    position: int


class PostCreate(BaseModel):
    """Create post body."""

    model_config = {"populate_by_name": True}

    type: str = Field(..., pattern=f"^({POST_TYPE_TEXT}|{POST_TYPE_IMAGE}|{POST_TYPE_VIDEO})$")
    caption: str | None = None
    visibility: str = Field(
        ...,
        pattern=f"^({VISIBILITY_PUBLIC}|{VISIBILITY_FOLLOWERS}|{VISIBILITY_SUBSCRIBERS})$",
    )
    nsfw: bool = False
    asset_ids: list[UUID] = Field(default_factory=list)


class PostOut(BaseModel):
    """Post as returned by API (asset_ids only; client uses download endpoint)."""

    id: UUID
    creator_user_id: UUID
    type: str
    caption: str | None
    visibility: str
    nsfw: bool
    created_at: datetime
    updated_at: datetime
    asset_ids: list[UUID] = Field(default_factory=list)
    is_locked: bool = Field(default=False, description="True when viewer cannot access content (teaser only).")
    locked_reason: str | None = Field(
        default=None,
        description="When is_locked: SUBSCRIPTION_REQUIRED or FOLLOW_REQUIRED for UI copy.",
    )


class PostWithCreator(BaseModel):
    """Post with creator summary (e.g. feed)."""

    id: UUID
    creator_user_id: UUID
    type: str
    caption: str | None
    visibility: str
    nsfw: bool
    created_at: datetime
    updated_at: datetime
    asset_ids: list[UUID] = Field(default_factory=list)
    creator: CreatorSummary


class PostPage(BaseModel):
    """Paginated list of posts."""

    items: list[PostOut]
    total: int
    page: int
    page_size: int


class FeedPage(BaseModel):
    """Paginated feed with creator summary."""

    items: list[PostWithCreator]
    total: int
    page: int
    page_size: int
