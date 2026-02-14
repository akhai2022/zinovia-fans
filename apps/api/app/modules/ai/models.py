"""AI image job and brand asset models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin


class AiImageJob(TimestampMixin, Base):
    __tablename__ = "ai_image_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="QUEUED")
    image_type: Mapped[str] = mapped_column(String(32), nullable=False)
    preset: Mapped[str | None] = mapped_column(String(64), nullable=True)
    subject: Mapped[str | None] = mapped_column(String(256), nullable=True)
    vibe: Mapped[str | None] = mapped_column(String(64), nullable=True)
    accent_color: Mapped[str | None] = mapped_column(String(32), nullable=True)
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    negative_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_object_keys: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)


class BrandAsset(Base):
    __tablename__ = "brand_assets"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value_object_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    updated_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
