from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


class PpvCreateIntentOut(BaseModel):
    purchase_id: UUID | None = None
    client_secret: str | None = None
    amount_cents: int
    currency: str
    status: str


class PpvMessageMediaStatusOut(BaseModel):
    is_locked: bool
    viewer_has_unlocked: bool
    price_cents: int | None = None
    currency: str | None = None

