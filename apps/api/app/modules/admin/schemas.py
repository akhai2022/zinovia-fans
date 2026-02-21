from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AdminCreatorOut(BaseModel):
    user_id: UUID
    email: str
    role: str
    is_active: bool
    onboarding_state: str | None
    handle: str | None
    display_name: str
    bio: str | None
    phone: str | None = None
    country: str | None = None
    discoverable: bool
    featured: bool
    verified: bool = False
    signup_ip: str | None = None
    last_login_ip: str | None = None
    last_login_at: datetime | None = None
    created_at: datetime


class AdminCreatorPage(BaseModel):
    items: list[AdminCreatorOut]
    total: int
    page: int
    page_size: int


class AdminCreatorAction(BaseModel):
    action: str = Field(..., pattern="^(approve|reject|feature|unfeature|suspend|activate|verify|unverify)$")
    reason: str | None = None


class AdminPostOut(BaseModel):
    id: UUID
    creator_user_id: str
    creator_handle: str | None
    type: str
    caption: str | None
    visibility: str
    nsfw: bool
    status: str
    created_at: datetime


class AdminPostPage(BaseModel):
    items: list[AdminPostOut]
    total: int
    page: int
    page_size: int


class AdminPostAction(BaseModel):
    action: str = Field(..., pattern="^(remove|restore)$")
    reason: str | None = None


class AdminTransactionOut(BaseModel):
    id: UUID
    type: str
    creator_user_id: UUID
    creator_handle: str | None = None
    creator_display_name: str | None = None
    gross_cents: int
    fee_cents: int
    net_cents: int
    currency: str
    reference_type: str | None = None
    reference_id: str | None = None
    created_at: datetime


class AdminTransactionPage(BaseModel):
    items: list[AdminTransactionOut]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Users (all roles)
# ---------------------------------------------------------------------------


class AdminUserOut(BaseModel):
    user_id: UUID
    email: str
    role: str
    is_active: bool
    onboarding_state: str | None = None
    handle: str | None = None
    display_name: str
    bio: str | None = None
    phone: str | None = None
    country: str | None = None
    discoverable: bool = False
    featured: bool = False
    verified: bool = False
    signup_ip: str | None = None
    last_login_ip: str | None = None
    last_login_at: datetime | None = None
    last_activity_at: datetime | None = None
    created_at: datetime


class AdminUserPage(BaseModel):
    items: list[AdminUserOut]
    total: int
    page: int
    page_size: int


class AdminUserAction(BaseModel):
    action: str = Field(
        ...,
        pattern="^(approve|reject|feature|unfeature|suspend|activate|verify|unverify|delete)$",
    )
    reason: str | None = None


class AdminUserDetailOut(AdminUserOut):
    subscriber_count: int = 0
    post_count: int = 0
    total_earned_cents: int = 0


class AdminUserPostOut(BaseModel):
    id: UUID
    type: str
    caption: str | None = None
    visibility: str
    nsfw: bool
    status: str
    price_cents: int | None = None
    currency: str | None = None
    created_at: datetime


class AdminUserPostPage(BaseModel):
    items: list[AdminUserPostOut]
    total: int
    page: int
    page_size: int


class AdminUserSubscriberOut(BaseModel):
    fan_user_id: UUID
    fan_email: str
    fan_display_name: str
    status: str
    created_at: datetime


class AdminUserSubscriberPage(BaseModel):
    items: list[AdminUserSubscriberOut]
    total: int
    page: int
    page_size: int
