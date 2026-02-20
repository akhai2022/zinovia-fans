from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field
from pydantic import ConfigDict
from app.modules.auth.constants import TOKEN_TYPE_BEARER


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10)
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
    last_login_at: datetime | None = None
    onboarding_state: str | None = None
    country: str | None = None
    phone: str | None = None
    created_at: datetime
    updated_at: datetime


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=10)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=10)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = TOKEN_TYPE_BEARER
