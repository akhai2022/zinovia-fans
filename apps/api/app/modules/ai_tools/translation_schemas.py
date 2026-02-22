from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

SUPPORTED_LANGUAGES = frozenset({"fr", "es", "ar"})


class TranslateRequest(BaseModel):
    post_id: UUID
    target_languages: list[str] = Field(min_length=1, max_length=5)


class TranslationOut(BaseModel):
    id: UUID
    post_id: UUID
    source_language: str
    target_language: str
    translated_text: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime


class TranslationListOut(BaseModel):
    items: list[TranslationOut]
