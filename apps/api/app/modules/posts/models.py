from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import TimestampMixin


class Post(TimestampMixin, Base):
    __tablename__ = "posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    creator_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    type: Mapped[str] = mapped_column(String(32))
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    visibility: Mapped[str] = mapped_column(String(32))
    nsfw: Mapped[bool] = mapped_column(Boolean, default=False)

    media: Mapped[list["PostMedia"]] = relationship(
        "PostMedia", back_populates="post", order_by="PostMedia.position"
    )


class PostMedia(Base):
    __tablename__ = "post_media"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("posts.id"))
    media_asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("media_assets.id"))
    position: Mapped[int] = mapped_column(Integer, default=0)

    post: Mapped["Post"] = relationship("Post", back_populates="media")
