from __future__ import annotations

from datetime import datetime
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


class BillingHealthOut(BaseModel):
    stripe_mode: str
    stripe_configured: bool
    webhook_configured: bool
    webhook_previous_configured: bool
    checkout_defaults_configured: bool


class SubscriptionStatusItem(BaseModel):
    subscription_id: UUID
    creator_user_id: UUID
    status: str
    stripe_subscription_id: str | None = None
    current_period_end: datetime | None = None
    cancel_at_period_end: bool = False
    cancel_at: datetime | None = None
    updated_at: datetime


class BillingStatusOut(BaseModel):
    fan_user_id: UUID
    items: list[SubscriptionStatusItem]


class CancelSubscriptionOut(BaseModel):
    subscription_id: UUID
    status: str
    cancel_at_period_end: bool
    current_period_end: datetime | None = None
