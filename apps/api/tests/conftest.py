from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.main import app
from app.modules.auth.models import User


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


async def signup_verify_login(
    client: AsyncClient,
    email: str,
    password: str = "password123",
    display_name: str = "TestUser",
    role: str = "creator",
) -> str:
    """Full onboarding workflow: signup → verify email → login.

    State machine steps:
      1. POST /auth/signup           → user created (onboarding_state=CREATED, role=fan)
      2. (if role=creator) promote   → set role=creator in DB before login
      3. GET  /auth/dev/tokens       → retrieve verification token
      4. POST /auth/verify-email     → CREATED → EMAIL_VERIFIED
      5. POST /auth/login            → returns access_token (JWT includes role)

    Returns the access_token string.
    """
    await client.post(
        "/auth/signup",
        json={"email": email, "password": password, "display_name": display_name},
    )
    # Promote to creator role if needed (before login so JWT has correct role)
    if role == "creator":
        async with async_session_factory() as session:
            await session.execute(
                update(User).where(User.email == email).values(role="creator")
            )
            await session.commit()
    # Step: retrieve verification token (dev-only endpoint, disabled in production)
    dev_r = await client.get("/auth/dev/tokens", params={"email": email})
    verification_token = dev_r.json()["verification_token"]
    # Step: verify email (CREATED → EMAIL_VERIFIED)
    await client.post(
        "/auth/verify-email",
        json={"token": verification_token},
        headers={"Idempotency-Key": str(uuid.uuid4())},
    )
    # Step: login
    login_r = await client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    token = login_r.json()["access_token"]
    # Remove CSRF cookie set by login so Bearer-only tests don't trigger
    # the double-submit CSRF middleware (cookie present but no X-CSRF-Token header).
    client.cookies.delete("csrf_token")
    return token
