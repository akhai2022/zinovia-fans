"""Explicit auth tests: signup, login, verify-email, and GET /auth/me (cookie and Bearer)."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from conftest import signup_verify_login


def _unique_email() -> str:
    return f"auth-{uuid.uuid4().hex[:12]}@test.com"


@pytest.mark.asyncio
async def test_signup_returns_201(async_client: AsyncClient) -> None:
    """POST /auth/signup returns 201 with user_id and email delivery status."""
    email = _unique_email()
    payload = {
        "email": email,
        "password": "password123",
        "display_name": "Test User",
    }
    r = await async_client.post("/auth/signup", json=payload)
    assert r.status_code == 201, r.json()
    data = r.json()
    assert "user_id" in data
    assert data["email_delivery_status"] in ("sent", "failed")


@pytest.mark.asyncio
async def test_login_blocked_for_unverified_user(async_client: AsyncClient) -> None:
    """POST /auth/login returns 401 when email is not verified (onboarding_state=CREATED)."""
    email = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "Unverified"},
    )
    r = await async_client.post(
        "/auth/login",
        json={"email": email, "password": "password123"},
    )
    assert r.status_code == 401, r.json()
    assert r.json()["detail"]["code"] == "email_not_verified"


@pytest.mark.asyncio
async def test_login_returns_200(async_client: AsyncClient) -> None:
    """POST /auth/login returns 200 and access_token after email verification."""
    email = _unique_email()
    # Signup
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "Login Test"},
    )
    # Verify email (workflow step: CREATED → EMAIL_VERIFIED)
    dev_r = await async_client.get("/auth/dev/tokens", params={"email": email})
    verification_token = dev_r.json()["verification_token"]
    await async_client.post(
        "/auth/verify-email",
        json={"token": verification_token},
        headers={"Idempotency-Key": str(uuid.uuid4())},
    )
    # Login
    r = await async_client.post(
        "/auth/login",
        json={"email": email, "password": "password123"},
    )
    assert r.status_code == 200, r.json()
    data = r.json()
    assert "access_token" in data
    assert data["access_token"]
    assert data.get("token_type", "").lower() == "bearer"
    # Cookie set for browser flows (header name may be title-cased)
    set_cookie = r.headers.get("set-cookie") or r.headers.get("Set-Cookie") or ""
    assert "access_token" in set_cookie.lower()


@pytest.mark.asyncio
async def test_me_with_cookie(async_client: AsyncClient) -> None:
    """GET /auth/me works when session is established via cookie (login leaves cookie on client)."""
    email = _unique_email()
    await signup_verify_login(async_client, email, display_name="Cookie User")
    # Same client sends stored cookie; no Authorization header
    r = await async_client.get("/auth/me")
    assert r.status_code == 200, r.json()
    data = r.json()
    assert data["email"] == email
    assert data["is_active"] is True
    assert "id" in data


@pytest.mark.asyncio
async def test_me_with_bearer(async_client: AsyncClient) -> None:
    """GET /auth/me works with Authorization: Bearer <token> (no cookie)."""
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="Bearer User")
    # Clear cookies so only Bearer is used
    async_client.cookies.clear()
    r = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.json()
    data = r.json()
    assert data["email"] == email
    assert "id" in data


@pytest.mark.asyncio
async def test_me_unauthorized_without_token(async_client: AsyncClient) -> None:
    """GET /auth/me returns 401 when neither cookie nor Bearer is sent."""
    async_client.cookies.clear()
    r = await async_client.get("/auth/me")
    assert r.status_code == 401, r.json()
    assert r.json().get("detail", {}).get("code") == "missing_token"
