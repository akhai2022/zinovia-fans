from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: UUID
    type: str
    payload_json: dict
    read_at: datetime | None
    created_at: datetime


class NotificationPageOut(BaseModel):
    items: list[NotificationOut]
    next_cursor: str | None = None
    unread_count: int = 0

