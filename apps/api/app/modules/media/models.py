from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.db.mixins import TimestampMixin


class MediaObject(TimestampMixin, Base):
    __tablename__ = "media_assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    object_key: Mapped[str] = mapped_column(String(255), unique=True)
    content_type: Mapped[str] = mapped_column(String(120))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    blurhash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    dominant_color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    safety_status: Mapped[str | None] = mapped_column(String(16), nullable=True)

    derived: Mapped[list["MediaDerivedAsset"]] = relationship(
        "MediaDerivedAsset",
        back_populates="parent",
        cascade="all, delete-orphan",
    )


class MediaDerivedAsset(Base):
    """Derived variant (thumb, grid, full) of an original media asset. Originals are never modified."""

    __tablename__ = "media_derived_assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("media_assets.id", ondelete="CASCADE"),
        nullable=False,
    )
    variant: Mapped[str] = mapped_column(String(32), nullable=False)
    object_key: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    parent: Mapped[MediaObject] = relationship("MediaObject", back_populates="derived")
