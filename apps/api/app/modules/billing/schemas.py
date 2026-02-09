from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class WebhookAck(BaseModel):
    status: str


class CheckoutSubscriptionCreate(BaseModel):
    """Start subscription checkout for a creator. Provide creator_id or creator_handle. success_url/cancel_url optional (from env)."""

    creator_id: UUID | None = None
    creator_handle: str | None = Field(None, min_length=1, max_length=64)
    success_url: str | None = Field(None, min_length=1, max_length=2048)
    cancel_url: str | None = Field(None, min_length=1, max_length=2048)

    @model_validator(mode="after")
    def require_creator_id_or_handle(self) -> "CheckoutSubscriptionCreate":
        has_id = self.creator_id is not None
        has_handle = bool(self.creator_handle)
        if has_id == has_handle:
            raise ValueError("Provide exactly one of creator_id or creator_handle")
        return self


class CheckoutSubscriptionOut(BaseModel):
    """Checkout URL for redirect."""

    checkout_url: str
