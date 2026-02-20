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
