"""Pydantic schemas for AI tool endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Remove Background
# ---------------------------------------------------------------------------

class RemoveBgRequest(BaseModel):
    media_asset_id: UUID


class RemoveBgResponse(BaseModel):
    job_id: UUID
    status: str


class RemoveBgStatusOut(BaseModel):
    job_id: UUID
    status: str
    result_url: str | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# Cartoon Avatar (follow-up PR)
# ---------------------------------------------------------------------------

class CartoonizeRequest(BaseModel):
    media_asset_id: UUID


class CartoonizeResponse(BaseModel):
    job_id: UUID
    status: str


class CartoonizeStatusOut(BaseModel):
    job_id: UUID
    status: str
    result_url: str | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# Animate Image
# ---------------------------------------------------------------------------

class AnimateImageRequest(BaseModel):
    media_asset_id: UUID
    motion_preset: str = "gentle"  # gentle | dynamic | zoom
    num_frames: int = 15  # 7-25
    fps: int = 7  # 4 | 7 | 12
    output_format: str = "mp4"  # mp4 | gif


class AnimateImageResponse(BaseModel):
    job_id: UUID
    status: str


class AnimateImageStatusOut(BaseModel):
    job_id: UUID
    status: str
    result_url: str | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# Auto Caption
# ---------------------------------------------------------------------------

class AutoCaptionRequest(BaseModel):
    media_asset_id: UUID
    mode: str = "short"  # short | detailed | alt_text
    tone: str = "neutral"  # neutral | playful | flirty | professional
    quality: str = "fast"  # fast | better
    include_keywords: bool = True
    language: str = "en"  # en | fr


class AutoCaptionResponse(BaseModel):
    job_id: UUID
    status: str


class AutoCaptionStatusOut(BaseModel):
    job_id: UUID
    status: str
    result: dict | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# Virtual Try-On
# ---------------------------------------------------------------------------

class VirtualTryOnRequest(BaseModel):
    person_media_asset_id: UUID
    garment_media_asset_id: UUID
    category: str = "upper_body"  # upper_body | lower_body | full_body


class VirtualTryOnResponse(BaseModel):
    job_id: UUID
    status: str


class VirtualTryOnStatusOut(BaseModel):
    job_id: UUID
    status: str
    result_url: str | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# Image Ref (deep-link tokens)
# ---------------------------------------------------------------------------

class ImageRefCreateRequest(BaseModel):
    media_asset_id: UUID


class ImageRefCreateResponse(BaseModel):
    token: str
    expires_at: datetime


class ImageRefResolveResponse(BaseModel):
    media_asset_id: str
    download_url: str
