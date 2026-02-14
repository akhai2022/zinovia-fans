"""Payments schemas: tips, PPV."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class TipCreateIntent(BaseModel):
    creator_id: UUID
    amount_cents: int = Field(..., ge=100)
    currency: str = "usd"
    conversation_id: UUID | None = None
    message_id: UUID | None = None


class TipIntentOut(BaseModel):
    client_secret: str
    tip_id: UUID


class PpvCreateIntent(BaseModel):
    message_media_id: UUID


class PpvIntentOut(BaseModel):
    client_secret: str
    purchase_id: UUID
