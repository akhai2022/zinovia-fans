from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class MediaCreate(BaseModel):
    object_key: str = Field(min_length=3, max_length=255)
    content_type: str
    size_bytes: int


class MediaOut(BaseModel):
    id: UUID
    object_key: str
    content_type: str
    size_bytes: int
    created_at: datetime
    updated_at: datetime


class SignedUrlResponse(BaseModel):
    upload_url: str | None = None
    download_url: str | None = None


class UploadUrlResponse(BaseModel):
    """Response for POST /media/upload-url: asset_id and signed PUT URL."""

    asset_id: UUID
    upload_url: str


class MediaMineItem(BaseModel):
    id: UUID
    content_type: str
    created_at: datetime


class MediaMinePage(BaseModel):
    items: list[MediaMineItem]
    next_cursor: str | None = None
