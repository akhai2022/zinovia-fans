from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class PostPromoSuggestion(Base):
    """Template-generated promotional copy for a post (one row per tone)."""

    __tablename__ = "post_promo_suggestions"
    __table_args__ = (
        UniqueConstraint("post_id", "tone", name="uq_promo_post_tone"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False,
    )
    tone: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(Text(), nullable=False)
    description: Mapped[str] = mapped_column(Text(), nullable=False)
    cta_lines: Mapped[dict] = mapped_column(JSONB, nullable=False)
    hashtags: Mapped[dict] = mapped_column(JSONB, nullable=False)
    source_caption: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
