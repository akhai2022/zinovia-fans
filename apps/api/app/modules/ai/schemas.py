"""AI image schemas."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class AiImageGenerateIn(BaseModel):
    """Request body for POST /ai/images/generate."""

    image_type: str = Field(..., pattern="^(HERO|AVATAR|BANNER)$")
    preset: str = Field(..., min_length=1, max_length=64)
    subject: str | None = Field(None, max_length=256)
    vibe: str | None = Field(None, max_length=64)
    accent_color: str | None = Field(None, max_length=32)
    count: int = Field(1, ge=1, le=4)


class AiImageGenerateOut(BaseModel):
    job_id: UUID


class AiImageJobOut(BaseModel):
    id: UUID
    status: str
    image_type: str
    prompt_preview: str | None = None
    result_urls: list[str] = Field(default_factory=list)


class AiImageApplyIn(BaseModel):
    """Request body for POST /ai/images/{job_id}/apply."""

    apply_to: str = Field(
        ...,
        pattern="^(landing\\.hero|creator\\.avatar|creator\\.banner)$",
    )
    result_index: int = Field(0, ge=0, le=15)


class AiImageApplyOut(BaseModel):
    applied_to: str
    object_key: str
    public_url: str


class BrandAssetsOut(BaseModel):
    """Public endpoint: mapping of asset key to presigned URL."""

    landing_hero: str | None = None
