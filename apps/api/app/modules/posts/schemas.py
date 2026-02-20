from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.posts.constants import (
    POST_STATUS_DRAFT,
    POST_STATUS_PUBLISHED,
    POST_STATUS_SCHEDULED,
    POST_TYPE_IMAGE,
    POST_TYPE_TEXT,
    POST_TYPE_VIDEO,
    VISIBILITY_FOLLOWERS,
    VISIBILITY_PPV,
    VISIBILITY_PUBLIC,
    VISIBILITY_SUBSCRIBERS,
)


class CreatorSummary(BaseModel):
    """Minimal creator info for feed/post context."""

    user_id: UUID
    handle: str
    display_name: str
    avatar_asset_id: UUID | None
    verified: bool = False


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
        pattern=f"^({VISIBILITY_PUBLIC}|{VISIBILITY_FOLLOWERS}|{VISIBILITY_SUBSCRIBERS}|{VISIBILITY_PPV})$",
    )
    nsfw: bool = False
    asset_ids: list[UUID] = Field(default_factory=list)
    publish_at: datetime | None = None
    price_cents: int | None = Field(default=None, description="Required when visibility=PPV. Price in cents.")
    currency: str | None = Field(default=None, description="Currency code (defaults to platform default).")


class PostUpdate(BaseModel):
    """Update post body (partial)."""

    caption: str | None = None
    visibility: str | None = Field(
        default=None,
        pattern=f"^({VISIBILITY_PUBLIC}|{VISIBILITY_FOLLOWERS}|{VISIBILITY_SUBSCRIBERS}|{VISIBILITY_PPV})$",
    )
    price_cents: int | None = Field(default=None, description="Required when visibility=PPV.")


class MediaPreview(BaseModel):
    """Compact placeholder data for an asset (blurhash + dominant color)."""

    blurhash: str | None = None
    dominant_color: str | None = None


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
    media_previews: dict[str, MediaPreview] = Field(
        default_factory=dict,
        description="Map of asset_id → {blurhash, dominant_color} for instant placeholders.",
    )
    publish_at: datetime | None = None
    status: str = Field(
        default=POST_STATUS_PUBLISHED,
        pattern=f"^({POST_STATUS_DRAFT}|{POST_STATUS_SCHEDULED}|{POST_STATUS_PUBLISHED})$",
    )
    is_locked: bool = Field(default=False, description="True when viewer cannot access content (teaser only).")
    locked_reason: str | None = Field(
        default=None,
        description="When is_locked: SUBSCRIPTION_REQUIRED, FOLLOW_REQUIRED, or PPV_REQUIRED.",
    )
    price_cents: int | None = Field(default=None, description="PPV price in cents (set when visibility=PPV).")
    currency: str | None = Field(default=None, description="Currency code for PPV price.")


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
    media_previews: dict[str, MediaPreview] = Field(
        default_factory=dict,
        description="Map of asset_id → {blurhash, dominant_color} for instant placeholders.",
    )
    publish_at: datetime | None = None
    status: str = Field(
        default=POST_STATUS_PUBLISHED,
        pattern=f"^({POST_STATUS_DRAFT}|{POST_STATUS_SCHEDULED}|{POST_STATUS_PUBLISHED})$",
    )
    is_locked: bool = Field(default=False, description="True when viewer cannot access content (teaser only).")
    locked_reason: str | None = Field(
        default=None,
        description="When is_locked: SUBSCRIPTION_REQUIRED, FOLLOW_REQUIRED, or PPV_REQUIRED.",
    )
    price_cents: int | None = Field(default=None, description="PPV price in cents (set when visibility=PPV).")
    currency: str | None = Field(default=None, description="Currency code for PPV price.")
    creator: CreatorSummary


class PostPage(BaseModel):
    """Paginated list of posts."""

    items: list[PostOut]
    total: int
    page: int
    page_size: int


class FeedPage(BaseModel):
    """Paginated feed with creator summary. Supports cursor-based pagination."""

    items: list[PostWithCreator]
    total: int
    page: int
    page_size: int
    next_cursor: str | None = Field(
        default=None,
        description="Opaque cursor for the next page. Pass as ?cursor= for infinite scroll.",
    )


class PostLikeSummary(BaseModel):
    post_id: UUID
    count: int
    viewer_liked: bool


class PostCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=1000)


class PostCommentOut(BaseModel):
    id: UUID
    post_id: UUID
    user_id: UUID
    body: str
    created_at: datetime
class PostCommentPageOut(BaseModel):
    items: list[PostCommentOut]
    next_cursor: str | None = None
    total: int = 0


class PostSearchResult(BaseModel):
    """Search result with creator info."""

    id: UUID
    creator_user_id: UUID
    type: str
    caption: str | None
    visibility: str
    nsfw: bool
    created_at: datetime
    updated_at: datetime
    asset_ids: list[UUID] = Field(default_factory=list)
    creator: CreatorSummary | None = None


class PostSearchPage(BaseModel):
    items: list[PostSearchResult]
    total: int
    page: int
    page_size: int
