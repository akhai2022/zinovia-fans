from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(slots=True)
class PromotionDraft:
    creator_id: UUID
    percent_off: int
    duration_months: int
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    active: bool = False


@dataclass(slots=True)
class BroadcastDraft:
    creator_id: UUID
    subscribers_only: bool
    body: str
    batch_size: int = 200


@dataclass(slots=True)
class PpvPostDraft:
    post_id: UUID
    price_cents: int
    currency: str = "usd"

