from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field
from pydantic import ConfigDict
from app.modules.auth.constants import TOKEN_TYPE_BEARER


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    display_name: str
    created_at: datetime
    updated_at: datetime


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    email: EmailStr
    role: str
    is_active: bool
    profile: ProfileOut | None
    created_at: datetime
    updated_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = TOKEN_TYPE_BEARER
