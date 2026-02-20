from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class ContactFormRequest(BaseModel):
    category: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Support category (e.g. general, billing, account, content_report, partnerships, privacy)",
    )
    email: EmailStr = Field(..., description="Sender email address")
    subject: str = Field(..., min_length=1, max_length=200, description="Message subject")
    message: str = Field(..., min_length=10, max_length=5000, description="Message body")


class ContactFormResponse(BaseModel):
    ok: bool = True
    message: str = "Your message has been sent. We'll get back to you shortly."
