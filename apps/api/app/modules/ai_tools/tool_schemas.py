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

# ---------------------------------------------------------------------------
# Motion Transfer / Character Replace
# ---------------------------------------------------------------------------

class MotionTransferRequest(BaseModel):
    source_video_asset_id: UUID
    target_asset_id: UUID  # image or video
    mode: str = "animate"  # "animate" | "replace"
    garment_asset_id: UUID | None = None
    preserve_background: bool = False
    preserve_audio: bool = True
    retarget_pose: bool = False
    use_relighting_lora: bool = False
    output_resolution: str = "720"  # 512 | 720 | 1024
    output_fps: int = 24  # 12 | 24 | 30
    seed: int | None = None
    consent_acknowledged: bool = False


class MotionTransferResponse(BaseModel):
    job_id: UUID
    status: str


class MotionTransferStatusOut(BaseModel):
    job_id: UUID
    status: str  # pending | preprocessing | generating | postprocessing | ready | failed
    stage: str | None = None
    progress: float | None = None  # 0.0-1.0
    result_url: str | None = None
    preview_url: str | None = None
    error: str | None = None
    settings: dict | None = None


class MotionTransferUsageOut(BaseModel):
    limit: int
    used: int
    remaining: int
    unlimited: bool = False


class ImageRefCreateRequest(BaseModel):
    media_asset_id: UUID


class ImageRefCreateResponse(BaseModel):
    token: str
    expires_at: datetime


class ImageRefResolveResponse(BaseModel):
    media_asset_id: str
    download_url: str
