from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class WebhookAck(BaseModel):
    status: str


class CheckoutSubscriptionCreate(BaseModel):
    """Start subscription checkout for a creator. Provide creator_id or creator_handle."""

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
    payment_provider: str = "ccbill"
    configured: bool
    webhook_configured: bool
    checkout_defaults_configured: bool


class SubscriptionStatusItem(BaseModel):
    subscription_id: UUID
    creator_user_id: UUID
    status: str
    ccbill_subscription_id: str | None = None
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


class CreatorPlanOut(BaseModel):
    """Current creator subscription plan."""

    price: Decimal = Field(description="Monthly price in major currency units (e.g. 4.99)")
    currency: str
    active: bool
    platform_fee_percent: float = Field(description="Platform fee deducted from each payment")
    min_price_cents: int = Field(description="Minimum allowed price in cents")
    max_price_cents: int = Field(description="Maximum allowed price in cents")


class CreatorPlanUpdate(BaseModel):
    """Update subscription price. Price is in major currency units (e.g. 9.99)."""

    price: Decimal = Field(gt=0, max_digits=8, decimal_places=2)


# ---------------------------------------------------------------------------
# Purchase history (fan-facing)
# ---------------------------------------------------------------------------


class PurchaseItem(BaseModel):
    """A single purchase (PPV post or PPV message)."""

    id: UUID
    type: str = Field(description="PPV_POST or PPV_MESSAGE or SUBSCRIPTION or TIP")
    status: str
    amount_cents: int
    currency: str
    creator_handle: str | None = None
    creator_display_name: str | None = None
    post_id: UUID | None = None
    transaction_id: str | None = None
    created_at: datetime


class PurchaseHistoryOut(BaseModel):
    items: list[PurchaseItem]
    total: int
