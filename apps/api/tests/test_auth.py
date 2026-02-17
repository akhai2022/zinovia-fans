"""Explicit auth tests: signup, login, and GET /auth/me (cookie and Bearer)."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


def _unique_email() -> str:
    return f"auth-{uuid.uuid4().hex[:12]}@test.com"


@pytest.mark.asyncio
async def test_signup_returns_201(async_client: AsyncClient) -> None:
    """POST /auth/signup returns 201 and user payload."""
    email = _unique_email()
    payload = {
        "email": email,
        "password": "password123",
        "display_name": "Test User",
    }
    r = await async_client.post("/auth/signup", json=payload)
    assert r.status_code == 201, r.json()
    data = r.json()
    assert data["email"] == email
    assert "id" in data
    assert data["role"] == "fan"  # Fan signup assigns fan role
    assert data["is_active"] is True
    assert "created_at" in data
    assert "updated_at" in data
    assert data.get("profile") is not None
    assert data["profile"]["display_name"] == "Test User"


@pytest.mark.asyncio
async def test_login_returns_200(async_client: AsyncClient) -> None:
    """POST /auth/login returns 200 and access_token (and sets cookie)."""
    email = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "Login Test"},
    )
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
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "Cookie User"},
    )
    await async_client.post(
        "/auth/login",
        json={"email": email, "password": "password123"},
    )
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
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "Bearer User"},
    )
    login_r = await async_client.post(
        "/auth/login",
        json={"email": email, "password": "password123"},
    )
    token = login_r.json()["access_token"]
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
    assert r.json().get("detail") == "missing_token"
