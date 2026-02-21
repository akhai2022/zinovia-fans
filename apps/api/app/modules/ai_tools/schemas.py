from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Promo generator
# ---------------------------------------------------------------------------

class PromoGenerateRequest(BaseModel):
    post_id: UUID
    tone: str = Field(default="professional", pattern="^(professional|playful|teasing)$")


class PromoSuggestionOut(BaseModel):
    id: UUID
    post_id: UUID
    tone: str
    title: str
    description: str
    cta_lines: list[str]
    hashtags: list[str]
    source_caption: str | None = None
    created_at: datetime


class PromoListOut(BaseModel):
    items: list[PromoSuggestionOut]
