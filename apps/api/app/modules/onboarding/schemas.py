"""Onboarding request/response schemas."""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class CreatorRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=10, max_length=128)


class CreatorRegisterResponse(BaseModel):
    creator_id: str
    email_delivery_status: str = "sent"
    email_delivery_error_code: str | None = None


class ResendVerificationEmailRequest(BaseModel):
    email: EmailStr


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=1)


class OnboardingStatusResponse(BaseModel):
    state: str
    checklist: dict[str, bool]


class KycSessionResponse(BaseModel):
    redirect_url: str
    session_id: str


class KycStatusResponse(BaseModel):
    session_status: str
    creator_state: str


class WebhookKycPayload(BaseModel):
    provider_session_id: str
    status: str  # SUBMITTED, APPROVED, REJECTED
    event_id: str
    reason_code: str | None = None


class StateTransitionErrorResponse(BaseModel):
    error_code: str
    message: str
    from_state: str | None
    to_state: str
