"""Onboarding dependencies."""

from __future__ import annotations

from fastapi import Header
from app.core.errors import AppError


async def require_idempotency_key(
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
) -> str:
    if not idempotency_key or not idempotency_key.strip():
        raise AppError(status_code=400, detail="Idempotency-Key header required")
    return idempotency_key.strip()
