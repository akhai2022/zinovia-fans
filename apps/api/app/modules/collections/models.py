from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import TimestampMixin


class Collection(TimestampMixin, Base):
    __tablename__ = "collections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    creator_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id"), nullable=True
    )
    visibility: Mapped[str] = mapped_column(String(32), default="PUBLIC", nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    posts: Mapped[list["CollectionPost"]] = relationship(
        "CollectionPost", back_populates="collection", order_by="CollectionPost.position",
        cascade="all, delete-orphan",
    )


class CollectionPost(Base):
    __tablename__ = "collection_posts"
    __table_args__ = (
        UniqueConstraint("collection_id", "post_id", name="uq_collection_post"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("collections.id", ondelete="CASCADE"), nullable=False
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    collection: Mapped["Collection"] = relationship("Collection", back_populates="posts")
