from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CollectionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    cover_asset_id: UUID | None = None
    visibility: str = Field(default="PUBLIC", pattern="^(PUBLIC|FOLLOWERS|SUBSCRIBERS)$")


class CollectionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    cover_asset_id: UUID | None = None
    visibility: str | None = Field(default=None, pattern="^(PUBLIC|FOLLOWERS|SUBSCRIBERS)$")
    position: int | None = None


class CollectionOut(BaseModel):
    id: UUID
    creator_user_id: UUID
    title: str
    description: str | None
    cover_asset_id: UUID | None
    visibility: str
    position: int
    post_count: int = 0
    created_at: datetime
    updated_at: datetime


class CollectionPage(BaseModel):
    items: list[CollectionOut]
    total: int


class CollectionPostAdd(BaseModel):
    post_id: UUID
    position: int = 0


class CollectionPostOut(BaseModel):
    id: UUID
    collection_id: UUID
    post_id: UUID
    position: int
