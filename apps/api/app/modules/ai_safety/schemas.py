from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class SafetyScanOut(BaseModel):
    """Safety scan result for a media asset."""
    id: UUID
    media_asset_id: UUID
    nsfw_score: float
    nsfw_label: str
    # Proxy signal from age-range classifier — NOT a definitive age determination
    age_range_prediction: str
    underage_likelihood_proxy: float
    risk_level: str
    decision: str
    model_versions: dict | None = None
    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None
    review_decision: str | None = None
    created_at: datetime


class CaptionOut(BaseModel):
    """Generated caption variants for a media asset."""
    id: UUID
    media_asset_id: UUID
    caption_short: str | None = None
    caption_medium: str | None = None
    caption_promo: str | None = None
    raw_caption: str | None = None
    model_version: str | None = None
    created_at: datetime


class TagsOut(BaseModel):
    """Generated tags for a media asset."""
    id: UUID
    media_asset_id: UUID
    tags: list[str] | None = None
    model_version: str | None = None
    created_at: datetime


class SearchResultItem(BaseModel):
    """A single search result."""
    media_asset_id: UUID
    tags: list[str] | None = None
    score: float | None = None  # relevance score (only for pgvector)


class SearchResponse(BaseModel):
    """Semantic/keyword search results."""
    items: list[SearchResultItem]
    mode: str  # "vector" or "keyword"
    total: int


class AdminReviewPayload(BaseModel):
    """Admin review decision for a flagged media asset."""
    decision: Literal["APPROVED", "REJECTED"]


class AdminReviewOut(BaseModel):
    """Response after admin review."""
    scan_id: UUID
    review_decision: str
    safety_status: str


class PendingReviewItem(BaseModel):
    """Item in the pending review list."""
    scan_id: UUID
    media_asset_id: UUID
    nsfw_score: float
    nsfw_label: str
    age_range_prediction: str
    underage_likelihood_proxy: float
    risk_level: str
    decision: str
    created_at: datetime
    owner_user_id: UUID | None = None


class PendingReviewPage(BaseModel):
    """Paginated list of pending reviews."""
    items: list[PendingReviewItem]
    total: int
    page: int
    page_size: int
