from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ImageSafetyScan(Base):
    __tablename__ = "image_safety_scans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    media_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("media_assets.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    nsfw_score: Mapped[float] = mapped_column(Float, nullable=False)
    nsfw_label: Mapped[str] = mapped_column(String(32), nullable=False)
    # Proxy signal from vit-age-classifier — NOT a definitive age determination.
    # Requires human review for any enforcement decisions.
    age_range_prediction: Mapped[str] = mapped_column(String(32), nullable=False)
    underage_likelihood_proxy: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False)
    decision: Mapped[str] = mapped_column(String(16), nullable=False)
    model_versions: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_decision: Mapped[str | None] = mapped_column(String(16), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ImageCaption(Base):
    __tablename__ = "image_captions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    media_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("media_assets.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    caption_short: Mapped[str | None] = mapped_column(Text, nullable=True)
    caption_medium: Mapped[str | None] = mapped_column(Text, nullable=True)
    caption_promo: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_version: Mapped[str | None] = mapped_column(String(128), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ImageTag(Base):
    __tablename__ = "image_tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    media_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("media_assets.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    tags: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    embedding_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # embedding Vector(384) column is managed via raw SQL in migration (pgvector)
    model_version: Mapped[str | None] = mapped_column(String(128), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
