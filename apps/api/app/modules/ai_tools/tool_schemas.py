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


class CartoonizeStatusOut(BaseModel):
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
